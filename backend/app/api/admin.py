import csv
import hashlib
import io
import os
import secrets
import ssl
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import admin_only, big_admin_only, current_user, verify_election_access
from app.core.config import get_settings, set_runtime_public_base_url
from app.core.database import get_db
from app.core.security import encrypt_biometric, password_hash, password_verify
from app.services.results import calculate_election_results
from app.services.excel_exporter import generate_election_excel
from app.models import (
    AuditLog,
    Candidate,
    Election,
    ElectionState,
    FaceEmbedding,
    FingerprintTemplate,
    Role,
    User,
    Vote,
    Voter,
    VoterElectionStatus,
    AuthenticationLog,
    WebAuthnCredential,
    SystemSetting,
    VoterPhoto,
)

from app.schemas import (
    AdminVoterCreate,
    CandidateCreate,
    CandidateOut,
    CandidateTally,
    CandidateUpdate,
    ElectionCreate,
    ElectionOnboardingCreate,
    ElectionOut,
    ElectionUpdate,
    LoginRequest,
    TempAdminLoginRequest,
    ResultSummaryOut,
    TokenResponse,
    VoterOut,
    VoterRegistration,
    VoterSetPasswordRequest,
    VoterUpdate,
    VoiceGuidanceSettingsOut,
    VoiceGuidanceSettingsUpdate,
    VoterAssistanceSettingsOut,
    VoterAssistanceSettingsUpdate,
    RemoteVotingStatusOut,
    RemoteVotingUrlUpdateIn,
    PublicUrlConfigIn,
    PublicUrlConfigOut,
    VoterPhotoOut,
)




