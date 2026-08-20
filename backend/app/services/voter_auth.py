"""Centralized Voter Authentication Service for Civitas.

This module is the single source of truth for authenticating voters across Civitas:
- MODE 1 — NORMAL VOTING: Strictly validates against registered voter database, full name matching, and eligibility.
- MODE 2 — EXPRESS VOTING (ANYONE CAN VOTE): Requires ONLY voter_name. Zero pre-registration, no voter ID, no password.
"""

import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import password_hash, password_verify
from app.models import (
    AuthSession,
    AuthStage,
    Election,
    ElectionState,
    QuickVoterRecord,
    Role,
    User,
    Voter,
    VoterElectionStatus,
    is_express_mode,
    is_normal_mode,
)
from app.schemas import ExpressVoterAuthRequest, NormalVoterAuthRequest, VoterVerifyRequest, VoterVerifyResponse

settings = get_settings()


def ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime has timezone.utc tzinfo."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def normalize_voter_id(raw_id: str | None) -> str:
    """Strip whitespace and normalize voter identifier."""
    if not raw_id:
        return ""
    return re.sub(r"\s+", "", str(raw_id).strip())


def normalize_full_name(raw_name: str | None) -> str:
    """Clean redundant spaces from voter full name."""
    if not raw_name:
        return ""
    return re.sub(r"\s+", " ", str(raw_name).strip())


def resolve_open_election(db: Session, election_id_or_slug: str) -> Election:
    """Resolve election by UUID or human-readable slug and validate lifecycle state & schedule window."""
    clean_id = str(election_id_or_slug).strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(status_code=404, detail="Election not found.")

    if election.state != ElectionState.OPEN:
        if election.state == ElectionState.PAUSED:
            raise HTTPException(status_code=400, detail="Voting for this election is temporarily paused.")
        elif election.state in (ElectionState.CLOSED, ElectionState.PUBLISHED):
            raise HTTPException(status_code=400, detail="This election has been closed and is no longer accepting votes.")
        else:
            raise HTTPException(status_code=400, detail="This election is not currently open for voting.")

    current = datetime.now(timezone.utc)
    starts = ensure_utc(election.starts_at)
    ends = ensure_utc(election.ends_at)
    if current < starts:
        raise HTTPException(status_code=400, detail="This election has not started yet.")
    if current > ends:
        raise HTTPException(status_code=400, detail="This election has ended.")

    return election


def get_or_create_express_voter(db: Session, full_name: str, custom_id: str | None = None) -> Voter:
    """Provision or retrieve backing Voter and User records for Express voters.
    
    Guarantees database foreign-key integrity for AuthSession, VoterPhoto, and Vote records.
    """
    clean_name = normalize_full_name(full_name)
    if custom_id:
        express_tag = custom_id
    else:
        name_slug = re.sub(r"[^a-zA-Z0-9]", "_", clean_name.lower())[:24]
        express_tag = f"EXP_{name_slug}_{hashlib.sha256(clean_name.encode()).hexdigest()[:8]}"

    voter = db.scalar(
        select(Voter).where(
            (func.lower(Voter.voter_id) == express_tag.lower()) |
            (func.lower(Voter.voter_id) == f"QUICK_{express_tag}".lower())
        )
    )
    if voter:
        return voter

    email = f"{express_tag.lower()}@civitas.express"
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if not user:
        user = User(
            email=email,
            password_hash=password_hash(express_tag),
            role=Role.VOTER,
            is_active=True,
        )
        db.add(user)
        db.flush()

    mobile_tag = f"E_{hashlib.sha256(express_tag.encode()).hexdigest()[:14]}"
    voter = Voter(
        user_id=user.id,
        voter_id=express_tag,
        full_name=clean_name,
        date_of_birth="2000-01-01",
        gender="Unspecified",
        mobile=mobile_tag,
        address_ciphertext="Express Voting Participant",
        aadhaar_last_four=hashlib.sha256(express_tag.encode()).hexdigest()[:4],
        aadhaar_digest=hashlib.sha256(express_tag.encode()).hexdigest(),
    )
    db.add(voter)
    db.flush()
    return voter


