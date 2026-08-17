import json
import time
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
import webauthn
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
)

from app.core.database import get_db
from app.models import (
    Voter,
    WebAuthnCredential,
    AuthSession,
    AuthStage,
    AuthenticationLog,
)
from app.schemas import (
    WebAuthnRegisterOptionsRequest,
    WebAuthnRegisterVerifyRequest,
    WebAuthnAuthOptionsRequest,
    WebAuthnAuthVerifyRequest,
)

router = APIRouter(prefix="/webauthn", tags=["WebAuthn Authentication"])

RP_NAME = "Civitas Secure Vote"

# In-memory challenge cache: key -> (challenge_bytes, timestamp)
_CHALLENGES: dict[str, tuple[bytes, float]] = {}
CHALLENGE_TTL_SECONDS = 300


def _clean_expired_challenges():
    now_ts = time.time()
    expired = [k for k, (_, ts) in _CHALLENGES.items() if now_ts - ts > CHALLENGE_TTL_SECONDS]
    for k in expired:
        _CHALLENGES.pop(k, None)


def _extract_hostname(raw_val: str | None) -> str | None:
    if not raw_val:
        return None
    val = raw_val.strip()
    if not val:
        return None
    if "://" in val:
        val = val.split("://", 1)[1]
    val = val.split("/")[0].split("?")[0].split("#")[0]
    val = val.split(":")[0].strip().lower()
    return val if val else None


def _get_rp_id_and_origins(request: Request) -> tuple[str, list[str]]:
    """
    Dynamically resolves WebAuthn RP ID (hostname ONLY) and expected origins.
    Inspects X-Forwarded-Host, Origin, Referer, and Host request headers safely.
    """
    xf_host = _extract_hostname(request.headers.get("x-forwarded-host"))
    origin_host = _extract_hostname(request.headers.get("origin"))
    referer_host = _extract_hostname(request.headers.get("referer"))
    direct_host = _extract_hostname(request.headers.get("host"))

    candidate_host = xf_host or origin_host or referer_host or direct_host or "localhost"

    if candidate_host in ("localhost", "127.0.0.1"):
        rp_id = "localhost"
    elif candidate_host.endswith(".trycloudflare.com") or candidate_host == "trycloudflare.com":
        rp_id = candidate_host
    elif candidate_host and "." in candidate_host:
        rp_id = candidate_host
    else:
        rp_id = "localhost"

    if rp_id == "localhost":
        origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]
    else:
        origins = [
            f"https://{rp_id}",
            f"http://{rp_id}",
        ]
        raw_origin = request.headers.get("origin") or request.headers.get("referer") or ""
        if raw_origin:
            clean_origin = raw_origin.rstrip("/")
            if "://" in clean_origin:
                parts = clean_origin.split("/")
                base_origin = f"{parts[0]}//{parts[2]}"
                if base_origin not in origins:
                    origins.append(base_origin)

    return rp_id, origins


@router.post("/register/options")
def register_options(data: WebAuthnRegisterOptionsRequest, request: Request, db: Session = Depends(get_db)):
    _clean_expired_challenges()
    voter = db.get(Voter, data.voter_id)
    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found in database")

    rp_id, _ = _get_rp_id_and_origins(request)
    existing_creds = db.scalars(
        select(WebAuthnCredential.credential_id).where(WebAuthnCredential.voter_id == voter.id)
    ).all()

    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=c_id) for c_id in existing_creds
    ]

    options = webauthn.generate_registration_options(
        rp_id=rp_id,
        rp_name=RP_NAME,
        user_id=voter.id.encode("utf-8"),
        user_name=voter.voter_id,
        user_display_name=voter.full_name,
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.DISCOURAGED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )

    _CHALLENGES[f"reg_{voter.id}"] = (options.challenge, time.time())
    return json.loads(webauthn.options_to_json(options))


