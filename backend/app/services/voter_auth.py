"""Centralized Voter Authentication Service for Civitas.

This module is the single source of truth for authenticating voters across all
supported registration and election modes in Civitas:
- ANYONE_CAN_VOTE / OPEN_ENROLLMENT: Zero pre-registration, no voter_password, Name + Voter ID.
- PRE_REGISTERED: Strictly validates against database registered voters, full name matching, and eligibility.
- Election-scoped duplicate voting prevention: Scoped strictly to (election_id, voter_id).
- Unified session creation and security context generation.
"""

import hashlib
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID
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
    is_anyone_can_vote_mode,
)
from app.schemas import VoterVerifyRequest, VoterVerifyResponse

settings = get_settings()


def ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime has timezone.utc tzinfo."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def normalize_voter_id(raw_id: str) -> str:
    """Strip whitespace and normalize voter identifier."""
    if not raw_id:
        return ""
    return re.sub(r"\s+", "", str(raw_id).strip())


def normalize_full_name(raw_name: str) -> str:
    """Clean redundant spaces from voter full name."""
    if not raw_name:
        return ""
    return re.sub(r"\s+", " ", str(raw_name).strip())


def get_or_create_open_enrollment_voter(db: Session, full_name: str, normalized_id: str) -> Voter:
    """Get or dynamically provision backing Voter and User records for Open Enrollment voters.
    
    This guarantees relational database integrity for foreign keys in authentication sessions,
    voter photos, and audit logs without requiring pre-registration.
    """
    clean_id = normalized_id
    backing_voter_id = f"QUICK_{clean_id}"

    voter = db.scalar(
        select(Voter).where(
            (func.lower(Voter.voter_id) == backing_voter_id.lower()) |
            (func.lower(Voter.voter_id) == clean_id.lower())
        )
    )
    if voter:
        if full_name and voter.full_name != full_name:
            voter.full_name = full_name
            db.flush()
        return voter

    email = f"open_{clean_id}@civitas.internal"
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if not user:
        user = User(
            email=email,
            password_hash=password_hash(clean_id),
            role=Role.VOTER,
            is_active=True,
        )
        db.add(user)
        db.flush()

    aadhaar_hash = hashlib.sha256(f"OPEN_{clean_id}".encode()).hexdigest()
    mobile_val = clean_id[:20] if len(clean_id) <= 20 else f"O_{hashlib.sha256(clean_id.encode()).hexdigest()[:16]}"
    last_four = clean_id[-4:] if len(clean_id) >= 4 else clean_id.rjust(4, "0")

    voter = Voter(
        user_id=user.id,
        voter_id=backing_voter_id,
        full_name=full_name,
        date_of_birth="2000-01-01",
        gender="Unspecified",
        mobile=mobile_val,
        address_ciphertext="Open Enrollment Voter",
        aadhaar_last_four=last_four,
        aadhaar_digest=aadhaar_hash,
    )
    db.add(voter)
    db.flush()
    return voter


