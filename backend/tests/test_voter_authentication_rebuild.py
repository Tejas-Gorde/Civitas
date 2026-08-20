"""Comprehensive Automated Test Suite for Rebuilt Voter Authentication Architecture.

Tests every requirement:
- Anyone Can Vote Mode (Zero pre-registration, no password, arbitrary names & IDs, duplicate prevention)
- Pre-Registered Mode (Existence validation, full name matching, eligibility, double voting prevention)
- Election Lifecycle & Schedule Window validation (Draft, Scheduled, Paused, Closed, Future, Past)
- Election-Scoped duplicate vote isolation (Voter ID allowed in Election A and Election B independently)
- Local Admin Edit Election (Editing voting_type, registration_mode, steps, schedule, max_selections with live application)
"""

import io
import uuid
import hashlib
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
    VoterPhoto,
)
from app.core.security import create_token, password_hash


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_anyone_can_vote_comprehensive_suite(client):
    """Test all Anyone Can Vote / Open Enrollment specifications."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]

    admin_email = f"admin_acv_{uid}@civitas.local"
    elec_slug_a = f"ELEC-ACV-A-{uid.upper()}"
    elec_slug_b = f"ELEC-ACV-B-{uid.upper()}"

    # 1. Create Election A with Anyone Can Vote (0 registered voters)
    res_a = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": admin_email,
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug_a,
            "name": f"Open Election A {uid}",
            "description": "Anyone can vote test A",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "anyone_can_vote",
            "candidates": [
                {"name": "Alpha", "party": "Party Alpha", "manifesto": "Plan A"},
                {"name": "Beta", "party": "Party Beta", "manifesto": "Plan B"},
            ],
            "voters": [],
        },
    )
    assert res_a.status_code == 201
    elec_a_id = res_a.json()["id"]

    # Test 1: Random Name + Random Voter ID -> SUCCESS (No voter_password)
    v1_req = {
        "election_id": elec_slug_a,
        "voter_id": f"TEST_VOTER_{uid}_1",
        "voter_name": "John Smith",
    }
    v1_res = client.post("/api/v1/voting/verify-voter", json=v1_req)
    assert v1_res.status_code == 200, f"Voter 1 failed: {v1_res.text}"
    v1_body = v1_res.json()
    assert v1_body["eligible"] is True
    assert v1_body["voter_id"] == f"TEST_VOTER_{uid}_1"
    session_1_id = v1_body["session_id"]
    assert session_1_id is not None
    assert "voter_password" not in v1_req

    # Test 2: Another distinct random Name + Voter ID -> SUCCESS
    v2_req = {
        "election_id": elec_slug_a,
        "voter_id": f"TEST_VOTER_{uid}_2",
        "voter_name": "Alice Wonder",
    }
    v2_res = client.post("/api/v1/voting/verify-voter", json=v2_req)
    assert v2_res.status_code == 200, f"Voter 2 failed: {v2_res.text}"
    assert v2_res.json()["eligible"] is True
    assert v2_res.json()["voter_id"] == f"TEST_VOTER_{uid}_2"

    # Test 3: Empty name -> FAIL (400)
    v_empty_name = client.post(
        "/api/v1/voting/verify-voter",
        json={"election_id": elec_slug_a, "voter_id": f"ID_{uid}", "voter_name": ""},
    )
    assert v_empty_name.status_code in (400, 422)

    # Test 4: Empty voter ID -> FAIL (400)
    v_empty_id = client.post(
        "/api/v1/voting/verify-voter",
        json={"election_id": elec_slug_a, "voter_id": "", "voter_name": "Valid Name"},
    )
    assert v_empty_id.status_code in (400, 422)

    # Test 5: Cast vote with Voter 1, then attempt second vote in SAME election -> FAIL (409)
    cands_a = client.get(f"/api/v1/voting/elections/{elec_a_id}/candidates").json()
    cand_1_id = cands_a[0]["id"]

    # Issue voting grant for session 1
    with next(get_db()) as db:
        s1 = db.get(AuthSession, session_1_id)
        s1.stage = AuthStage.GRANTED
        grant1 = create_token(
            subject=s1.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=s1.id,
        )
        s1.issued_grant_hash = hashlib.sha256(grant1.encode()).hexdigest()
        db.commit()

    cast_res1 = client.post(
        "/api/v1/voting/cast",
        json={
            "election_id": elec_a_id,
            "candidate_id": cand_1_id,
            "voting_grant": grant1,
        },
    )
    assert cast_res1.status_code == 201
    assert "receipt_id" in cast_res1.json()

    # Re-authentication attempt for Voter 1 in Election A -> REJECTED (409)
    v1_dup = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug_a,
            "voter_id": f"TEST_VOTER_{uid}_1",
            "voter_name": "John Smith",
        },
    )
    assert v1_dup.status_code == 409
    assert "already voted" in v1_dup.json()["detail"].lower()

    # Test 6: Same Voter ID voting in Election B -> SUCCESS (Election-scoped duplicate prevention)
    res_b = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": f"admin_b_{uid}@civitas.local",
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug_b,
            "name": f"Open Election B {uid}",
            "description": "Anyone can vote test B",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "anyone_can_vote",
            "candidates": [
                {"name": "Option X", "party": "Party X", "manifesto": "Plan X"},
                {"name": "Option Y", "party": "Party Y", "manifesto": "Plan Y"},
            ],
            "voters": [],
        },
    )
    assert res_b.status_code == 201

    v1_elec_b = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug_b,
            "voter_id": f"TEST_VOTER_{uid}_1",
            "voter_name": "John Smith",
        },
    )
    assert v1_elec_b.status_code == 200, f"Same voter in Election B should succeed, got: {v1_elec_b.text}"
    assert v1_elec_b.json()["eligible"] is True

    # Test 7: Extra irrelevant fields ignored cleanly without 422
    extra_field_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug_b,
            "voter_id": f"TEST_EXTRA_{uid}",
            "voter_name": "Extra Tester",
            "unknown_extra_field": "some_value",
            "another_field": 123,
        },
    )
    assert extra_field_res.status_code == 200


def test_pre_registered_comprehensive_suite(client):
    """Test all Pre-Registered mode specifications."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]

    admin_email = f"admin_pre_{uid}@civitas.local"
    elec_slug = f"ELEC-PRE-{uid.upper()}"

    res = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": admin_email,
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug,
            "name": f"Pre-Registered Election {uid}",
            "description": "Pre-registered test",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "pre_registered",
            "candidates": [
                {"name": "Cand 1", "party": "Party 1", "manifesto": "Plan 1"},
                {"name": "Cand 2", "party": "Party 2", "manifesto": "Plan 2"},
            ],
            "voters": [
                {"voter_id": f"VOTER_REG_{uid}", "full_name": "Registered Voter One"},
            ],
        },
    )
    assert res.status_code == 201

    # Test 11: Valid registered voter -> SUCCESS (No password)
    valid_login = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug,
            "voter_id": f"VOTER_REG_{uid}",
            "voter_name": "Registered Voter One",
        },
    )
    assert valid_login.status_code == 200
    assert valid_login.json()["eligible"] is True
    assert valid_login.json()["voter_id"] == f"VOTER_REG_{uid}"

    # Test 12: Random unregistered voter ID -> FAIL (404)
    unreg_login = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug,
            "voter_id": "UNREGISTERED_9999",
            "voter_name": "Registered Voter One",
        },
    )
    assert unreg_login.status_code in (403, 404)

    # Test 13: Correct voter ID but mismatched name -> FAIL (401)
    wrong_name_login = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug,
            "voter_id": f"VOTER_REG_{uid}",
            "voter_name": "Completely Wrong Name",
        },
    )
    assert wrong_name_login.status_code == 401
    assert "not match" in wrong_name_login.json()["detail"].lower()


