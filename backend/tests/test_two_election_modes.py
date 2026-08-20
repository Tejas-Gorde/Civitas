"""Comprehensive Test Suite for Two Explicit Election Modes:
- Mode 1: Normal Voting (Registered Voters, Full Name + Voter ID, eligibility validation)
- Mode 2: Express Voting — Anyone Can Vote (Name ONLY, no voter_id, no voter_password)
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, get_db
from app.models import AuthSession, AuthStage, Role, User, Voter
from app.core.security import create_token


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_express_voting_mode_name_only(client):
    """TEST 1, 2, 3, 6, 7: Express Voting with Name ONLY (Tejas, ABC123, Rahul)."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]
    elec_slug = f"ELEC-EXP-{uid.upper()}"

    # 1. Create Express Voting Election
    create_res = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": f"admin_exp_{uid}@civitas.local",
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug,
            "name": f"Express Election {uid}",
            "description": "Express election with name-only authentication",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "express",
            "candidates": [
                {"name": "Option 1", "party": "Party 1", "manifesto": "Plan 1"},
                {"name": "Option 2", "party": "Party 2", "manifesto": "Plan 2"},
            ],
            "voters": [],
        },
    )
    assert create_res.status_code == 201
    elec_data = create_res.json()
    elec_uuid = elec_data["id"]

    # TEST 1: Name = Tejas
    req_tejas = {
        "election_id": elec_slug,
        "voter_name": "Tejas",
    }
    # Direct check: Request contains NO voter_id and NO voter_password
    assert "voter_id" not in req_tejas
    assert "voter_password" not in req_tejas

    res_tejas = client.post("/api/v1/voting/express/authenticate", json=req_tejas)
    assert res_tejas.status_code == 200, f"Express auth failed: {res_tejas.text}"
    body_tejas = res_tejas.json()
    assert body_tejas["eligible"] is True
    assert body_tejas["session_id"] is not None
    assert body_tejas["voter_registration_mode"] == "express"

    # Also test standard verify-voter endpoint with express payload
    res_tejas_std = client.post("/api/v1/voting/verify-voter", json=req_tejas)
    assert res_tejas_std.status_code == 200
    assert res_tejas_std.json()["eligible"] is True

    # TEST 2: Name = ABC123
    req_abc = {
        "election_id": elec_slug,
        "voter_name": "ABC123",
    }
    res_abc = client.post("/api/v1/voting/express/authenticate", json=req_abc)
    assert res_abc.status_code == 200
    assert res_abc.json()["eligible"] is True

    # TEST 3: Name = Rahul
    req_rahul = {
        "election_id": elec_slug,
        "voter_name": "Rahul",
    }
    res_rahul = client.post("/api/v1/voting/express/authenticate", json=req_rahul)
    assert res_rahul.status_code == 200
    assert res_rahul.json()["eligible"] is True

    # TEST 7: Confirm backend does NOT return 'Field voter_password: Field required' or 422
    assert "voter_password" not in res_tejas.text
    assert "Field required" not in res_tejas.text

    # Complete Ballot Cast for Tejas
    sess_id = body_tejas["session_id"]
    with next(get_db()) as db:
        sess = db.get(AuthSession, sess_id)
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

    cands = client.get(f"/api/v1/voting/elections/{elec_uuid}/candidates").json()
    cast_res = client.post(
        "/api/v1/voting/cast",
        json={
            "election_id": elec_uuid,
            "candidate_id": cands[0]["id"],
            "voting_grant": grant,
        },
    )
    assert cast_res.status_code == 201
    assert "receipt_id" in cast_res.json()


def test_normal_voting_mode_registered_voters(client):
    """TEST 4 & 5: Normal Voting with Registered Voters."""
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]
    elec_slug = f"ELEC-NORM-{uid.upper()}"

    # Create Normal Voting Election with 1 Registered Voter
    create_res = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": f"admin_norm_{uid}@civitas.local",
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_slug,
            "name": f"Normal Election {uid}",
            "description": "Normal election with registered voters",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "normal",
            "candidates": [
                {"name": "Candidate A", "party": "Party A", "manifesto": "Plan A"},
                {"name": "Candidate B", "party": "Party B", "manifesto": "Plan B"},
            ],
            "voters": [
                {"voter_id": f"VOTER_REG_{uid}", "full_name": "Official Registered Voter"},
            ],
        },
    )
    assert create_res.status_code == 201

    # TEST 4: Valid registered voter credentials -> SUCCESS
    valid_login = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug,
            "voter_id": f"VOTER_REG_{uid}",
            "voter_name": "Official Registered Voter",
        },
    )
    assert valid_login.status_code == 200
    assert valid_login.json()["eligible"] is True
    assert valid_login.json()["voter_id"] == f"VOTER_REG_{uid}"

    # TEST 5A: Unregistered voter -> FAIL (404)
    unreg_login = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_slug,
            "voter_id": "UNKNOWN_VOTER_9999",
            "voter_name": "Official Registered Voter",
        },
    )
    assert unreg_login.status_code in (403, 404)

    # TEST 5B: Registered ID with wrong name -> FAIL (401)
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

    # TEST 5C: Express endpoint on Normal election -> Rejects because Normal requires voter_id
    express_attempt = client.post(
        "/api/v1/voting/express/authenticate",
        json={
            "election_id": elec_slug,
            "voter_name": "Arbitrary Person",
        },
    )
    assert express_attempt.status_code == 400
    assert "voter id is required" in express_attempt.json()["detail"].lower()