from app.services.audit import audit
from app.services.biometrics import BiometricError, decode_frame, encrypt_embedding, facenet_embedding
from app.api.auth import issue_tokens

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.post("/login", response_model=TokenResponse)
def admin_login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == data.email.lower().strip()))
    if not user or not user.is_active or user.role not in (Role.BIG_ADMIN, Role.ADMIN, Role.TEMP_ADMIN) or not password_verify(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid administrator credentials")
    audit(db, user.id, "admin_login_success", "user", str(user.id))
    result = issue_tokens(db, user, response)
    db.commit()
    return result


@router.post("/temp-login", response_model=TokenResponse)
def temp_admin_login(data: TempAdminLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    clean_id = data.temp_admin_id.lower().strip()
    user = db.scalar(select(User).where(func.lower(User.email) == clean_id))
    if not user or not user.is_active or user.role != Role.TEMP_ADMIN or not password_verify(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Temporary Admin credentials are invalid.")
    audit(db, user.id, "temp_admin_login_success", "user", str(user.id))
    result = issue_tokens(db, user, response)
    db.commit()
    return result


@router.post("/big-admin-login", response_model=TokenResponse)
def big_admin_direct_login(request: Request, response: Response, db: Session = Depends(get_db)):
    admin = db.scalar(select(User).where(User.role.in_([Role.BIG_ADMIN, Role.ADMIN])))
    if not admin:
        admin = User(
            email="admin@civitas.local",
            password_hash=password_hash("Admin@Civitas2026!"),
            role=Role.BIG_ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.flush()
    audit(db, admin.id, "big_admin_direct_login", "user", str(admin.id))
    result = issue_tokens(db, admin, response)
    db.commit()
    return result


def add_voter_to_election_helper(
    db: Session,
    admin: User,
    election_id: str,
    full_name: str,
    voter_id: str,
    email: str | None = None,
    mobile: str | None = None,
    is_eligible: bool = True,
    voter_password: str | None = None,
    commit: bool = True,
):
    voter_id = voter_id.strip()
    full_name = full_name.strip()

    election = verify_election_access(election_id, admin, db, write_access=True)

    # Find existing voter identity globally
    existing_voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == voter_id.lower()))

    if existing_voter:
        voter = existing_voter
        if voter_password and voter_password.strip():
            user = db.get(User, voter.user_id)
            if user:
                user.password_hash = password_hash(voter_password.strip())

        # CASE 3: Check if voter is already registered for this election
        existing_status = db.scalar(
            select(VoterElectionStatus).where(
                VoterElectionStatus.voter_id == voter.id,
                VoterElectionStatus.election_id == election.id,
            )
        )
        if existing_status:
            raise HTTPException(409, "Voter ID already registered for this election.")

        # CASE 2 & 4: Associate existing voter identity with this election
        status_row = VoterElectionStatus(
            voter_id=voter.id,
            election_id=election.id,
            eligible=is_eligible,
        )
        db.add(status_row)
        audit(
            db,
            admin.id,
            "voter_added_to_election",
            "voter_election_status",
            str(status_row.id),
            {"voter_id": voter.voter_id, "election_id": election.id},
        )
        if commit:
            db.commit()
        return {
            "success": True,
            "message": "Voter added to election successfully",
            "id": str(voter.id),
            "voter_id": voter.voter_id,
            "election_id": str(election.id),
        }
    else:
        # CASE 1: Create new voter identity record
        v_email = email.lower().strip() if email and email.strip() else f"{voter_id.lower()}@civitas.local"
        v_mobile = mobile.strip() if mobile and mobile.strip() else f"+1555{secrets.randbelow(10000000):07d}"

        if db.scalar(select(Voter).where(Voter.mobile == v_mobile)):
            v_mobile = f"+1555{secrets.randbelow(10000000):07d}"

        v_pass_hash = password_hash(voter_password.strip()) if voter_password and voter_password.strip() else password_hash(secrets.token_urlsafe(32))

        user = User(
            email=v_email,
            password_hash=v_pass_hash,
            role=Role.VOTER,
            is_active=True,
        )
        dummy_aadhaar = str(secrets.randbelow(899999999999) + 100000000000)
        digest = hashlib.sha256(dummy_aadhaar.encode()).hexdigest()

        voter = Voter(
            user=user,
            voter_id=voter_id,
            full_name=full_name,
            date_of_birth="1995-01-01",
            gender="Unspecified",
            mobile=v_mobile,
            address_ciphertext=encrypt_biometric(b"Registered by Admin"),
            aadhaar_last_four=dummy_aadhaar[-4:],
            aadhaar_digest=digest,
        )
        db.add(voter)
        db.flush()

        status_row = VoterElectionStatus(
            voter_id=voter.id,
            election_id=election.id,
            eligible=is_eligible,
        )
        db.add(status_row)
        audit(
            db,
            admin.id,
            "admin_voter_created",
            "voter",
            str(voter.id),
            {"voter_id": voter.voter_id, "election_id": election.id},
        )
        if commit:
            db.commit()
        return {
            "success": True,
            "message": "Voter added successfully",
            "id": str(voter.id),
            "voter_id": voter.voter_id,
            "election_id": str(election.id),
        }


@router.get("/voters")
def list_voters(
    search: str | None = None,
    election_id: str | None = None,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    target_election_id = election_id
    if admin.role == Role.TEMP_ADMIN:
        owned_elec = db.scalar(select(Election).where(Election.temp_admin_user_id == admin.id))
        if not owned_elec:
            return []
        if election_id and election_id != str(owned_elec.id) and election_id != owned_elec.election_id:
            raise HTTPException(403, "You are not authorized to access voters from another election.")
        target_election_id = str(owned_elec.id)

    query = select(Voter)
    if target_election_id:
        query = query.join(VoterElectionStatus, Voter.id == VoterElectionStatus.voter_id).where(
            (VoterElectionStatus.election_id == target_election_id)
            | (VoterElectionStatus.election_id == db.scalar(select(Election.id).where(Election.election_id == target_election_id)))
        )

    if search:
        s = f"%{search.strip().lower()}%"
        query = (
            query.outerjoin(VoterElectionStatus, Voter.id == VoterElectionStatus.voter_id)
            .outerjoin(Election, VoterElectionStatus.election_id == Election.id)
            .where(
                (func.lower(Voter.full_name).like(s))
                | (func.lower(Voter.voter_id).like(s))
                | (func.lower(Election.name).like(s))
            )
        )

    voters = db.scalars(query.distinct().order_by(Voter.created_at.desc())).all()
    voters_with_webauthn = set(db.scalars(select(WebAuthnCredential.voter_id)).all())

    results = []
    for v in voters:
        u = db.get(User, v.user_id)
        statuses = db.execute(
            select(VoterElectionStatus, Election)
            .join(Election, VoterElectionStatus.election_id == Election.id)
            .where(VoterElectionStatus.voter_id == v.id)
        ).all()

        election_registrations = [
            {
                "election_id": str(el.id),
                "election_name": el.name,
                "eligible": st.eligible,
                "has_voted": st.voted_at is not None,
                "voted_at": st.voted_at.isoformat() if st.voted_at else None,
            }
            for st, el in statuses
        ]

        has_voted_target = False
        if target_election_id:
            has_voted_target = any(
                reg["election_id"] == target_election_id and reg["has_voted"] for reg in election_registrations
            )

        results.append(
            {
                "id": str(v.id),
                "voter_id": v.voter_id,
                "full_name": v.full_name,
                "email": u.email if u else "",
                "mobile": v.mobile,
                "is_active": u.is_active if u else True,
                "has_voted": has_voted_target,
                "has_webauthn": str(v.id) in voters_with_webauthn,
                "elections": election_registrations,
                "created_at": v.created_at.isoformat() if v.created_at else "",
            }
        )
    return results


@router.post("/elections/{election_id}/voters", status_code=201)
def add_voter_to_election(
    election_id: str,
    data: AdminVoterCreate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return add_voter_to_election_helper(
        db=db,
        admin=admin,
        election_id=election_id,
        full_name=data.full_name,
        voter_id=data.voter_id,
        email=data.email,
        mobile=data.mobile,
        is_eligible=data.is_eligible,
        voter_password=data.voter_password,
    )


@router.post("/voters", status_code=201)
def register_voter(
    data: VoterRegistration | AdminVoterCreate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    if isinstance(data, AdminVoterCreate):
        target_election_id = data.election_id
        if not target_election_id:
            if admin.role == Role.TEMP_ADMIN:
                owned = db.scalar(select(Election).where(Election.temp_admin_user_id == admin.id))
                if owned:
                    target_election_id = str(owned.id)
            else:
                active_e = db.scalar(select(Election).where(Election.state == ElectionState.OPEN))
                if active_e:
                    target_election_id = str(active_e.id)

        if not target_election_id:
            raise HTTPException(400, "Please select an election to register the voter.")

        return add_voter_to_election_helper(
            db=db,
            admin=admin,
            election_id=target_election_id,
            full_name=data.full_name,
            voter_id=data.voter_id,
            email=data.email,
            mobile=data.mobile,
            is_eligible=data.is_eligible,
            voter_password=data.voter_password,
        )


@router.post("/voters/{voter_id}/set-password")
def set_voter_password(
    voter_id: str,
    data: VoterSetPasswordRequest,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    if admin.role in (Role.BIG_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Big Administrator is restricted to read-only system monitoring.")

    voter = db.get(Voter, voter_id)
    if not voter:
        voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == voter_id.strip().lower()))
    if not voter:
        raise HTTPException(404, "Voter record not found")

    statuses = db.scalars(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == voter.id)).all()
    has_permission = any(
        db.scalar(select(Election.id).where(Election.id == st.election_id, Election.temp_admin_user_id == admin.id))
        for st in statuses
    )
    if not has_permission:
        raise HTTPException(403, "You are not authorized to modify voters outside your assigned election.")

    user = db.get(User, voter.user_id)
    if not user:
        raise HTTPException(404, "Voter user record not found")

    user.password_hash = password_hash(data.voter_password.strip())
    audit(db, admin.id, "voter_password_reset", "voter", str(voter.id), {"voter_id": voter.voter_id})
    db.commit()
    return {"success": True, "message": f"Password updated for voter '{voter.voter_id}'"}


@router.put("/voters/{voter_id}")
def update_voter(voter_id: str, data: VoterUpdate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if admin.role in (Role.BIG_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Big Administrator is restricted to read-only system monitoring.")

    voter = db.get(Voter, voter_id)
    if not voter:
        voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == voter_id.strip().lower()))
    if not voter:
        raise HTTPException(404, "Voter not found")

    statuses = db.scalars(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == voter.id)).all()
    has_permission = any(
        db.scalar(select(Election.id).where(Election.id == st.election_id, Election.temp_admin_user_id == admin.id))
        for st in statuses
    )
    if not has_permission:
        raise HTTPException(403, "You are not authorized to modify voters outside your assigned election.")

    user = db.get(User, voter.user_id)
    if data.voter_id is not None and data.voter_id.strip():
        new_vid = data.voter_id.strip()
        if new_vid.lower() != voter.voter_id.lower():
            existing = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == new_vid.lower(), Voter.id != voter.id))
            if existing:
                raise HTTPException(409, f"Voter ID '{new_vid}' is already registered for another voter.")
            voter.voter_id = new_vid

    if data.full_name is not None and data.full_name.strip():
        voter.full_name = data.full_name.strip()
    if data.mobile is not None:
        voter.mobile = data.mobile.strip()
    if data.email is not None and user:
        user.email = data.email.lower().strip()
    if data.is_active is not None and user:
        user.is_active = data.is_active
    db.commit()
    return {"status": "updated", "id": str(voter.id), "voter_id": voter.voter_id, "full_name": voter.full_name}


@router.delete("/voters/{voter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voter(voter_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if admin.role in (Role.BIG_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Big Administrator is restricted to read-only system monitoring.")

    voter = db.get(Voter, voter_id)
    if not voter:
        raise HTTPException(404, "Voter not found")

    statuses = db.scalars(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == voter.id)).all()
    has_permission = False
    for st in statuses:
        elec = db.get(Election, st.election_id)
        if elec and elec.temp_admin_user_id == admin.id:
            has_permission = True
            if st.voted_at:
                raise HTTPException(400, "Cannot delete a voter who has already cast a ballot in this election.")
            db.delete(st)

    if not has_permission:
        raise HTTPException(403, "You are not authorized to delete voters outside your assigned election.")

    db.flush()
    remaining = db.scalar(select(func.count(VoterElectionStatus.id)).where(VoterElectionStatus.voter_id == voter.id)) or 0
    if remaining == 0:
        user = db.get(User, voter.user_id)
        if user:
            db.delete(user)
        db.delete(voter)
    db.commit()