def authenticate_voter(db: Session, data: VoterVerifyRequest) -> VoterVerifyResponse:
    """Central authoritative voter authentication function.
    
    Determines voter eligibility, validates credentials according to election configuration,
    enforces duplicate voting prevention, and initiates an AuthSession.
    """
    current = datetime.now(timezone.utc)
    clean_election_id = str(data.election_id).strip()

    # 1. Resolve Election by UUID or human-readable election_id slug
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_election_id.lower()) |
            (func.lower(Election.election_id) == clean_election_id.lower())
        )
    )
    if not election:
        raise HTTPException(status_code=404, detail="Election not found.")

    # 2. Check Election Lifecycle State & Active Schedule Window
    if election.state != ElectionState.OPEN:
        if election.state == ElectionState.PAUSED:
            raise HTTPException(status_code=400, detail="Voting for this election is temporarily paused.")
        elif election.state in (ElectionState.CLOSED, ElectionState.PUBLISHED):
            raise HTTPException(status_code=400, detail="This election has been closed and is no longer accepting votes.")
        else:
            raise HTTPException(status_code=400, detail="This election is not currently open for voting.")

    starts = ensure_utc(election.starts_at)
    ends = ensure_utc(election.ends_at)
    if current < starts:
        raise HTTPException(status_code=400, detail="This election has not started yet.")
    if current > ends:
        raise HTTPException(status_code=400, detail="This election has ended.")

    # 3. Clean and Validate Input Identity
    normalized_id = normalize_voter_id(data.voter_id)
    clean_name = normalize_full_name(data.voter_name)

    if not normalized_id:
        raise HTTPException(status_code=400, detail="Voter ID / PRN is required.")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Voter Full Name is required.")

    reg_mode = getattr(election, "voter_registration_mode", "pre_registered") or "pre_registered"

    # =========================================================================
    # BRANCH A: ANYONE CAN VOTE / OPEN ENROLLMENT MODE
    # =========================================================================
    if is_anyone_can_vote_mode(reg_mode):
        # A1. Check duplicate voting in this election
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

        # A2. Check if a backing voter has already recorded a vote in this election
        existing_voters = db.scalars(
            select(Voter).where(
                (func.lower(Voter.voter_id) == f"quick_{normalized_id}".lower()) |
                (func.lower(Voter.voter_id) == normalized_id.lower())
            )
        ).all()
        for ev in existing_voters:
            status_check = db.scalar(
                select(VoterElectionStatus).where(
                    VoterElectionStatus.voter_id == ev.id,
                    VoterElectionStatus.election_id == election.id,
                )
            )
            if status_check and status_check.voted_at:
                raise HTTPException(
                    status_code=409,
                    detail="You have already voted in this election."
                )

        # A3. Provision or retrieve backing voter record
        voter = get_or_create_open_enrollment_voter(db, clean_name, normalized_id)

        # A4. Ensure VoterElectionStatus is eligible
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

        # A5. Initiate AuthSession
        session_expiry = current + timedelta(minutes=settings.max_authentication_minutes)
        session = AuthSession(
            voter_id=voter.id,
            election_id=election.id,
            stage=AuthStage.IDENTIFIED,
            expires_at=session_expiry,
            metrics={
                "voter_name": clean_name,
                "voter_id": normalized_id,
                "prn": normalized_id,
                "mode": "anyone_can_vote",
            },
        )
        db.add(session)
        db.commit()

        return VoterVerifyResponse(
            eligible=True,
            message="Voter eligibility verified successfully",
            voter_id=normalized_id,
            voter_internal_id=voter.id,
            session_id=session.id,
            expires_at=session_expiry.isoformat(),
            voting_type=getattr(election, "voting_type", "regular") or "regular",
            voter_registration_mode=reg_mode,
            voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
            enable_step_2=bool(election.enable_step_2),
            enable_step_3=bool(election.enable_step_3),
            enable_step_4=bool(election.enable_step_4),
            enable_step_5=bool(election.enable_step_5),
            max_selections=getattr(election, "max_selections", 1) or 1,
            allow_abstain=bool(getattr(election, "allow_abstain", False)),
            position_title=getattr(election, "position_title", None),
        )

    # =========================================================================
    # BRANCH B: PRE-REGISTERED / REGISTERED VOTERS MODE
    # =========================================================================
    voter = db.scalar(
        select(Voter).where(func.lower(Voter.voter_id) == normalized_id.lower())
    )
    if not voter:
        raise HTTPException(
            status_code=404,
            detail="Voter is not registered for this election."
        )

    # B1. Verify Full Name matches registered name (case-insensitive & trimmed)
    reg_name = normalize_full_name(voter.full_name).lower()
    in_name = clean_name.lower()
    if reg_name != in_name:
        raise HTTPException(
            status_code=401,
            detail="Voter name and voter ID do not match"
        )

    # B2. Verify Voter User Account is active
    user = db.get(User, voter.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Voter account is inactive or not eligible to vote"
        )

    # B3. Check Election Eligibility in VoterElectionStatus
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

    # B4. Check Duplicate Vote in this election
    if status_row.voted_at:
        raise HTTPException(
            status_code=409,
            detail="You have already voted in this election."
        )

    # B5. Initiate AuthSession
    session_expiry = current + timedelta(minutes=settings.max_authentication_minutes)
    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.IDENTIFIED,
        expires_at=session_expiry,
        metrics={
            "voter_name": voter.full_name,
            "voter_id": voter.voter_id,
            "mode": "pre_registered",
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
        voter_registration_mode="pre_registered",
        voting_flow_mode=getattr(election, "voting_flow_mode", "full") or "full",
        enable_step_2=bool(election.enable_step_2),
        enable_step_3=bool(election.enable_step_3),
        enable_step_4=bool(election.enable_step_4),
        enable_step_5=bool(election.enable_step_5),
        max_selections=getattr(election, "max_selections", 1) or 1,
        allow_abstain=bool(getattr(election, "allow_abstain", False)),
        position_title=getattr(election, "position_title", None),
    )
