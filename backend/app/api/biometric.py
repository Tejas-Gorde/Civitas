import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_token
from app.api.rate_limit import public_rate_limit
from app.models import AuthSession, AuthStage, AuthenticationLog, Election, ElectionState, FingerprintTemplate, SystemSetting, Voter, VoterElectionStatus
from app.schemas import AuthProgress, BiometricStart, ChallengePayload, FingerprintResult, FramePayload
from app.services.biometrics import BiometricError, assess_liveness, check_challenge, cosine_similarity, decode_frame, decrypt_embedding, facenet_embedding

router = APIRouter(prefix="/biometric", tags=["Biometric authentication"])
settings = get_settings()
CHALLENGES = ("blink", "smile", "turn_left", "turn_right", "open_mouth", "raise_eyebrows")


def now() -> datetime: return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def get_system_setting(db: Session, key: str, default: str) -> str:
    s = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    return s.value if s else default


def validate_and_touch_session(db: Session, session_id: UUID, expected: AuthStage | None = None) -> AuthSession:
    session = db.get(AuthSession, str(session_id))
    if not session or session.closed_at:
        raise HTTPException(401, "Your voting session has expired. Please restart verification.")

    current = now()
    session_timeout = int(get_system_setting(db, "session_timeout_minutes", "30"))
    inactivity_timeout = int(get_system_setting(db, "inactivity_timeout_minutes", "15"))

    created = ensure_utc(session.created_at) if hasattr(session, "created_at") and session.created_at else current
    last_act = ensure_utc(session.updated_at) if hasattr(session, "updated_at") and session.updated_at else created

    if current > created + timedelta(minutes=session_timeout):
        session.closed_at = current
        db.commit()
        raise HTTPException(401, "Your voting session has expired. Please restart verification.")

    if current > last_act + timedelta(minutes=inactivity_timeout):
        session.closed_at = current
        db.commit()
        raise HTTPException(401, "Your voting session has expired. Please restart verification.")

    if ensure_utc(session.expires_at) < current:
        session.closed_at = current
        db.commit()
        raise HTTPException(401, "Your voting session has expired. Please restart verification.")

    if expected and session.stage != expected:
        raise HTTPException(409, f"Expected {expected.value} stage")

    new_expires = min(created + timedelta(minutes=session_timeout), current + timedelta(minutes=inactivity_timeout))
    session.expires_at = new_expires
    session.updated_at = current
    db.flush()

    return session


def session_for(db: Session, session_id: UUID, expected: AuthStage) -> AuthSession:
    return validate_and_touch_session(db, session_id, expected)


def event(db: Session, session: AuthSession, stage: AuthStage, ok: bool, **metrics) -> None:
    db.add(AuthenticationLog(voter_id=session.voter_id, election_id=session.election_id, stage=stage, is_success=ok, fingerprint_confidence=metrics.get("fingerprint"), face_confidence=metrics.get("face"), liveness_score=metrics.get("liveness"), spoof_probability=metrics.get("spoof"), risk_score=metrics.get("risk"), detail=metrics.get("detail", {})))


def fail(db: Session, session: AuthSession, message: str, stage: AuthStage, **metrics):
    session.stage = AuthStage.FAILED; session.closed_at = now(); event(db, session, stage, False, **metrics); db.commit()
    raise HTTPException(401, message)


@router.post("/start", response_model=AuthProgress)
def start(data: BiometricStart, _: None = Depends(public_rate_limit), db: Session = Depends(get_db)):
    voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == data.voter_id.strip().lower()))
    election = db.get(Election, str(data.election_id))
    if not voter or not election or election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= now() <= ensure_utc(election.ends_at)):
        raise HTTPException(401, "Voter or active election unavailable")
    
    if data.full_name and voter.full_name.strip().lower() != data.full_name.strip().lower():
        raise HTTPException(400, f"Full name '{data.full_name}' does not match registered voter records for ID '{voter.voter_id}'")

    status_row = db.scalar(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == voter.id, VoterElectionStatus.election_id == election.id))
    if status_row and status_row.voted_at:
        raise HTTPException(409, "You have already cast a ballot for this election")

    session_timeout = int(get_system_setting(db, "session_timeout_minutes", "30"))
    inactivity_timeout = int(get_system_setting(db, "inactivity_timeout_minutes", "15"))
    start_time = now()
    exp_time = min(start_time + timedelta(minutes=session_timeout), start_time + timedelta(minutes=inactivity_timeout))

    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=exp_time,
        created_at=start_time,
        updated_at=start_time,
    )
    db.add(session); db.flush(); event(db, session, AuthStage.IDENTIFIED, True); db.commit()
    return AuthProgress(session_id=session.id, stage=session.stage.value)


@router.get("/{session_id}", response_model=AuthProgress)
def progress(session_id: UUID, db: Session = Depends(get_db)):
    session = validate_and_touch_session(db, session_id)
    return AuthProgress(
        session_id=session.id,
        stage=session.stage.value,
        challenge=session.challenge,
        metrics={
            **session.metrics,
            "expires_at": ensure_utc(session.expires_at).isoformat(),
        },
    )