# =============================================================================
# MODE 2: EXPRESS VOTING AUTHENTICATION (ANYONE CAN VOTE)
# =============================================================================
def authenticate_express_voter(
    db: Session,
    election: Election,
    voter_name: str,
    voter_id: str | None = None,
) -> VoterVerifyResponse:
    """Authenticate an Express voter using ONLY voter_name.
    
    No voter ID, no password, no pre-registration, no whitelist check.
    If an optional voter_id is provided, it is respected for participation tracking.
    """
    clean_name = normalize_full_name(voter_name)
    if not clean_name:
        raise HTTPException(status_code=400, detail="Voter Name is required.")

    normalized_id = normalize_voter_id(voter_id)
    current = datetime.now(timezone.utc)

    if normalized_id:
        # Check duplicate voting in this election if voter ID provided
        existing_quick_record = db.scalar(
            select(QuickVoterRecord).where(
                QuickVoterRecord.election_id == election.id,
                func.lower(QuickVoterRecord.prn) == normalized_id.lower(),
            )
        )
        if existing_quick_record:
            raise HTTPException(
                status_code=409,
                detail="You have already voted in this election."
            )
        voter = get_or_create_express_voter(db, clean_name, normalized_id)
    else:
        voter = get_or_create_express_voter(db, clean_name)

    # Ensure VoterElectionStatus is eligible
    status_row = db.scalar(
        select(VoterElectionStatus).where(
            VoterElectionStatus.voter_id == voter.id,
            VoterElectionStatus.election_id == election.id,
        )
    )
    if not status_row:
        status_row = VoterElectionStatus(
            voter_id=voter.id,
            election_id=election.id,
            eligible=True,
        )
        db.add(status_row)
        db.flush()
    elif status_row.voted_at:
        raise HTTPException(
            status_code=409,
            detail="You have already voted in this election."
        )

    # Initiate AuthSession
    session_expiry = current + timedelta(minutes=settings.max_authentication_minutes)
    effective_id = normalized_id or voter.voter_id
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=session_expiry,
        metrics={
            "voter_name": clean_name,
            "voter_id": effective_id,
            "prn": effective_id,
            "mode": "express",
        },
    )
    db.add(session)
    db.commit()

    return VoterVerifyResponse(
        eligible=True,
        message="Express voter authenticated successfully",
        voter_id=effective_id,
        voter_internal_id=voter.id,
        session_id=session.id,
        expires_at=session_expiry.isoformat(),
        voting_type=getattr(election, "voting_type", "regular") or "regular",
        voter_registration_mode=getattr(election, "voter_registration_mode", "express") or "express",
        voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
        enable_step_2=bool(election.enable_step_2),
        enable_step_3=bool(election.enable_step_3),
        enable_step_4=bool(election.enable_step_4),
        enable_step_5=bool(election.enable_step_5),
        max_selections=getattr(election, "max_selections", 1) or 1,
        allow_abstain=bool(getattr(election, "allow_abstain", False)),
        position_title=getattr(election, "position_title", None),
    )


# =============================================================================
# MODE 1: NORMAL VOTING AUTHENTICATION (PRE-REGISTERED)
# =============================================================================
def authenticate_normal_voter(
    db: Session,
    election: Election,
    voter_name: str,
    voter_id: str,
    voter_password: str | None = None,
) -> VoterVerifyResponse:
    """Authenticate a Normal voter against the registered voter database."""
    clean_name = normalize_full_name(voter_name)
    normalized_id = normalize_voter_id(voter_id)

    if not normalized_id:
        raise HTTPException(status_code=400, detail="Voter ID is required.")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Voter Full Name is required.")

    # 1. Lookup Registered Voter
    voter = db.scalar(
        select(Voter).where(func.lower(Voter.voter_id) == normalized_id.lower())
    )
    if not voter:
        raise HTTPException(
            status_code=404,
            detail="Voter is not registered for this election."
        )

    # 2. Verify Full Name matches registered name
    reg_name = normalize_full_name(voter.full_name).lower()
    in_name = clean_name.lower()
    if reg_name != in_name:
        raise HTTPException(
            status_code=401,
            detail="Voter name and voter ID do not match"
        )

    # 3. Verify Account Status
    user = db.get(User, voter.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Voter account is inactive or not eligible to vote"
        )

    # 4. Check Election Eligibility
    status_row = db.scalar(
        select(VoterElectionStatus).where(
            VoterElectionStatus.voter_id == voter.id,
            VoterElectionStatus.election_id == election.id,
        )
    )
    if not status_row or not status_row.eligible:
        raise HTTPException(
            status_code=403,
            detail="Voter is not registered for this election."
        )

    # 5. Check Duplicate Vote in this election
    if status_row.voted_at:
        raise HTTPException(
            status_code=409,
            detail="You have already voted in this election."
        )

    # 6. Verify password if provided
    if voter_password:
        if not password_verify(voter_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid voter password")

    # 7. Initiate AuthSession
    current = datetime.now(timezone.utc)
    session_expiry = current + timedelta(minutes=settings.max_authentication_minutes)
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=session_expiry,
        metrics={
            "voter_name": voter.full_name,
            "voter_id": voter.voter_id,
            "mode": "normal",
        },
    )
    db.add(session)
    db.commit()

    return VoterVerifyResponse(
        eligible=True,
        message="Voter eligibility verified successfully",
        voter_id=voter.voter_id,
        voter_internal_id=voter.id,
        session_id=session.id,
        expires_at=session_expiry.isoformat(),
        voting_type=getattr(election, "voting_type", "regular") or "regular",
        voter_registration_mode="normal",
        voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
        enable_step_2=bool(election.enable_step_2),
        enable_step_3=bool(election.enable_step_3),
        enable_step_4=bool(election.enable_step_4),
        enable_step_5=bool(election.enable_step_5),
        max_selections=getattr(election, "max_selections", 1) or 1,
        allow_abstain=bool(getattr(election, "allow_abstain", False)),
        position_title=getattr(election, "position_title", None),
    )


# =============================================================================
# CENTRAL DISPATCHER
# =============================================================================
def authenticate_voter(db: Session, data: VoterVerifyRequest) -> VoterVerifyResponse:
    """Central authoritative voter authentication dispatcher.
    
    Reads the election's explicit mode (EXPRESS vs NORMAL) and executes the appropriate flow.
    """
    election = resolve_open_election(db, data.election_id)
    reg_mode = getattr(election, "voter_registration_mode", "normal") or "normal"

    if is_express_mode(reg_mode):
        # Express Voting: Authenticate using voter_name (and optional voter_id if supplied)
        return authenticate_express_voter(db, election, data.voter_name, data.voter_id)
    else:
        # Normal Voting: Authenticate using registered voter record (voter_id + voter_name)
        if not data.voter_id:
            raise HTTPException(status_code=400, detail="Voter ID is required for Normal Voting elections.")
        return authenticate_normal_voter(
            db=db,
            election=election,
            voter_name=data.voter_name,
            voter_id=data.voter_id,
            voter_password=data.voter_password,
        )
