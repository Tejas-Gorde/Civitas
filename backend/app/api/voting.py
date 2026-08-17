import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models import AuditLog, AuthSession, AuthStage, Candidate, Election, ElectionState, SystemSetting, User, Vote, Voter, VoterElectionStatus
from app.schemas import CandidateOut, CastVote, ElectionOut, VoteReceipt, VoterVerifyRequest, VoterVerifyResponse, VoiceGuidanceSettingsOut, VoterAssistanceSettingsOut

router = APIRouter(prefix="/voting", tags=["Voting"])
settings = get_settings()


@router.get("/settings/voice-guidance", response_model=VoiceGuidanceSettingsOut)
def get_public_voice_guidance_setting(db: Session = Depends(get_db)):
    setting = db.scalar(select(SystemSetting).where(SystemSetting.key == "voice_guidance_enabled"))
    enabled = setting.value.lower() == "true" if setting else True
    return VoiceGuidanceSettingsOut(enabled=enabled)


@router.get("/settings/voter-assistance", response_model=VoterAssistanceSettingsOut)
def get_public_voter_assistance_settings(db: Session = Depends(get_db)):
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




def ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


@router.get("/access/{token}", response_model=ElectionOut)
def validate_voting_access_token(token: str, db: Session = Depends(get_db)):
    token_str = token.strip()
    if not token_str:
        raise HTTPException(400, "Invalid access token")

    election = db.scalar(
        select(Election).where(
            (Election.secure_voting_token == token_str) |
            (func.lower(Election.id) == token_str.lower()) |
            (func.lower(Election.election_id) == token_str.lower())
        )
    )
    if not election:
        audit_entry = AuditLog(
            action="remote_voting_invalid_token_attempt",
            entity_type="election_token",
            entity_id=token_str[:16],
            metadata_json={"reason": "nonexistent_token"},
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(404, "Invalid or expired secure voting link.")

    if election.token_revoked_at:
        audit_entry = AuditLog(
            action="remote_voting_invalid_token_attempt",
            entity_type="election_token",
            entity_id=str(election.id),
            metadata_json={"reason": "revoked_token"},
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(410, "This remote voting link has been revoked by the administrator.")

    if not election.remote_voting_enabled:
        audit_entry = AuditLog(
            action="remote_voting_invalid_token_attempt",
            entity_type="election_token",
            entity_id=str(election.id),
            metadata_json={"reason": "remote_voting_disabled"},
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(403, "Remote voting is currently disabled for this election.")

    current = datetime.now(timezone.utc)
    if election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= current <= ensure_utc(election.ends_at)):
        audit_entry = AuditLog(
            action="remote_voting_invalid_token_attempt",
            entity_type="election_token",
            entity_id=str(election.id),
            metadata_json={"reason": "election_not_open", "state": election.state.value if hasattr(election.state, 'value') else election.state},
        )
        db.add(audit_entry)
        db.commit()
        raise HTTPException(400, f"Election '{election.name}' is currently {election.state.value if hasattr(election.state, 'value') else election.state} and not open for voting.")

    # Record remote voting session started audit log
    audit_entry = AuditLog(
        action="remote_voting_session_started",
        entity_type="election",
        entity_id=str(election.id),
        metadata_json={"election_name": election.name},
    )
    db.add(audit_entry)
    db.commit()

    election.has_active_token = True
    return election


@router.get("/elections", response_model=list[ElectionOut])
@router.get("/live-elections", response_model=list[ElectionOut])
def elections(db: Session = Depends(get_db)):
    elections_list = list(db.scalars(select(Election).where(Election.state == ElectionState.OPEN)))
    res = []
    for e in elections_list:
        out = ElectionOut.model_validate(e)
        out.election_id = e.election_id or str(e.id)
        out.has_active_token = bool(e.secure_voting_token and not e.token_revoked_at)
        out.temp_admin_username = e.temp_admin_user.email if e.temp_admin_user else None
        out.candidate_count = len(e.candidates)
        res.append(out)
    return res


@router.get("/elections/{election_id}/candidates", response_model=list[CandidateOut])
def candidates(election_id: UUID, db: Session = Depends(get_db)):
    return list(db.scalars(select(Candidate).where(Candidate.election_id == str(election_id))))


@router.get("/verify-election/{election_identifier}", response_model=ElectionOut)
def verify_public_election(election_identifier: str, db: Session = Depends(get_db)):
    clean_id = election_identifier.strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(404, f"Election '{clean_id}' not found. Please check the Election ID.")
    current = datetime.now(timezone.utc)
    if election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= current <= ensure_utc(election.ends_at)):
        raise HTTPException(400, f"Election '{election.name}' ({election.election_id or election.id}) is not currently active.")

    out = ElectionOut.model_validate(election)
    out.election_id = election.election_id or str(election.id)
    out.candidate_count = len(election.candidates)
    return out


@router.post("/verify-voter", response_model=VoterVerifyResponse)
def verify_voter(data: VoterVerifyRequest, db: Session = Depends(get_db)):
    current = datetime.now(timezone.utc)
    clean_id = str(data.election_id).strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(404, "Election not found.")
    if election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= current <= ensure_utc(election.ends_at)):
        raise HTTPException(400, "Election is not currently active.")

    voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == data.voter_registration_id.strip().lower()))
    if not voter:
        raise HTTPException(401, "Invalid voter ID or password.")

    user = db.get(User, voter.user_id)
    if not user or not user.is_active:
        raise HTTPException(403, "Voter account is inactive or not eligible to vote")

    if not data.voter_password or not data.voter_password.strip():
        raise HTTPException(400, "Voter password is required.")

    from app.core.security import password_verify
    if not password_verify(data.voter_password.strip(), user.password_hash):
        raise HTTPException(401, "Invalid voter ID or password.")

    status_row = db.scalar(
        select(VoterElectionStatus).where(
            VoterElectionStatus.voter_id == voter.id,
            VoterElectionStatus.election_id == election.id,
        )
    )

    if not status_row or not status_row.eligible:
        raise HTTPException(
            403,
            "You are not authorized to access this election.",
        )

    if status_row.voted_at:
        raise HTTPException(409, "You have already cast a ballot for this election")

    # Start authentication session
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=current + timedelta(minutes=settings.max_authentication_minutes),
    )
    db.add(session)
    db.commit()

    return VoterVerifyResponse(
        eligible=True,
        message="Voter eligibility verified",
        voter_id=voter.voter_id,
        voter_internal_id=voter.id,
        session_id=session.id,
    )