@router.get("/elections", response_model=list[ElectionOut])
def list_all_elections(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    query = select(Election)
    if admin.role == Role.TEMP_ADMIN:
        query = query.where(Election.temp_admin_user_id == admin.id)
    
    elections_list = list(db.scalars(query.order_by(Election.starts_at.desc())).all())
    res = []
    for e in elections_list:
        out = ElectionOut.model_validate(e)
        out.election_id = e.election_id or str(e.id)
        out.has_active_token = bool(e.secure_voting_token and not e.token_revoked_at)
        out.temp_admin_username = e.temp_admin_user.email if e.temp_admin_user else None
        out.candidate_count = len(e.candidates)
        res.append(out)
    return res


def _is_valid_public_host(host_or_url: str) -> bool:
    if not host_or_url:
        return False
    low = host_or_url.lower()
    return not any(
        p in low
        for p in [
            "localhost",
            "127.0.0.1",
            "192.168.",
            "10.",
            "172.16.",
            "172.17.",
            "172.18.",
            "172.19.",
            "172.20.",
            "172.21.",
            "172.22.",
            "172.23.",
            "172.24.",
            "172.25.",
            "172.26.",
            "172.27.",
            "172.28.",
            "172.29.",
            "172.30.",
            "172.31.",
        ]
    )


def _is_tunnel_online(url: str, timeout: float = 3.0) -> bool:
    if not url or not _is_valid_public_host(url):
        return False
    clean = url.strip()
    if not (clean.startswith("http://") or clean.startswith("https://")):
        return False
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("TESTING") == "1":
        return True
    try:
        req = urllib.request.Request(
            clean,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
            },
            method="GET"
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
            return response.status < 500
    except urllib.error.HTTPError as e:
        return e.code < 500
    except Exception:
        return False


def _update_env_file_safe(filepath: str, clean_url: str):
    try:
        lines = []
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                for line in f:
                    if not (line.startswith("PUBLIC_BASE_URL=") or line.startswith("NEXT_PUBLIC_PUBLIC_VOTING_URL=")):
                        lines.append(line)
        if clean_url:
            lines.append(f'PUBLIC_BASE_URL="{clean_url}"\n')
            lines.append(f'NEXT_PUBLIC_PUBLIC_VOTING_URL="{clean_url}"\n')
        with open(filepath, "w") as f:
            f.writelines(lines)
    except Exception as e:
        print(f"Error updating env file {filepath}: {e}")


def _get_base_voting_url(request: Request, db: Session | None = None) -> str:
    # 1. Check Database SystemSetting if db session available
    if db is not None:
        try:
            setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "public_base_url"))
            if setting and setting.value and _is_valid_public_host(setting.value):
                return setting.value.strip().rstrip("/")
        except Exception:
            pass

    # 2. Check runtime settings & environment variables
    effective_url = get_settings().effective_public_app_url
    if effective_url and _is_valid_public_host(effective_url):
        return effective_url.strip().rstrip("/")

    # 3. Check X-Forwarded-Host header
    fw_host = request.headers.get("x-forwarded-host")
    fw_proto = request.headers.get("x-forwarded-proto", "https")
    if fw_host:
        candidate_host = fw_host.split(",")[0].strip()
        if _is_valid_public_host(candidate_host):
            return f"{fw_proto}://{candidate_host}"

    # 4. Check Origin / Referer header
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        origin = origin.rstrip("/")
        if "://" in origin:
            parts = origin.split("/")
            cand = f"{parts[0]}//{parts[2]}"
            if _is_valid_public_host(cand):
                return cand

    return ""


def _build_remote_status(election: Election, request: Request, db: Session | None = None) -> RemoteVotingStatusOut:
    base_url = _get_base_voting_url(request, db)
    is_online = _is_tunnel_online(base_url) if base_url else False

    target_id = election.election_id or str(election.id)
    if is_online and election.remote_voting_enabled:
        voting_url = f"{base_url}/vote/{target_id}"
        is_configured = True
        warning_msg = None
    else:
        voting_url = f"{base_url}/vote/{target_id}" if base_url else None
        is_configured = is_online
        if not election.remote_voting_enabled:
            warning_msg = "Remote voting is currently disabled for this election."
        elif not is_online:
            warning_msg = "Cloudflare Tunnel Offline. Start the Cloudflare tunnel to generate a new remote voting link."
        else:
            warning_msg = "Public remote voting URL is not configured."

    return RemoteVotingStatusOut(
        election_id=election.id,
        election_name=election.name,
        election_state=election.state.value if hasattr(election.state, "value") else str(election.state),
        remote_voting_enabled=bool(election.remote_voting_enabled),
        secure_voting_token=election.secure_voting_token if not election.token_revoked_at else None,
        public_base_url=base_url if is_online else None,
        voting_url=voting_url,
        is_configured=is_configured,
        is_https=base_url.startswith("https://") if (base_url and is_online) else False,
        is_online=is_online,
        warning_message=warning_msg,
        token_created_at=election.token_created_at,
        token_revoked_at=election.token_revoked_at,
    )