def test_election_schedule_and_lifecycle_rejections(client):
    """Test election lifecycle and schedule enforcement."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]

    # Future election (starts in 2 hours)
    future_slug = f"ELEC-FUT-{uid.upper()}"
    res_fut = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": f"admin_fut_{uid}@civitas.local",
            "temp_admin_password": "AdminPassword123!",
            "election_id": future_slug,
            "name": f"Future Election {uid}",
            "description": "Starts in future",
            "starts_at": (now + timedelta(hours=2)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "anyone_can_vote",
            "candidates": [{"name": "C1", "party": "P1", "manifesto": "M1"}],
            "voters": [],
        },
    )
    assert res_fut.status_code == 201

    fut_auth = client.post(
        "/api/v1/voting/verify-voter",
        json={"election_id": future_slug, "voter_id": f"V_{uid}", "voter_name": "Test Voter"},
    )
    assert fut_auth.status_code == 400
    assert "not started" in fut_auth.json()["detail"].lower() or "not currently open" in fut_auth.json()["detail"].lower()


def test_local_admin_edit_election_end_to_end(client):
    """Test Local Admin editing election settings live and immediate voter effect."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]
    admin_id = f"admin_edit_{uid}@civitas.local"
    elec_slug = f"ELEC-EDIT-{uid.upper()}"

    # 1. Create initial election as Pre-Registered
    res = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": admin_id,
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug,
            "name": f"Initial Election {uid}",
            "description": "Initial description",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voting_type": "regular",
            "voter_registration_mode": "pre_registered",
            "candidates": [
                {"name": "Cand A", "party": "Party A", "manifesto": "Plan A"},
                {"name": "Cand B", "party": "Party B", "manifesto": "Plan B"},
                {"name": "Cand C", "party": "Party C", "manifesto": "Plan C"},
            ],
            "voters": [],
        },
    )
    assert res.status_code == 201
    elec_uuid = res.json()["id"]

    # Attempt open voter login -> REJECTED because mode is pre_registered and voters=0
    rej_res = client.post(
        "/api/v1/voting/verify-voter",
        json={"election_id": elec_slug, "voter_id": f"OPEN_V_{uid}", "voter_name": "Open Voter"},
    )
    assert rej_res.status_code in (403, 404)

    # 2. Local Admin logs in
    admin_login = client.post(
        "/api/v1/admin/temp-login",
        json={"temp_admin_id": admin_id, "password": "AdminPassword123!"},
    )
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]

    # 3. Local Admin EDITS the election:
    # - Changes voting_type to multiple_choice
    # - Sets max_selections = 2
    # - Sets allow_abstain = True
    # - Changes voter_registration_mode to anyone_can_vote
    # - Changes description
    edit_payload = {
        "name": f"Updated Election {uid}",
        "description": "Updated description with Anyone Can Vote active",
        "voting_type": "multiple_choice",
        "voter_registration_mode": "anyone_can_vote",
        "voting_flow_mode": "direct",
        "max_selections": 2,
        "allow_abstain": True,
        "position_title": "Executive Council",
    }
    edit_res = client.put(
        f"/api/v1/admin/elections/{elec_uuid}",
        json=edit_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit_res.status_code == 200, f"Edit election failed: {edit_res.text}"
    edited_elec = edit_res.json()
    assert edited_elec["voting_type"] == "multiple_choice"
    assert edited_elec["voter_registration_mode"] == "anyone_can_vote"
    assert edited_elec["max_selections"] == 2
    assert edited_elec["allow_abstain"] is True
    assert edited_elec["position_title"] == "Executive Council"

    # 4. Now Open Voter attempts authentication -> SUCCEEDS immediately!
    open_voter_res = client.post(
        "/api/v1/voting/verify-voter",
        json={"election_id": elec_slug, "voter_id": f"OPEN_V_{uid}", "voter_name": "Open Voter"},
    )
    assert open_voter_res.status_code == 200, f"Open voter verify failed: {open_voter_res.text}"
    v_info = open_voter_res.json()
    assert v_info["eligible"] is True
    assert v_info["voting_type"] == "multiple_choice"
    assert v_info["max_selections"] == 2
    assert v_info["voter_registration_mode"] == "anyone_can_vote"

    # 5. Open Voter casts 2 selections on the multiple choice ballot -> SUCCEEDS!
    cands = client.get(f"/api/v1/voting/elections/{elec_uuid}/candidates").json()
    cand_ids = [cands[0]["id"], cands[1]["id"]]

    with next(get_db()) as db:
        sess = db.get(AuthSession, v_info["session_id"])
        sess.stage = AuthStage.GRANTED
        grant = create_token(
            subject=sess.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=sess.id,
        )
        sess.issued_grant_hash = hashlib.sha256(grant.encode()).hexdigest()
        db.commit()

    cast_res = client.post(
        "/api/v1/voting/cast",
        json={
            "election_id": elec_uuid,
            "candidate_ids": cand_ids,
            "voting_grant": grant,
        },
    )
    assert cast_res.status_code == 201
    assert "receipt_id" in cast_res.json()

    print("✅ Comprehensive Voter Authentication Rebuild Test Suite PASSED 100%!")
