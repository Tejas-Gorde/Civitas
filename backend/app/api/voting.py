import hashlib
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token, password_hash
from app.models import (
    AuditLog,
    AuthSession,
    AuthStage,
    Candidate,
    Election,
    ElectionState,
    QuickVoterRecord,
    Role,
    SystemSetting,
    User,
    Vote,
    Voter,
    VoterElectionStatus,
)
from app.schemas import (
    CandidateOut,
    CastVote,
    ElectionOut,
    QuickVoterVerifyRequest,
    QuickVoterVerifyResponse,
    VoteReceipt,
    VoterVerifyRequest,
    VoterVerifyResponse,
    VoiceGuidanceSettingsOut,
    VoterAssistanceSettingsOut,
)

router = APIRouter(prefix="/voting", tags=["Voting"])
settings = get_settings()


def get_or_create_quick_voter(db: Session, full_name: str, prn: str) -> Voter:
    clean_prn = re.sub(r"\s+", "", prn.strip())
    quick_voter_id = f"QUICK_{clean_prn}"
    voter = db.scalar(select(Voter).where(Voter.voter_id == quick_voter_id))
    if voter:
        if full_name and voter.full_name != full_name.strip():
            voter.full_name = full_name.strip()
            db.flush()
        return voter

    email = f"quick_{clean_prn}@civitas.internal"
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash=password_hash(clean_prn),
            role=Role.VOTER,
            is_active=True,
        )
        db.add(user)
        db.flush()

    aadhaar_hash = hashlib.sha256(f"QUICK_PRN_{clean_prn}".encode()).hexdigest()
    voter = Voter(
        user_id=user.id,
        voter_id=quick_voter_id,
        full_name=full_name.strip(),
        date_of_birth="2000-01-01",
        gender="Unspecified",
        mobile=clean_prn,
        address_ciphertext="Quick Voter Entry",
        aadhaar_last_four=clean_prn[-4:],
        aadhaar_digest=aadhaar_hash,
    )
    db.add(voter)
    db.flush()
    return voter


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