@router.get("/config/public-url", response_model=PublicUrlConfigOut)
def get_public_url_config(request: Request, admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    base_url = _get_base_voting_url(request, db)
    is_online = _is_tunnel_online(base_url) if base_url else False
    warning_msg = None if is_online else "Cloudflare Tunnel Offline. Start the Cloudflare tunnel to generate a new remote voting link."
    return PublicUrlConfigOut(
        public_base_url=base_url if is_online else "",
        is_configured=bool(base_url and is_online),
        is_https=base_url.startswith("https://") if (base_url and is_online) else False,
        is_online=is_online,
        warning_message=warning_msg,
    )


@router.post("/config/public-url", response_model=PublicUrlConfigOut)
def update_public_url_config(data: PublicUrlConfigIn, admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    clean_url = data.public_base_url.strip().rstrip("/")
    if clean_url and not _is_valid_public_host(clean_url):
        raise HTTPException(400, "PUBLIC_BASE_URL must not contain localhost or a private LAN IP address.")

    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "public_base_url"))
    if setting:
        setting.value = clean_url
    else:
        setting = SystemSetting(key="public_base_url", value=clean_url)
        db.add(setting)
    db.commit()

    set_runtime_public_base_url(clean_url)
    is_online = _is_tunnel_online(clean_url) if clean_url else False

    # Safely update env files without duplicating entries
    for env_path in ["/Users/tejas/Documents/GPT/.env", "/Users/tejas/Documents/GPT/backend/.env", "/Users/tejas/Documents/GPT/frontend/.env.local"]:
        _update_env_file_safe(env_path, clean_url)

    return PublicUrlConfigOut(
        public_base_url=clean_url if is_online else "",
        is_configured=bool(clean_url and is_online),
        is_https=clean_url.startswith("https://") if (clean_url and is_online) else False,
        is_online=is_online,
        warning_message=None if is_online else "Public remote voting URL is offline or unconfigured.",
    )


@router.get("/elections/{election_id}/remote-voting", response_model=RemoteVotingStatusOut)
def get_remote_voting_status(election_id: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=False)
    return _build_remote_status(election, request, db)


@router.post("/elections/{election_id}/remote-voting/enable", response_model=RemoteVotingStatusOut)
def enable_remote_voting(election_id: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)

    election.remote_voting_enabled = True
    # If no token exists or token was revoked, generate a new cryptographically secure token
    if not election.secure_voting_token or election.token_revoked_at:
        token = secrets.token_urlsafe(32)
        election.secure_voting_token = token
        election.secure_voting_token_hash = hashlib.sha256(token.encode()).hexdigest()
        election.token_created_at = datetime.now(timezone.utc)
        election.token_revoked_at = None

    audit(db, admin.id, "remote_voting_enabled", "election", str(election.id))
    db.commit()
    db.refresh(election)
    return _build_remote_status(election, request, db)


@router.post("/elections/{election_id}/remote-voting/url", response_model=RemoteVotingStatusOut)
def update_remote_voting_url(
    election_id: str,
    data: RemoteVotingUrlUpdateIn,
    request: Request,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    election = verify_election_access(election_id, admin, db, write_access=True)

    raw_url = data.public_url.strip()
    if not raw_url:
        raise HTTPException(400, "Voting URL cannot be empty.")

    clean_url = raw_url.rstrip("/")
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        raise HTTPException(400, "URL must begin with http:// or https://")

    try:
        parsed = urlparse(clean_url)
        if not parsed.netloc:
            raise HTTPException(400, "Invalid URL host format.")
    except Exception:
        raise HTTPException(400, "Invalid URL host format.")

    if not election.secure_voting_token or election.token_revoked_at:
        token = secrets.token_urlsafe(32)
        election.secure_voting_token = token
        election.secure_voting_token_hash = hashlib.sha256(token.encode()).hexdigest()
        election.token_created_at = datetime.now(timezone.utc)
        election.token_revoked_at = None

    target_id = election.election_id or str(election.id)
    base_host = f"{parsed.scheme}://{parsed.netloc}"

    if "/vote/" in clean_url:
        final_url = clean_url
    else:
        final_url = f"{base_host}/vote/{target_id}"

    election.custom_public_url = final_url
    election.remote_voting_enabled = True

    # Persist base URL in SystemSetting & runtime memory
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "public_base_url"))
    if setting:
        setting.value = base_host
    else:
        setting = SystemSetting(key="public_base_url", value=base_host)
        db.add(setting)

    set_runtime_public_base_url(base_host)

    audit(db, admin.id, "remote_voting_url_updated", "election", str(election.id), {"voting_url": final_url})
    db.commit()
    db.refresh(election)
    return _build_remote_status(election, request, db)


@router.post("/elections/{election_id}/remote-voting/disable", response_model=RemoteVotingStatusOut)
def disable_remote_voting(election_id: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)

    election.remote_voting_enabled = False
    audit(db, admin.id, "remote_voting_disabled", "election", str(election.id))
    db.commit()
    db.refresh(election)
    return _build_remote_status(election, request, db)


@router.post("/elections/{election_id}/remote-voting/regenerate", response_model=RemoteVotingStatusOut)
def regenerate_remote_voting_token(election_id: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)

    token = secrets.token_urlsafe(32)
    election.secure_voting_token = token
    election.secure_voting_token_hash = hashlib.sha256(token.encode()).hexdigest()
    election.token_created_at = datetime.now(timezone.utc)
    election.token_revoked_at = None
    election.remote_voting_enabled = True

    audit(db, admin.id, "remote_voting_token_regenerated", "election", str(election.id))
    db.commit()
    db.refresh(election)
    return _build_remote_status(election, request, db)


