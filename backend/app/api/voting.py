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
    is_anyone_can_vote_mode,
)
from app.schemas import (
    CandidateOut,
    CastVote,
    ElectionOut,
    LiveElectionOut,
    PublicElectionDetailOut,
    QuickVoterVerifyRequest,
    QuickVoterVerifyResponse,
    VerifyTokenResponse,
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
    mobile_val = clean_prn[:20] if len(clean_prn) <= 20 else f"Q_{hashlib.sha256(clean_prn.encode()).hexdigest()[:16]}"
    last_four = clean_prn[-4:] if len(clean_prn) >= 4 else clean_prn.rjust(4, "0")
    voter = Voter(
        user_id=user.id,
        voter_id=quick_voter_id,
        full_name=full_name.strip(),
        date_of_birth="2000-01-01",
        gender="Unspecified",
        mobile=mobile_val,
        address_ciphertext="Quick Voter Entry",
        aadhaar_last_four=last_four,
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


@router.get("/elections", response_model=list[LiveElectionOut])
@router.get("/live-elections", response_model=list[LiveElectionOut])
def get_live_public_elections(db: Session = Depends(get_db)):
    current = datetime.now(timezone.utc)
    all_elections = db.scalars(select(Election).order_by(Election.created_at.desc())).all()
    live = []
    for el in all_elections:
        starts = ensure_utc(el.starts_at)
        ends = ensure_utc(el.ends_at)
        is_live = el.state == ElectionState.OPEN and starts <= current <= ends
        el_dict = {
            "id": el.id,
            "election_id": el.election_id or str(el.id),
            "name": el.name,
            "description": el.description or "",
            "starts_at": el.starts_at,
            "ends_at": el.ends_at,
            "state": el.state,
            "voting_type": getattr(el, "voting_type", "regular") or "regular",
            "voter_registration_mode": getattr(el, "voter_registration_mode", "pre_registered") or "pre_registered",
            "remote_voting_enabled": bool(el.remote_voting_enabled),
            "voting_flow_mode": getattr(el, "voting_flow_mode", "full") or "full",
            "enable_step_2": bool(el.enable_step_2),
            "enable_step_3": bool(el.enable_step_3),
            "enable_step_4": bool(el.enable_step_4),
            "enable_step_5": bool(el.enable_step_5),
            "show_voter_names_in_results": bool(el.show_voter_names_in_results),
            "max_selections": getattr(el, "max_selections", 1) or 1,
            "allow_abstain": bool(getattr(el, "allow_abstain", False)),
            "position_title": getattr(el, "position_title", None),
            "is_live_now": is_live,
            "candidate_count": len(el.candidates),
        }
        live.append(el_dict)
    return live


@router.get("/elections/{election_id}/candidates", response_model=list[CandidateOut])
def get_election_candidates_public(election_id: str, db: Session = Depends(get_db)):
    clean_id = election_id.strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(404, "Election not found.")
    return election.candidates


@router.get("/verify-token/{token}", response_model=VerifyTokenResponse)
def verify_remote_token(token: str, db: Session = Depends(get_db)):
    current = datetime.now(timezone.utc)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    election = db.scalar(select(Election).where(Election.secure_voting_token_hash == token_hash))

    if not election:
        raise HTTPException(404, "Invalid or unrecognized voting token.")

    if not election.remote_voting_enabled:
        raise HTTPException(403, "Remote public link voting is not enabled for this election.")

    if election.token_revoked_at is not None:
        raise HTTPException(410, "This voting token has been revoked by the election administrator.")

    if election.state != ElectionState.OPEN:
        raise HTTPException(400, "This election is not currently open for voting.")

    starts = ensure_utc(election.starts_at)
    ends = ensure_utc(election.ends_at)
    if not (starts <= current <= ends):
        raise HTTPException(400, "This election is outside its active voting time window.")

    return VerifyTokenResponse(
        valid=True,
        election_id=election.id,
        election_name=election.name,
        starts_at=election.starts_at,
        ends_at=election.ends_at,
        voting_type=getattr(election, "voting_type", "regular") or "regular",
        voter_registration_mode=getattr(election, "voter_registration_mode", "pre_registered") or "pre_registered",
        voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
        enable_step_2=bool(election.enable_step_2),
        enable_step_3=bool(election.enable_step_3),
        enable_step_4=bool(election.enable_step_4),
        enable_step_5=bool(election.enable_step_5),
        max_selections=getattr(election, "max_selections", 1) or 1,
        allow_abstain=bool(getattr(election, "allow_abstain", False)),
        position_title=getattr(election, "position_title", None),
        message="Token is valid and active.",
    )


@router.get("/access/{token}", response_model=ElectionOut)
def get_election_by_access_token(token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    election = db.scalar(select(Election).where(Election.secure_voting_token_hash == token_hash))
    if not election:
        raise HTTPException(404, "Invalid voting token.")
    if election.token_revoked_at is not None:
        raise HTTPException(410, "This voting token has been revoked by the election administrator.")
    if not election.remote_voting_enabled:
        raise HTTPException(403, "Remote voting is disabled.")
    return election


@router.get("/verify-election/{election_id}", response_model=PublicElectionDetailOut)
def verify_election_id_public(election_id: str, db: Session = Depends(get_db)):
    clean_id = election_id.strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(404, "Election not found.")

    current = datetime.now(timezone.utc)
    starts = ensure_utc(election.starts_at)
    ends = ensure_utc(election.ends_at)
    is_live = election.state == ElectionState.OPEN and starts <= current <= ends

    out = PublicElectionDetailOut.model_validate(election)
    out.is_live_now = is_live
    out.election_id = election.election_id or str(election.id)
    out.candidate_count = len(election.candidates)
    return out


from app.services.voter_auth import authenticate_voter


@router.post("/verify-quick-voter", response_model=QuickVoterVerifyResponse)
def verify_quick_voter(data: QuickVoterVerifyRequest, db: Session = Depends(get_db)):
    verify_req = VoterVerifyRequest(
        election_id=data.election_id,
        voter_id=data.prn,
        voter_name=data.full_name,
    )
    res = authenticate_voter(db, verify_req)
    return QuickVoterVerifyResponse(
        eligible=res.eligible,
        message=res.message,
        voter_name=data.full_name.strip(),
        prn=res.voter_id or data.prn.strip(),
        session_id=res.session_id,
        voting_type=res.voting_type,
        voter_registration_mode=res.voter_registration_mode,
        voting_flow_mode=res.voting_flow_mode,
        enable_step_2=res.enable_step_2,
        enable_step_3=res.enable_step_3,
        enable_step_4=res.enable_step_4,
        enable_step_5=res.enable_step_5,
        max_selections=res.max_selections,
        allow_abstain=res.allow_abstain,
        position_title=res.position_title,
    )


@router.post("/authenticate", response_model=VoterVerifyResponse)
@router.post("/voter/authenticate", response_model=VoterVerifyResponse)
@router.post("/verify-voter", response_model=VoterVerifyResponse)
def verify_voter(data: VoterVerifyRequest, db: Session = Depends(get_db)):
    return authenticate_voter(db, data)


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

    if is_anyone_can_vote_mode(reg_mode):
        # Extract PRN and voter name from session metrics or voter record
        metrics = session.metrics or {}
        voter = db.get(Voter, session.voter_id)
        voter_name = metrics.get("voter_name") or (voter.full_name if voter else data.voter_name) or "Anonymous Voter"
        prn = metrics.get("voter_id") or metrics.get("prn") or (voter.voter_id.replace("QUICK_", "") if voter and voter.voter_id.startswith("QUICK_") else (voter.mobile if voter else data.prn)) or "0000000000"
        normalized_prn = re.sub(r"\s+", "", str(prn).strip())
        if not normalized_prn:
            raise HTTPException(422, "Voter ID is required.")

        # Check existing QuickVoterRecord first
        existing_rec = db.scalar(
            select(QuickVoterRecord).where(
                QuickVoterRecord.election_id == election.id,
                func.lower(QuickVoterRecord.prn) == normalized_prn.lower(),
            )
        )
        if existing_rec:
            raise HTTPException(409, "Vote already recorded. This voter ID has already participated in this election.")

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
            raise HTTPException(409, "Vote already recorded. This voter ID has already participated in this election.")

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
            raise HTTPException(409, "You have already voted in this election.")
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