@router.post("/cast", response_model=VoteReceipt, status_code=201)
def cast_vote(data: CastVote, db: Session = Depends(get_db)):
    payload = decode_token(data.voting_grant, "voting")
    session = db.get(AuthSession, str(UUID(payload["sid"])))
    token_hash = hashlib.sha256(data.voting_grant.encode()).hexdigest()
    if not session or session.stage != AuthStage.GRANTED or session.closed_at or session.issued_grant_hash != token_hash or session.election_id != str(data.election_id):
        raise HTTPException(401, "Invalid or already-consumed voting grant")

    election = db.get(Election, str(data.election_id))
    candidate = db.get(Candidate, str(data.candidate_id))
    current = datetime.now(timezone.utc)
    if not election or election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= current <= ensure_utc(election.ends_at)) or not candidate or candidate.election_id != election.id:
        raise HTTPException(409, "This ballot is no longer available")

    # Lock identity status, then sever identity from the actual ballot record.
    status_row = db.scalar(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == session.voter_id, VoterElectionStatus.election_id == election.id).with_for_update())
    if status_row and status_row.voted_at:
        raise HTTPException(409, "A ballot was already cast for this election")
    if not status_row:
        status_row = VoterElectionStatus(voter_id=session.voter_id, election_id=election.id)
        db.add(status_row)

    receipt = secrets.token_urlsafe(24)
    vote = Vote(election_id=election.id, candidate_id=candidate.id, receipt_id=receipt)
    db.add(vote)
    status_row.voted_at = current
    session.closed_at = current
    session.issued_grant_hash = None
    db.commit()
    db.refresh(vote)
    return VoteReceipt(receipt_id=vote.receipt_id, cast_at=vote.cast_at)


@router.post("/sessions/{session_id}/photo")
async def upload_session_photo(
    session_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    session = db.get(AuthSession, str(session_id))
    if not session:
        raise HTTPException(404, "Verification session not found.")
    from app.api.verification import save_voter_photo_file
    res = save_voter_photo_file(db, session, file)
    return {
        "status": "ok",
        "stage": session.stage.value,
        "message": res["message"],
        "photo_id": res["photo_id"],
        "filename": res["filename"],
        "success": True,
    }