@router.post("/verify-quick-voter", response_model=QuickVoterVerifyResponse)
def verify_quick_voter(data: QuickVoterVerifyRequest, db: Session = Depends(get_db)):
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

    if getattr(election, "voter_registration_mode", "pre_registered") != "quick_entry":
        raise HTTPException(400, "This election is configured for Pre-Registered Voters.")

    normalized_prn = re.sub(r"\s+", "", data.prn.strip())
    if not re.match(r"^\d{10}$", normalized_prn):
        raise HTTPException(422, "PRN must contain exactly 10 digits.")

    clean_name = data.full_name.strip()
    if len(clean_name) < 2:
        raise HTTPException(422, "Full Name must be at least 2 characters.")

    # Check if this PRN has already voted in THIS election
    existing_quick_vote = db.scalar(
        select(QuickVoterRecord).where(
            QuickVoterRecord.election_id == election.id,
            QuickVoterRecord.prn == normalized_prn,
        )
    )
    if existing_quick_vote:
        raise HTTPException(
            409,
            "Vote already recorded. This PRN has already participated in this election."
        )

    # Get or create backing Voter record for session and foreign key compliance
    voter = get_or_create_quick_voter(db, clean_name, normalized_prn)

    # Ensure VoterElectionStatus is eligible
    status_row = db.scalar(
        select(VoterElectionStatus).where(
            VoterElectionStatus.voter_id == voter.id,
            VoterElectionStatus.election_id == election.id,
        )
    )
    if not status_row:
        status_row = VoterElectionStatus(voter_id=voter.id, election_id=election.id, eligible=True)
        db.add(status_row)
        db.flush()
    elif status_row.voted_at:
        raise HTTPException(409, "Vote already recorded. This PRN has already participated in this election.")

    # Start authentication session
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=current + timedelta(minutes=settings.max_authentication_minutes),
        metrics={"voter_name": clean_name, "prn": normalized_prn, "mode": "quick_entry"},
    )
    db.add(session)
    db.commit()

    return QuickVoterVerifyResponse(
        eligible=True,
        message="Quick voter verification successful",
        voter_name=clean_name,
        prn=normalized_prn,
        session_id=session.id,
        voting_type=getattr(election, "voting_type", "regular") or "regular",
        voter_registration_mode="quick_entry",
        voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
        enable_step_2=bool(election.enable_step_2),
        enable_step_3=bool(election.enable_step_3),
        enable_step_4=bool(election.enable_step_4),
        enable_step_5=bool(election.enable_step_5),
        max_selections=getattr(election, "max_selections", 1) or 1,
        allow_abstain=bool(getattr(election, "allow_abstain", False)),
        position_title=getattr(election, "position_title", None),
    )


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
        raise HTTPException(400, "This election is not currently open")

    # If election is quick_entry mode, suggest quick voter entry
    if getattr(election, "voter_registration_mode", "pre_registered") == "quick_entry":
        raise HTTPException(400, "This election uses Quick Voter Entry (Name + 10-digit PRN).")

    input_voter_id = data.voter_id.strip() if data.voter_id else ""
    input_voter_name = data.voter_name.strip() if data.voter_name else ""

    if not input_voter_id:
        raise HTTPException(400, "Voter ID is required.")
    if not input_voter_name:
        raise HTTPException(400, "Voter Name is required.")

    voter = db.scalar(select(Voter).where(func.lower(Voter.voter_id) == input_voter_id.lower()))
    if not voter:
        raise HTTPException(404, "Voter not found")

    # Verify that voter name matches the registered full name (case-insensitive & trimmed)
    registered_name = re.sub(r"\s+", " ", voter.full_name.strip()).lower()
    provided_name = re.sub(r"\s+", " ", input_voter_name).lower()
    if registered_name != provided_name:
        raise HTTPException(401, "Voter name and voter ID do not match")

    user = db.get(User, voter.user_id)
    if not user or not user.is_active:
        raise HTTPException(403, "Voter account is inactive or not eligible to vote")

    status_row = db.scalar(
        select(VoterElectionStatus).where(
            VoterElectionStatus.voter_id == voter.id,
            VoterElectionStatus.election_id == election.id,
        )
    )

    if not status_row or not status_row.eligible:
        raise HTTPException(
            403,
            "This voter is not registered for this election",
        )

    if status_row.voted_at:
        raise HTTPException(409, "You have already voted")

    # Start authentication session
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=current + timedelta(minutes=settings.max_authentication_minutes),
        metrics={"voter_name": voter.full_name, "voter_id": voter.voter_id},
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
    current = datetime.now(timezone.utc)
    if not election or election.state != ElectionState.OPEN or not (ensure_utc(election.starts_at) <= current <= ensure_utc(election.ends_at)):
        raise HTTPException(409, "This ballot is no longer available")

    # Determine candidate IDs to cast
    candidate_id_list = []
    if data.candidate_ids:
        candidate_id_list = [str(cid) for cid in data.candidate_ids if cid]
    elif data.candidate_id:
        candidate_id_list = [str(data.candidate_id)]

    if not candidate_id_list:
        raise HTTPException(422, "At least one candidate or option must be selected")

    max_allowed = getattr(election, "max_selections", 1) or 1
    if len(candidate_id_list) > max_allowed:
        raise HTTPException(422, f"You may only select up to {max_allowed} option{'s' if max_allowed > 1 else ''} for this election")

    # Verify all candidates belong to this election
    for cid in candidate_id_list:
        cand = db.get(Candidate, cid)
        if not cand or str(cand.election_id) != str(election.id):
            raise HTTPException(404, f"Selected candidate/option '{cid}' is not valid for this election")

    reg_mode = getattr(election, "voter_registration_mode", "pre_registered") or "pre_registered"
    primary_receipt = secrets.token_urlsafe(24)

    if reg_mode == "quick_entry":
        # Extract PRN and voter name from session metrics or voter record
        metrics = session.metrics or {}
        voter = db.get(Voter, session.voter_id)
        voter_name = metrics.get("voter_name") or (voter.full_name if voter else data.voter_name) or "Anonymous Voter"
        prn = metrics.get("prn") or (voter.mobile if voter else data.prn) or "0000000000"
        normalized_prn = re.sub(r"\s+", "", str(prn).strip())

        if not re.match(r"^\d{10}$", normalized_prn):
            raise HTTPException(422, "PRN must contain exactly 10 digits.")

        # Check existing QuickVoterRecord first
        existing_rec = db.scalar(
            select(QuickVoterRecord).where(
                QuickVoterRecord.election_id == election.id,
                QuickVoterRecord.prn == normalized_prn,
            )
        )
        if existing_rec:
            raise HTTPException(409, "Vote already recorded. This PRN has already participated in this election.")

        # Atomic insert of QuickVoterRecord with UNIQUE(election_id, prn)
        try:
            quick_record = QuickVoterRecord(
                election_id=election.id,
                voter_name=voter_name,
                prn=normalized_prn,
                candidate_id=candidate_id_list[0] if candidate_id_list else None,
                candidate_ids_json=candidate_id_list,
                receipt_id=primary_receipt,
                cast_at=current,
            )
            db.add(quick_record)
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Vote already recorded. This PRN has already participated in this election.")

        # Also insert standard Vote rows for standard count calculations
        for idx, cid in enumerate(candidate_id_list):
            rec_id = primary_receipt if len(candidate_id_list) == 1 else f"{primary_receipt[:20]}_{idx + 1}"
            vote = Vote(election_id=election.id, candidate_id=cid, receipt_id=rec_id)
            db.add(vote)

        # Update status if voter row exists
        if session.voter_id:
            status_row = db.scalar(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == session.voter_id, VoterElectionStatus.election_id == election.id))
            if status_row:
                status_row.voted_at = current

        session.closed_at = current
        session.issued_grant_hash = None
        db.commit()

        return VoteReceipt(receipt_id=primary_receipt, cast_at=current)
    else:
        # Pre-registered mode
        status_row = db.scalar(select(VoterElectionStatus).where(VoterElectionStatus.voter_id == session.voter_id, VoterElectionStatus.election_id == election.id).with_for_update())
        if status_row and status_row.voted_at:
            raise HTTPException(409, "A ballot was already cast for this election")
        if not status_row:
            status_row = VoterElectionStatus(voter_id=session.voter_id, election_id=election.id)
            db.add(status_row)

        for idx, cid in enumerate(candidate_id_list):
            rec_id = primary_receipt if len(candidate_id_list) == 1 else f"{primary_receipt[:20]}_{idx + 1}"
            vote = Vote(election_id=election.id, candidate_id=cid, receipt_id=rec_id)
            db.add(vote)

        status_row.voted_at = current
        session.closed_at = current
        session.issued_grant_hash = None
        db.commit()

        return VoteReceipt(receipt_id=primary_receipt, cast_at=current)


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