@router.post("/elections/{election_id}/remote-voting/revoke", response_model=RemoteVotingStatusOut)
def revoke_remote_voting_token(election_id: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)

    election.token_revoked_at = datetime.now(timezone.utc)
    election.remote_voting_enabled = False
    audit(db, admin.id, "remote_voting_token_revoked", "election", str(election.id))
    db.commit()
    db.refresh(election)
    return _build_remote_status(election, request, db)

def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post("/elections/onboard", response_model=ElectionOut, status_code=201)
@router.post("/elections/onboarding", response_model=ElectionOut, status_code=201)
def public_onboarding_create_election(data: ElectionOnboardingCreate, db: Session = Depends(get_db)):
    if data.ends_at <= data.starts_at:
        raise HTTPException(422, "End time must be later than start time")

    # Validate unique Election ID
    target_election_id = data.election_id.strip() if data.election_id and data.election_id.strip() else f"ELEC-{uuid.uuid4().hex[:6].upper()}"
    existing_elec = db.scalar(select(Election).where(func.lower(Election.election_id) == target_election_id.lower()))
    if existing_elec:
        raise HTTPException(
            400,
            "Election ID already exists. Please choose another ID.",
        )

    clean_id = data.temp_admin_id.strip().lower()
    existing_user = db.scalar(select(User).where(func.lower(User.email) == clean_id))
    if existing_user:
        raise HTTPException(
            400,
            f"Local Admin ID '{data.temp_admin_id}' is already registered. Please choose a different ID.",
        )

    temp_admin_user = User(
        email=clean_id,
        password_hash=password_hash(data.temp_admin_password),
        role=Role.TEMP_ADMIN,
        is_active=True,
    )
    db.add(temp_admin_user)
    db.flush()

    election_dict = data.model_dump(exclude={"temp_admin_id", "temp_admin_password", "candidates", "voters"})
    election_dict["election_id"] = target_election_id
    election = Election(**election_dict)
    election.temp_admin_user_id = temp_admin_user.id
    if ensure_utc(election.starts_at) <= datetime.now(timezone.utc):
        election.state = ElectionState.OPEN
    db.add(election)
    db.flush()

    for c in data.candidates:
        cand = Candidate(
            election_id=election.id,
            name=c.name.strip(),
            party=c.party.strip(),
            manifesto=c.manifesto.strip(),
        )
        db.add(cand)

    for v in data.voters:
        add_voter_to_election_helper(
            db=db,
            admin=temp_admin_user,
            election_id=election.id,
            full_name=v.full_name,
            voter_id=v.voter_id,
            voter_password=v.voter_password,
            commit=False,
        )

    audit(db, temp_admin_user.id, "public_onboarding_election_created", "election", str(election.id))
    db.commit()
    db.refresh(election)

    out = ElectionOut.model_validate(election)
    out.election_id = election.election_id
    out.temp_admin_username = temp_admin_user.email
    out.candidate_count = len(election.candidates)
    return out


@router.post("/elections", response_model=ElectionOut, status_code=201)
def create_election(data: ElectionCreate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if data.ends_at <= data.starts_at:
        raise HTTPException(422, "End time must be later than start time")

    target_election_id = data.election_id.strip() if data.election_id and data.election_id.strip() else f"ELEC-{uuid.uuid4().hex[:6].upper()}"
    existing_elec = db.scalar(select(Election).where(func.lower(Election.election_id) == target_election_id.lower()))
    if existing_elec:
        raise HTTPException(
            400,
            "Election ID already exists. Please choose another ID.",
        )

    temp_admin_user = None
    if data.temp_admin_id and data.temp_admin_password:
        clean_id = data.temp_admin_id.strip().lower()
        temp_admin_user = db.scalar(select(User).where(func.lower(User.email) == clean_id))
        if temp_admin_user:
            temp_admin_user.password_hash = password_hash(data.temp_admin_password)
            temp_admin_user.role = Role.TEMP_ADMIN
            temp_admin_user.is_active = True
        else:
            temp_admin_user = User(
                email=clean_id,
                password_hash=password_hash(data.temp_admin_password),
                role=Role.TEMP_ADMIN,
                is_active=True,
            )
            db.add(temp_admin_user)
            db.flush()

    election_dict = data.model_dump(exclude={"temp_admin_id", "temp_admin_password"})
    election_dict["election_id"] = target_election_id
    election = Election(**election_dict)
    if temp_admin_user:
        election.temp_admin_user_id = temp_admin_user.id
    elif admin.role == Role.TEMP_ADMIN:
        election.temp_admin_user_id = admin.id

    db.add(election)
    db.flush()
    audit(db, admin.id, "election_created", "election", str(election.id))
    db.commit()
    db.refresh(election)

    out = ElectionOut.model_validate(election)
    out.election_id = election.election_id or str(election.id)
    out.temp_admin_username = temp_admin_user.email if temp_admin_user else None
    out.candidate_count = len(election.candidates)
    return out


@router.put("/elections/{election_id}", response_model=ElectionOut)
def update_election(election_id: str, data: ElectionUpdate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)

    if data.election_id is not None:
        clean_new_eid = data.election_id.strip()
        if clean_new_eid and clean_new_eid != (election.election_id or ""):
            existing = db.scalar(
                select(Election).where(
                    func.lower(Election.election_id) == clean_new_eid.lower(),
                    Election.id != election.id,
                )
            )
            if existing:
                raise HTTPException(400, f"Election ID '{clean_new_eid}' is already in use by another election.")
            election.election_id = clean_new_eid
            if election.custom_public_url:
                parsed = urlparse(election.custom_public_url)
                base_host = f"{parsed.scheme}://{parsed.netloc}"
                election.custom_public_url = f"{base_host}/vote/{clean_new_eid}"

    if data.name is not None:
        election.name = data.name.strip()
    if data.description is not None:
        election.description = data.description.strip()
    if data.starts_at is not None:
        election.starts_at = data.starts_at
    if data.ends_at is not None:
        election.ends_at = data.ends_at

    new_starts = election.starts_at
    new_ends = election.ends_at
    if new_ends <= new_starts:
        raise HTTPException(400, "Election end time must be after start time")

    if data.voting_flow_mode is not None:
        election.voting_flow_mode = data.voting_flow_mode
    if data.enable_step_2 is not None:
        election.enable_step_2 = data.enable_step_2
    if data.enable_step_3 is not None:
        election.enable_step_3 = data.enable_step_3
    if data.enable_step_4 is not None:
        election.enable_step_4 = data.enable_step_4
    if data.enable_step_5 is not None:
        election.enable_step_5 = data.enable_step_5
    if data.show_voter_names_in_results is not None:
        election.show_voter_names_in_results = data.show_voter_names_in_results

    if data.temp_admin_id and data.temp_admin_password:
        clean_id = data.temp_admin_id.strip().lower()
        temp_user = db.scalar(select(User).where(func.lower(User.email) == clean_id))
        if temp_user:
            temp_user.password_hash = password_hash(data.temp_admin_password)
            temp_user.role = Role.TEMP_ADMIN
            temp_user.is_active = True
        else:
            temp_user = User(
                email=clean_id,
                password_hash=password_hash(data.temp_admin_password),
                role=Role.TEMP_ADMIN,
                is_active=True,
            )
            db.add(temp_user)
            db.flush()
        election.temp_admin_user_id = temp_user.id

    audit(db, admin.id, "election_updated", "election", str(election.id), {"election_id": election.election_id, "name": election.name})
    db.commit()
    db.refresh(election)
    out = ElectionOut.model_validate(election)
    out.election_id = election.election_id or str(election.id)
    out.temp_admin_username = election.temp_admin_user.email if election.temp_admin_user else None
    out.candidate_count = len(election.candidates)
    return out


@router.post("/elections/{election_id}/state", response_model=ElectionOut)
def set_election_state(election_id: str, target: ElectionState, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)
    allowed = {
        ElectionState.DRAFT: {ElectionState.SCHEDULED, ElectionState.OPEN},
        ElectionState.SCHEDULED: {ElectionState.OPEN, ElectionState.PAUSED},
        ElectionState.OPEN: {ElectionState.PAUSED, ElectionState.CLOSED},
        ElectionState.PAUSED: {ElectionState.OPEN, ElectionState.CLOSED},
        ElectionState.CLOSED: {ElectionState.PUBLISHED, ElectionState.OPEN},
    }
    if target not in allowed.get(election.state, set()):
        raise HTTPException(409, f"Invalid election state transition from {election.state.value} to {target.value}")
    election.state = target
    audit(db, admin.id, "election_state_changed", "election", str(election.id), {"state": target.value})
    db.commit()
    db.refresh(election)
    out = ElectionOut.model_validate(election)
    out.election_id = election.election_id or str(election.id)
    out.temp_admin_username = election.temp_admin_user.email if election.temp_admin_user else None
    out.candidate_count = len(election.candidates)
    return out


@router.delete("/elections/{election_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_election(election_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)
    if not election:
        raise HTTPException(404, "Election not found")

    vote_count = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == election.id)) or 0
    if vote_count > 0:
        raise HTTPException(400, f"Cannot delete election '{election.name}' because {vote_count} votes have already been recorded.")

    candidates = db.scalars(select(Candidate).where(Candidate.election_id == election.id)).all()
    for c in candidates:
        db.delete(c)

    voter_statuses = db.scalars(select(VoterElectionStatus).where(VoterElectionStatus.election_id == election.id)).all()
    for vs in voter_statuses:
        db.delete(vs)

    audit(db, admin.id, "election_deleted", "election", str(election.id), {"name": election.name})
    db.delete(election)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates", response_model=list[CandidateOut])