@router.post("/register/verify")
def register_verify(data: WebAuthnRegisterVerifyRequest, request: Request, db: Session = Depends(get_db)):
    _clean_expired_challenges()
    voter = db.get(Voter, data.voter_id)
    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found in database")

    challenge_key = f"reg_{voter.id}"
    challenge_entry = _CHALLENGES.pop(challenge_key, None)
    if not challenge_entry:
        raise HTTPException(status_code=400, detail="Registration challenge expired or missing. Please try again.")

    expected_challenge, ts = challenge_entry
    if time.time() - ts > CHALLENGE_TTL_SECONDS:
        raise HTTPException(status_code=400, detail="Registration challenge expired. Please try again.")

    rp_id, origins = _get_rp_id_and_origins(request)
    try:
        verification = webauthn.verify_registration_response(
            credential=data.credential,
            expected_challenge=expected_challenge,
            expected_rp_id=rp_id,
            expected_origin=origins,
            require_user_verification=True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Touch ID registration failed: {str(e)}")

    # Store WebAuthn credential (NO biometric data stored)
    new_cred = WebAuthnCredential(
        voter_id=voter.id,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        aaguid=verification.aaguid,
    )
    db.add(new_cred)
    db.commit()

    return {"status": "ok", "message": "Touch ID security key registered successfully"}


@router.post("/authenticate/options")
def authenticate_options(data: WebAuthnAuthOptionsRequest, request: Request, db: Session = Depends(get_db)):
    _clean_expired_challenges()
    voter = db.get(Voter, data.voter_id)
    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found in database")

    creds = db.scalars(
        select(WebAuthnCredential).where(WebAuthnCredential.voter_id == voter.id)
    ).all()

    if not creds:
        raise HTTPException(
            status_code=404,
            detail="No registered security credential (Touch ID) was found for this voter. Please register Touch ID in the Admin Panel."
        )

    allow_credentials = [
        PublicKeyCredentialDescriptor(id=c.credential_id) for c in creds
    ]

    rp_id, _ = _get_rp_id_and_origins(request)
    options = webauthn.generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.REQUIRED,
    )

    _CHALLENGES[f"auth_{data.session_id}"] = (options.challenge, time.time())
    return json.loads(webauthn.options_to_json(options))


@router.post("/authenticate/verify")
def authenticate_verify(data: WebAuthnAuthVerifyRequest, request: Request, db: Session = Depends(get_db)):
    _clean_expired_challenges()
    session = db.get(AuthSession, str(data.session_id))
    if not session or session.closed_at:
        raise HTTPException(status_code=401, detail="Authentication session is expired or invalid")

    challenge_key = f"auth_{data.session_id}"
    challenge_entry = _CHALLENGES.pop(challenge_key, None)
    if not challenge_entry:
        raise HTTPException(status_code=400, detail="Authentication challenge expired or missing. Please try again.")

    expected_challenge, ts = challenge_entry
    if time.time() - ts > CHALLENGE_TTL_SECONDS:
        raise HTTPException(status_code=400, detail="Authentication challenge expired")

    try:
        cred_json = json.loads(data.credential) if isinstance(data.credential, str) else data.credential
        cred_id_b64 = cred_json.get("id")
        cred_id_bytes = webauthn.base64url_to_bytes(cred_id_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid WebAuthn credential payload format")

    stored_cred = db.scalar(
        select(WebAuthnCredential).where(
            WebAuthnCredential.voter_id == session.voter_id,
            WebAuthnCredential.credential_id == cred_id_bytes
        )
    )
    if not stored_cred:
        raise HTTPException(status_code=404, detail="Credential mismatch: security key does not belong to this voter")

    rp_id, origins = _get_rp_id_and_origins(request)
    try:
        verification = webauthn.verify_authentication_response(
            credential=data.credential,
            expected_challenge=expected_challenge,
            expected_rp_id=rp_id,
            expected_origin=origins,
            credential_public_key=stored_cred.public_key,
            credential_current_sign_count=stored_cred.sign_count,
            require_user_verification=True,
        )
    except Exception as e:
        db.add(AuthenticationLog(
            voter_id=session.voter_id,
            election_id=session.election_id,
            stage=AuthStage.FINGERPRINT,
            is_success=False,
            detail={"webauthn_error": str(e)},
        ))
        db.commit()
        raise HTTPException(status_code=401, detail=f"Touch ID verification failed: {str(e)}")

    stored_cred.sign_count = verification.new_sign_count
    session.stage = AuthStage.FINGERPRINT
    session.metrics = {**session.metrics, "fingerprint": 100.0, "webauthn_verified": True}

    db.add(AuthenticationLog(
        voter_id=session.voter_id,
        election_id=session.election_id,
        stage=AuthStage.FINGERPRINT,
        is_success=True,
        fingerprint_confidence=100.0,
        detail={"webauthn": True, "sign_count": verification.new_sign_count},
    ))
    db.commit()

    return {"status": "ok", "stage": session.stage.value}

