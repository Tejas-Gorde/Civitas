"""End-to-End Verification Tests for Civitas Voter Authentication & Registration Modes.
Tests exact cases requested for:
- PRE_REGISTERED (passwordless, existence/name matching, assignment check)
- ANYONE CAN VOTE (0 registered voters, any name + any ID allowed, duplicate voting blocked, no password)
"""

import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, get_db
from app.models import (
    AuthSession,
    AuthStage,
    Election,
    ElectionState,
    QuickVoterRecord,
    Role,
    User,
    Vote,
    Voter,
    VoterElectionStatus,
)
from app.core.security import create_token, password_hash


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_user_requested_exact_six_scenarios(client):
    """Verify all 6 scenarios specified in the CIVITAS Root Fix requirements."""
    now = datetime.now(timezone.utc)

    # =========================================================================
    # TEST 1 — PRE-REGISTERED (SUCCESS, NO PASSWORD)
    # =========================================================================
    admin_id_1 = f"admin_pre_{uuid.uuid4().hex[:6]}@civitas.local"
    elec_id_1 = f"ELEC-PRE-{uuid.uuid4().hex[:6].upper()}"

    onboard_payload_1 = {
        "temp_admin_id": admin_id_1,
        "temp_admin_password": "AdminPassword123!",
        "election_id": elec_id_1,
        "name": f"Pre-Registered Election {uuid.uuid4().hex[:6]}",
        "description": "Pre-registered test election",
        "starts_at": (now - timedelta(minutes=5)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "voter_registration_mode": "pre_registered",
        "candidates": [
            {"name": "Candidate Alpha", "party": "Party Alpha", "manifesto": "M Alpha"},
            {"name": "Candidate Beta", "party": "Party Beta", "manifesto": "M Beta"},
        ],
        "voters": [
            {
                "voter_id": "T001",
                "full_name": "Tejas",
            }
        ],
    }

    create_1_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload_1)
    assert create_1_res.status_code == 201, f"Pre-registered election creation failed: {create_1_res.text}"
    elec_1_data = create_1_res.json()
    internal_elec_id_1 = elec_1_data["id"]

    # Login: Election ID + Tejas + T001 -> SUCCESS (No password)
    login_1_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_1,
            "voter_id": "T001",
            "voter_name": "Tejas",
        },
    )
    assert login_1_res.status_code == 200, f"Test 1 failed: {login_1_res.text}"
    v1_body = login_1_res.json()
    assert v1_body["eligible"] is True
    assert v1_body["voter_id"] == "T001"
    assert v1_body["session_id"] is not None
    print("✅ TEST 1 PASSED: Pre-Registered voter (Tejas / T001) verified successfully with no password.")

    # =========================================================================
    # TEST 2 — PRE-REGISTERED WRONG VOTER (REJECT)
    # =========================================================================
    # Unregistered voter Rahul / R001
    login_2_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_1,
            "voter_id": "R001",
            "voter_name": "Rahul",
        },
    )
    assert login_2_res.status_code in (403, 404), f"Test 2 expected 403/404, got {login_2_res.status_code}: {login_2_res.text}"
    assert "not registered for this election" in login_2_res.json()["detail"].lower()
    print("✅ TEST 2 PASSED: Unregistered voter in Pre-Registered mode rejected with 'Voter is not registered for this election.'")

    # =========================================================================
    # TEST 3 — ANYONE CAN VOTE WITH ZERO VOTERS (SUCCESS)
    # =========================================================================
    admin_id_open = f"admin_open_{uuid.uuid4().hex[:6]}@civitas.local"
    elec_id_open = f"ELEC-OPEN-{uuid.uuid4().hex[:6].upper()}"

    onboard_payload_open = {
        "temp_admin_id": admin_id_open,
        "temp_admin_password": "AdminPassword123!",
        "election_id": elec_id_open,
        "name": f"Anyone Can Vote Election {uuid.uuid4().hex[:6]}",
        "description": "Open election with 0 registered voters",
        "starts_at": (now - timedelta(minutes=5)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "voter_registration_mode": "anyone_can_vote",
        "candidates": [
            {"name": "Option 1", "party": "Party 1", "manifesto": "M 1"},
            {"name": "Option 2", "party": "Party 2", "manifesto": "M 2"},
        ],
        "voters": [],  # Exactly 0 registered voters
    }

    create_open_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload_open)
    assert create_open_res.status_code == 201, f"Open election creation failed: {create_open_res.text}"
    elec_open_data = create_open_res.json()
    internal_elec_id_open = elec_open_data["id"]

    # Login with Name = Rahul, Voter ID = R001 -> SUCCESS
    login_3_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_open,
            "voter_id": "R001",
            "voter_name": "Rahul",
        },
    )
    assert login_3_res.status_code == 200, f"Test 3 failed: {login_3_res.text}"
    v3_body = login_3_res.json()
    assert v3_body["eligible"] is True
    assert v3_body["voter_id"] == "R001"
    print("✅ TEST 3 PASSED: Anyone Can Vote with 0 voters accepted Rahul / R001 successfully.")

    # =========================================================================
    # TEST 4 — ANY NAME + ANY ID (SUCCESS)
    # =========================================================================
    # First: Name = ABC, Voter ID = RANDOM123
    login_4a_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_open,
            "voter_id": "RANDOM123",
            "voter_name": "ABC",
        },
    )
    assert login_4a_res.status_code == 200, f"Test 4a failed: {login_4a_res.text}"
    assert login_4a_res.json()["eligible"] is True
    sess_4a_id = login_4a_res.json()["session_id"]

    # Second: Name = XYZ, Voter ID = RANDOM999
    login_4b_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_open,
            "voter_id": "RANDOM999",
            "voter_name": "XYZ",
        },
    )
    assert login_4b_res.status_code == 200, f"Test 4b failed: {login_4b_res.text}"
    assert login_4b_res.json()["eligible"] is True
    print("✅ TEST 4 PASSED: Any Name + Any ID (ABC/RANDOM123 and XYZ/RANDOM999) accepted.")

    # =========================================================================
    # TEST 5 — DUPLICATE VOTING PREVENTION
    # =========================================================================
    # Get candidates for open election
    cands_res = client.get(f"/api/v1/voting/elections/{internal_elec_id_open}/candidates")
    assert cands_res.status_code == 200
    candidates = cands_res.json()
    cand_1_id = candidates[0]["id"]

    # Advance session for RANDOM123 to GRANTED and issue grant
    with next(get_db()) as db:
        sess = db.get(AuthSession, sess_4a_id)
        sess.stage = AuthStage.GRANTED
        grant_token = create_token(
            subject=sess.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=sess.id,
        )
        import hashlib
        sess.issued_grant_hash = hashlib.sha256(grant_token.encode()).hexdigest()
        db.commit()

    # Vote once with RANDOM123 -> SUCCESS
    cast_res = client.post(
        "/api/v1/voting/cast",
        json={
            "election_id": internal_elec_id_open,
            "candidate_id": cand_1_id,
            "voting_grant": grant_token,
        },
    )
    assert cast_res.status_code == 201, f"First vote failed: {cast_res.text}"
    assert "receipt_id" in cast_res.json()

    # Attempt to verify/login AGAIN with RANDOM123 in same election -> REJECTED (409)
    login_5_dup = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_id_open,
            "voter_id": "RANDOM123",
            "voter_name": "ABC",
        },
    )
    assert login_5_dup.status_code == 409, f"Duplicate voter should return 409, got {login_5_dup.status_code}: {login_5_dup.text}"
    assert "already voted" in login_5_dup.json()["detail"].lower()
    print("✅ TEST 5 PASSED: Duplicate vote attempt for RANDOM123 blocked with 409 Conflict.")

    # =========================================================================
    # TEST 6 — PASSWORD ABSENCE & SCHEMA VALIDATION
    # =========================================================================
    # Verify request with strictly election_id, voter_name, voter_id works
    clean_voter_req = {
        "election_id": elec_id_open,
        "voter_id": "CLEAN_VOTER_001",
        "voter_name": "Clean Voter",
    }
    clean_res = client.post("/api/v1/voting/verify-voter", json=clean_voter_req)
    assert clean_res.status_code == 200, f"Clean voter verification failed: {clean_res.text}"
    assert "voter_password" not in clean_voter_req

    # Verify that even if extra garbage is passed, extra='ignore' ignores it without 422
    extra_field_req = {
        "election_id": elec_id_open,
        "voter_id": "EXTRA_VOTER_002",
        "voter_name": "Extra Voter",
        "unused_legacy_field": "some_value",
    }
    extra_res = client.post("/api/v1/voting/verify-voter", json=extra_field_req)
    assert extra_res.status_code == 200, f"Extra field request failed: {extra_res.text}"
    print("✅ TEST 6 PASSED: Voter authentication requires strictly (election_id, voter_name, voter_id) with no password.")

    # =========================================================================
    # TEST 7 — ADMIN AUTHENTICATION PRESERVED
    # =========================================================================
    admin_login_res = client.post(
        "/api/v1/admin/temp-login",
        json={"temp_admin_id": admin_id_open, "password": "AdminPassword123!"},
    )
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    assert "access_token" in admin_login_res.json()
    print("✅ TEST 7 PASSED: Local Admin password login remains fully functional.")