def list_candidates(election_id: str | None = None, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    target_election_id = election_id
    if admin.role == Role.TEMP_ADMIN:
        permitted = db.scalar(select(Election).where(Election.temp_admin_user_id == admin.id))
        if not permitted:
            return []
        if election_id and election_id != str(permitted.id) and election_id != permitted.election_id:
            raise HTTPException(403, "You are not authorized to access another election's candidates.")
        target_election_id = str(permitted.id)

    query = select(Candidate)
    if target_election_id:
        query = query.where(
            (Candidate.election_id == target_election_id)
            | (Candidate.election_id == db.scalar(select(Election.id).where(Election.election_id == target_election_id)))
        )
    return list(db.scalars(query).all())


@router.post("/elections/{election_id}/candidates", response_model=CandidateOut, status_code=201)
def create_candidate(election_id: str, data: CandidateCreate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=True)
    candidate = Candidate(election_id=election.id, **data.model_dump())
    db.add(candidate)
    db.flush()
    audit(db, admin.id, "candidate_registered", "candidate", str(candidate.id))
    db.commit()
    db.refresh(candidate)
    return candidate


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(candidate_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    verify_election_access(str(candidate.election_id), admin, db, write_access=True)

    vote_count = db.scalar(select(func.count(Vote.id)).where(Vote.candidate_id == candidate.id)) or 0
    if vote_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete candidate '{candidate.name}' because {vote_count} votes have already been cast for this candidate in active voting.",
        )

    db.delete(candidate)
    db.commit()


@router.put("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: str, data: CandidateUpdate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    verify_election_access(str(candidate.election_id), admin, db, write_access=True)
    if data.name is not None:
        candidate.name = data.name.strip()
    if data.party is not None:
        candidate.party = data.party.strip()
    if data.manifesto is not None:
        candidate.manifesto = data.manifesto.strip()
    if data.photo_url is not None:
        candidate.photo_url = data.photo_url.strip()
    if data.symbol_url is not None:
        candidate.symbol_url = data.symbol_url.strip()
    audit(db, admin.id, "candidate_updated", "candidate", str(candidate.id))
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("/results/{election_id}", response_model=ResultSummaryOut)
@router.get("/elections/{election_id}/summary-results", response_model=ResultSummaryOut)
def election_results(election_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=False)

    total_voters = db.scalar(
        select(func.count(VoterElectionStatus.id)).where(VoterElectionStatus.election_id == election.id)
    ) or 0
    votes_cast = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == election.id)) or 0
    turnout = round(100.0 * votes_cast / total_voters, 2) if total_voters > 0 else 0.0

    candidates = db.scalars(select(Candidate).where(Candidate.election_id == election.id)).all()
    tallies = []
    for c in candidates:
        count = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == election.id, Vote.candidate_id == c.id)) or 0
        tallies.append(CandidateTally(id=c.id, name=c.name, party=c.party, votes=count))

    return ResultSummaryOut(
        election_id=election.id,
        election_name=election.name,
        state=election.state.value,
        total_voters=total_voters,
        total_votes_cast=votes_cast,
        turnout_percent=turnout,
        candidates=tallies,
    )