@router.post("/fingerprint", response_model=AuthProgress)
def fingerprint(data: FingerprintResult, x_hardware_token: str = Header(default=""), db: Session = Depends(get_db)):
    if not secrets.compare_digest(x_hardware_token, settings.hardware_bridge_token):
        raise HTTPException(403, "Fingerprint result must originate from the authorized hardware bridge")
    session = session_for(db, data.session_id, AuthStage.IDENTIFIED)
    template = db.scalar(select(FingerprintTemplate).where(FingerprintTemplate.voter_id == session.voter_id))
    if not template or template.sensor_template_id != data.sensor_template_id or template.sensor_serial != data.sensor_serial or data.sensor_score < settings.fingerprint_threshold:
        fail(db, session, "Fingerprint verification failed", AuthStage.FINGERPRINT, fingerprint=data.sensor_score)
    session.stage = AuthStage.FINGERPRINT; session.metrics = {**session.metrics, "fingerprint": data.sensor_score}; event(db, session, AuthStage.FINGERPRINT, True, fingerprint=data.sensor_score); db.commit()
    return AuthProgress(session_id=session.id, stage=session.stage.value, metrics=session.metrics)


@router.post("/face", response_model=AuthProgress)
def face(data: FramePayload, _: None = Depends(public_rate_limit), db: Session = Depends(get_db)):
    session = session_for(db, data.session_id, AuthStage.FINGERPRINT)
    try:
        embedding = facenet_embedding(decode_frame(data.image))
        stored = db.scalar(select(Voter).where(Voter.id == session.voter_id)).face_embedding
        confidence = round(100 * max(0, cosine_similarity(embedding, decrypt_embedding(stored.embedding_ciphertext))), 2)
    except BiometricError as error:
        fail(db, session, str(error), AuthStage.FACE)
    if confidence < settings.face_threshold * 100:
        fail(db, session, "Face verification failed", AuthStage.FACE, face=confidence)
    session.stage = AuthStage.FACE; session.metrics = {**session.metrics, "face": confidence}; event(db, session, AuthStage.FACE, True, face=confidence); db.commit()
    return AuthProgress(session_id=session.id, stage=session.stage.value, metrics=session.metrics)


@router.post("/liveness", response_model=AuthProgress)
def liveness(_: FramePayload):
    raise HTTPException(410, "Liveness endpoint is deprecated. The voter verification flow uses direct Challenge verification.")


@router.post("/challenge", response_model=AuthProgress)
def challenge(data: ChallengePayload, _: None = Depends(public_rate_limit), db: Session = Depends(get_db)):
    session = session_for(db, data.session_id, AuthStage.FACE)
    session.challenge = data.observed_action or "shake_hand"
    session.stage = AuthStage.CHALLENGE
    session.metrics = {**session.metrics, "challenge_completed": True}
    event(db, session, AuthStage.CHALLENGE, True, detail={"challenge": session.challenge, "challenge_completed": True})
    db.commit()
    return AuthProgress(session_id=session.id, stage=session.stage.value, challenge=session.challenge)


@router.post("/risk", response_model=AuthProgress)
def risk(session_id: UUID, db: Session = Depends(get_db)):
    session = validate_and_touch_session(db, session_id)
    election = db.get(Election, session.election_id) if session.election_id else None

    # Enforce election-specific pre-voting verification requirements
    if election and election.voting_flow_mode != "direct":
        if election.enable_step_3 and not session.metrics.get("photo_captured") and session.stage not in (AuthStage.FACE, AuthStage.CHALLENGE, AuthStage.GRANTED):
            raise HTTPException(403, "Photo capture verification is required for this election.")
        if election.enable_step_4 and not session.metrics.get("challenge_completed") and session.stage not in (AuthStage.CHALLENGE, AuthStage.GRANTED):
            raise HTTPException(403, "Challenge verification is required for this election.")

    metrics = session.metrics
    fingerprint_val = metrics.get("fingerprint", 100.0)
    face_val = metrics.get("face", 100.0)
    risk_score = round((100 - fingerprint_val) * 0.4 + (100 - face_val) * 0.6, 2)
    if risk_score > settings.risk_threshold:
        fail(db, session, "Authentication risk exceeds the permitted threshold", AuthStage.RISK, risk=risk_score)
    session.stage = AuthStage.GRANTED
    grant = create_token(session.voter_id, "voter", "voting", timedelta(minutes=3), session.id)
    import hashlib

    session.issued_grant_hash = hashlib.sha256(grant.encode()).hexdigest()
    session.metrics = {**metrics, "risk": risk_score}
    event(db, session, AuthStage.RISK, True, risk=risk_score)
    event(db, session, AuthStage.GRANTED, True, risk=risk_score)
    db.commit()
    return AuthProgress(session_id=session.id, stage=session.stage.value, metrics=session.metrics, voting_grant=grant)