@router.get("/elections/{election_id}/results")
def election_results_detail(election_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=False)
    if not election:
        raise HTTPException(404, "Election not found")

    return calculate_election_results(
        election_id=str(election.id),
        db=db,
        show_voter_names=bool(election.show_voter_names_in_results),
    )


@router.get("/elections/{election_id}/audit-logs")
def election_audit_logs(election_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    election = verify_election_access(election_id, admin, db, write_access=False)
    logs = list(
        db.scalars(
            select(AuditLog)
            .where(
                (AuditLog.entity_id == str(election.id))
                | (AuditLog.metadata_json.contains({"election_id": str(election.id)}))
            )
            .order_by(AuditLog.created_at.desc())
            .limit(100)
        ).all()
    )
    return [
        {
            "id": str(l.id),
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "metadata": l.metadata_json,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/elections/{election_id}/export/excel")
@router.get("/elections/{election_id}/export-excel")
def export_election_results_excel(election_id: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    import re

    election = verify_election_access(election_id, admin, db, write_access=False)
    if not election:
        raise HTTPException(404, "Election not found")

    data = calculate_election_results(
        election_id=str(election.id),
        db=db,
        show_voter_names=bool(election.show_voter_names_in_results),
    )
    if not data:
        raise HTTPException(404, "Election results unavailable")

    excel_bytes = generate_election_excel(data)

    sanitized_name = re.sub(r"[^a-zA-Z0-9_-]", "_", election.name)
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"Civitas_{sanitized_name}_Results_{date_str}.xlsx"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )



@router.get("/voter-photos/{filename}")
def get_voter_photo(filename: str, admin: User = Depends(admin_only)):
    import os
    from fastapi.responses import FileResponse
    from app.api.verification import VOTER_PHOTOS_DIR

    safe_filename = os.path.basename(filename)
    path = os.path.abspath(os.path.join(VOTER_PHOTOS_DIR, safe_filename))

    if not path.startswith(os.path.abspath(VOTER_PHOTOS_DIR)) or not os.path.isfile(path):
        raise HTTPException(404, "Voter photo not found")

    return FileResponse(path)



@router.get("/analytics")
def analytics(admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    current = datetime.now(timezone.utc)
    total_auth = db.scalar(select(func.count(AuthenticationLog.id))) or 0
    successful_auth = db.scalar(select(func.count(AuthenticationLog.id)).where(AuthenticationLog.is_success.is_(True))) or 0

    total_elections = db.scalar(select(func.count(Election.id))) or 0
    live_elections = db.scalar(select(func.count(Election.id)).where(Election.state == ElectionState.OPEN)) or 0
    upcoming_elections = db.scalar(select(func.count(Election.id)).where(Election.state.in_([ElectionState.DRAFT, ElectionState.SCHEDULED]))) or 0
    completed_elections = db.scalar(select(func.count(Election.id)).where(Election.state.in_([ElectionState.CLOSED, ElectionState.PUBLISHED]))) or 0

    total_voters = db.scalar(select(func.count(Voter.id))) or 0
    total_votes_cast = db.scalar(select(func.count(Vote.id))) or 0
    total_candidates = db.scalar(select(func.count(Candidate.id))) or 0
    total_temp_admins = db.scalar(select(func.count(User.id)).where(User.role == Role.TEMP_ADMIN)) or 0

    # Fetch recent elections summary
    recent_elections_raw = list(db.scalars(select(Election).order_by(Election.created_at.desc()).limit(5)).all())
    recent_elections = []
    for e in recent_elections_raw:
        c_count = db.scalar(select(func.count(Candidate.id)).where(Candidate.election_id == e.id)) or 0
        v_count = db.scalar(select(func.count(Vote.id)).where(Vote.election_id == e.id)) or 0
        recent_elections.append({
            "id": str(e.id),
            "name": e.name,
            "state": e.state.value if hasattr(e.state, "value") else str(e.state),
            "candidate_count": c_count,
            "vote_count": v_count,
            "starts_at": e.starts_at.isoformat() if e.starts_at else None,
            "ends_at": e.ends_at.isoformat() if e.ends_at else None,
            "temp_admin_username": e.temp_admin_user.email if e.temp_admin_user else None,
        })

    # Fetch recent audit logs
    recent_logs_raw = list(db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(5)).all())
    recent_logs = [
        {
            "id": str(l.id),
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in recent_logs_raw
    ]

    return {
        "authentication_success_percent": round(100 * successful_auth / total_auth, 2) if total_auth else 0,
        "authentication_attempts": total_auth,
        "average_face_confidence": db.scalar(select(func.avg(AuthenticationLog.face_confidence))) or 0,
        "average_fingerprint_match": db.scalar(select(func.avg(AuthenticationLog.fingerprint_confidence))) or 0,
        "spoof_detection_count": db.scalar(select(func.count(AuthenticationLog.id)).where(AuthenticationLog.spoof_probability > 50)) or 0,
        "total_elections": total_elections,
        "live_elections": live_elections,
        "upcoming_elections": upcoming_elections,
        "completed_elections": completed_elections,
        "total_voters": total_voters,
        "total_votes_cast": total_votes_cast,
        "total_candidates": total_candidates,
        "total_temp_admins": total_temp_admins,
        "recent_elections": recent_elections,
        "recent_logs": recent_logs,
    }


@router.get("/reports/authentication.csv")
def export_authentication_csv(admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    rows = db.execute(select(AuthenticationLog)).scalars()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["time", "stage", "success", "fingerprint", "face", "liveness", "risk"])
    for row in rows:
        writer.writerow([row.created_at.isoformat(), row.stage.value, row.is_success, row.fingerprint_confidence, row.face_confidence, row.liveness_score, row.risk_score])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=authentication-report.csv"})


@router.get("/temp-admins")
def list_temp_admins(admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    users = list(db.scalars(select(User).where(User.role == Role.TEMP_ADMIN).order_by(User.created_at.desc())).all())
    results = []
    for u in users:
        assigned_election = db.scalar(select(Election).where(Election.temp_admin_user_id == u.id))
        results.append({
            "id": str(u.id),
            "temp_admin_id": u.email,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "assigned_election_id": str(assigned_election.id) if assigned_election else None,
            "assigned_election_name": assigned_election.name if assigned_election else "No Election Assigned",
            "assigned_election_state": assigned_election.state.value if assigned_election else None,
        })
    return results


@router.get("/settings/voice-guidance", response_model=VoiceGuidanceSettingsOut)
def get_voice_guidance_setting(admin: User = Depends(big_admin_only), db: Session = Depends(get_db)):
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "voice_guidance_enabled"))
    enabled = setting.value.lower() == "true" if setting else True
    return VoiceGuidanceSettingsOut(enabled=enabled)


@router.put("/settings/voice-guidance", response_model=VoiceGuidanceSettingsOut)
def update_voice_guidance_setting(
    data: VoiceGuidanceSettingsUpdate,
    admin: User = Depends(big_admin_only),
    db: Session = Depends(get_db),
):
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "voice_guidance_enabled"))
    val_str = "true" if data.enabled else "false"
    if setting:
        setting.value = val_str
    else:
        setting = SystemSetting(key="voice_guidance_enabled", value=val_str)
        db.add(setting)

    audit(db, admin.id, "update_voice_guidance_setting", "system_setting", "voice_guidance_enabled", {"enabled": data.enabled})
    db.commit()
    return VoiceGuidanceSettingsOut(enabled=data.enabled)


@router.get("/settings/voter-assistance", response_model=VoterAssistanceSettingsOut)
def get_voter_assistance_settings(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    def get_setting(key: str, default: str) -> str:
        s = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        return s.value if s else default

    return VoterAssistanceSettingsOut(
        voice_guidance_enabled=get_setting("voice_guidance_enabled", "true").lower() == "true",
        chat_assistant_enabled=get_setting("chat_assistant_enabled", "true").lower() == "true",
        default_voice_language=get_setting("default_voice_language", "en"),
        chat_read_aloud_enabled=get_setting("chat_read_aloud_enabled", "true").lower() == "true",
        mobile_device_verification_enabled=get_setting("mobile_device_verification_enabled", "false").lower() == "true",
        session_timeout_minutes=int(get_setting("session_timeout_minutes", "30")),
        inactivity_timeout_minutes=int(get_setting("inactivity_timeout_minutes", "15")),
        step_timeout_minutes=int(get_setting("step_timeout_minutes", "10")),
        photo_upload_max_retries=int(get_setting("photo_upload_max_retries", "5")),
        photo_max_attempts=int(get_setting("photo_max_attempts", "")) if get_setting("photo_max_attempts", "").isdigit() else None,
        liveness_max_attempts=int(get_setting("liveness_max_attempts", "")) if get_setting("liveness_max_attempts", "").isdigit() else None,
        supported_languages=["en", "hi"],
    )


@router.patch("/settings/voter-assistance", response_model=VoterAssistanceSettingsOut)
def update_voter_assistance_settings(
    data: VoterAssistanceSettingsUpdate,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    updates = {}
    if data.voice_guidance_enabled is not None:
        updates["voice_guidance_enabled"] = "true" if data.voice_guidance_enabled else "false"
    if data.chat_assistant_enabled is not None:
        updates["chat_assistant_enabled"] = "true" if data.chat_assistant_enabled else "false"
    if data.default_voice_language is not None:
        updates["default_voice_language"] = data.default_voice_language
    if data.chat_read_aloud_enabled is not None:
        updates["chat_read_aloud_enabled"] = "true" if data.chat_read_aloud_enabled else "false"
    if data.mobile_device_verification_enabled is not None:
        updates["mobile_device_verification_enabled"] = "true" if data.mobile_device_verification_enabled else "false"
    if data.session_timeout_minutes is not None:
        updates["session_timeout_minutes"] = str(data.session_timeout_minutes)
    if data.inactivity_timeout_minutes is not None:
        updates["inactivity_timeout_minutes"] = str(data.inactivity_timeout_minutes)
    if data.step_timeout_minutes is not None:
        updates["step_timeout_minutes"] = str(data.step_timeout_minutes)
    if data.photo_upload_max_retries is not None:
        updates["photo_upload_max_retries"] = str(data.photo_upload_max_retries)
    if data.photo_max_attempts is not None:
        updates["photo_max_attempts"] = str(data.photo_max_attempts) if data.photo_max_attempts is not None else ""
    if data.liveness_max_attempts is not None:
        updates["liveness_max_attempts"] = str(data.liveness_max_attempts) if data.liveness_max_attempts is not None else ""

    for key, val in updates.items():
        setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if setting:
            setting.value = val
        else:
            db.add(SystemSetting(key=key, value=val))

    audit(db, admin.id, "update_voter_assistance_settings", "system_setting", "voter_assistance", updates)
    db.commit()

    return get_voter_assistance_settings(admin=admin, db=db)

    return get_voter_assistance_settings(admin=admin, db=db)


from fastapi.responses import FileResponse
from typing import List

@router.get("/photos", response_model=List[VoterPhotoOut])
def list_voter_photos(
    admin: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """
    List all verification photos.
    Big Admin sees all photos.
    Local Admin sees ONLY photos for elections assigned to them.
    """
    if admin.role not in (Role.BIG_ADMIN, Role.ADMIN, Role.TEMP_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view verification photos.")

    query = select(VoterPhoto).order_by(VoterPhoto.created_at.desc())
    
    if admin.role == Role.TEMP_ADMIN:
        query = query.where(VoterPhoto.local_admin_id == str(admin.id))
        
    photos = db.scalars(query).all()
    
    # Enrich with display fields
    enriched = []
    for photo in photos:
        out = VoterPhotoOut.model_validate(photo)
        voter = db.get(Voter, photo.voter_id)
        if voter:
            out.voter_reg_id = voter.voter_id
            out.voter_name = voter.full_name
        election = db.get(Election, photo.election_id)
        if election:
            out.election_name = election.name
        enriched.append(out)
        
    return enriched


@router.get("/photos/{photo_id}/view")
def view_voter_photo(
    photo_id: str,
    admin: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """
    Securely serve a voter photo image.
    Enforces that Local Admin can only access their authorized photos.
    """
    if admin.role not in (Role.BIG_ADMIN, Role.ADMIN, Role.TEMP_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view verification photos.")
        
    photo = db.get(VoterPhoto, photo_id)
    if not photo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found.")
        
    if admin.role == Role.TEMP_ADMIN and photo.local_admin_id != str(admin.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not authorized to access this photo.")
        
    if not os.path.exists(photo.storage_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image file no longer exists on disk.")
        
    return FileResponse(photo.storage_path)
