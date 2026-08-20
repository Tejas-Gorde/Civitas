import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.main import app
from app.models import Election, ElectionState, User, Voter, Role
from app.core.security import create_token, password_hash

client = TestClient(app)

def create_admin_token(db: Session):
    admin_user = db.query(User).filter(User.email == "testadmin@civitas.internal").first()
    if not admin_user:
        admin_user = User(
            email="testadmin@civitas.internal",
            password_hash=password_hash("adminpass"),
            role=Role.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
    
    return create_token(subject=admin_user.id, role="admin", kind="access", lifetime=timedelta(hours=1))

def test_e2e_regular_pre_registered(db_session: Session):
    admin_token = create_admin_token(db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Create Election
    start_time = datetime.now(timezone.utc)
    end_time = start_time + timedelta(hours=2)
    
    import uuid
    uid = str(uuid.uuid4())[:8]
    temp_admin_id = f"temp_admin_{uid}"
    
    election_data = {
        "name": f"E2E Regular Pre-Registered {uid}",
        "description": "Testing regular voting",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "pre_registered",
        "voting_flow_mode": "direct",
        "candidates": [
            {"name": "Alice Smith", "party": "Party A", "manifesto": "Vote for A"},
            {"name": "Bob Jones", "party": "Party B", "manifesto": "Vote for B"}
        ],
        "voters": [
            {"voter_id": f"VOTER-{uid}", "full_name": "Test Voter One"}
        ],
        "temp_admin_id": temp_admin_id,
        "temp_admin_password": "password123"
    }

    res = client.post("/api/v1/admin/elections/onboarding", json=election_data, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    election_id = data["id"]
    
    # Fetch candidates
    res = client.get(f"/api/v1/voting/elections/{election_id}/candidates")
    assert res.status_code == 200, res.text
    candidates = res.json()
    candidate_id_alice = next(c["id"] for c in candidates if c["name"] == "Alice Smith")
    
    # Login as temp admin to modify election
    res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": temp_admin_id,
        "password": "password123"
    })
    assert res.status_code == 200, res.text
    temp_admin_token = res.json()["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_admin_token}"}
    
    # 2. Open Election (if needed)
    if data.get("state") != "open":
        res = client.post(f"/api/v1/admin/elections/{election_id}/state", params={"target": "open"}, headers=temp_headers)
        assert res.status_code == 200, res.text

    # 3. Voter Authentication (Valid)
    auth_req = {
        "election_id": election_id,
        "voter_id": f"VOTER-{uid}",
        "voter_name": "Test Voter One"
    }
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    assert res.status_code == 200, res.text
    auth_data = res.json()
    assert auth_data["eligible"] is True
    session_id = auth_data["session_id"]

    # 4. Verification Grant
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    assert res.status_code == 200, res.text
    voting_grant = res.json()["voting_grant"]

    # 5. Cast Vote
    vote_data = {
        "election_id": election_id,
        "candidate_id": candidate_id_alice,
        "voting_grant": voting_grant
    }
    res = client.post("/api/v1/voting/cast", json=vote_data)
    assert res.status_code == 201, res.text
    receipt_id = res.json()["receipt_id"]

    # 6. Verify duplicate voting prevention
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    assert res.status_code == 409, "Should not authenticate if already voted"

    # 7. Close Election
    res = client.post(f"/api/v1/admin/elections/{election_id}/state", params={"target": "closed"}, headers=temp_headers)
    assert res.status_code == 200, res.text

    # 8. Verify Results
    res = client.get(f"/api/v1/admin/elections/{election_id}/summary-results", headers=temp_headers)
    assert res.status_code == 200, res.text
    results = res.json()
    assert results["total_votes_cast"] == 1
    alice_tally = next(c for c in results["candidates"] if c["id"] == candidate_id_alice)

def test_e2e_regular_anyone_can_vote(db_session: Session):
    admin_token = create_admin_token(db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Create Election
    start_time = datetime.now(timezone.utc)
    end_time = start_time + timedelta(hours=2)
    
    import uuid
    uid = str(uuid.uuid4())[:8]
    temp_admin_id = f"temp_admin_{uid}"
    
    election_data = {
        "name": f"E2E Regular Anyone Can Vote {uid}",
        "description": "Testing anyone can vote",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "anyone_can_vote",
        "voting_flow_mode": "direct",
        "candidates": [
            {"name": "Alice Smith", "party": "Party A", "manifesto": "Vote for A"}
        ],
        "voters": [],  # NO VOTERS PRE-REGISTERED
        "temp_admin_id": temp_admin_id,
        "temp_admin_password": "password123"
    }

    res = client.post("/api/v1/admin/elections/onboarding", json=election_data, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    election_id = data["id"]
    
    # Fetch candidates
    res = client.get(f"/api/v1/voting/elections/{election_id}/candidates")
    assert res.status_code == 200, res.text
    candidates = res.json()
    candidate_id_alice = candidates[0]["id"]
    
    # Login as temp admin to modify election
    res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": temp_admin_id,
        "password": "password123"
    })
    assert res.status_code == 200, res.text
    temp_admin_token = res.json()["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_admin_token}"}
    
    # 2. Open Election (if needed)
    if data.get("state") != "open":
        res = client.post(f"/api/v1/admin/elections/{election_id}/state", params={"target": "open"}, headers=temp_headers)
        assert res.status_code == 200, res.text

    # 3. Voter Authentication (Anyone Can Vote)
    auth_req = {
        "election_id": election_id,
        "voter_id": f"QUICK-ID-{uid}",
        "voter_name": "Quick Voter"
    }
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    assert res.status_code == 200, res.text
    auth_data = res.json()
    assert auth_data["eligible"] is True
    session_id = auth_data["session_id"]

    # 4. Verification Grant
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    assert res.status_code == 200, res.text
    voting_grant = res.json()["voting_grant"]

    # 5. Cast Vote
    vote_data = {
        "election_id": election_id,
        "candidate_id": candidate_id_alice,
        "voting_grant": voting_grant
    }
    res = client.post("/api/v1/voting/cast", json=vote_data)
    assert res.status_code == 201, res.text

    # 6. Verify duplicate voting prevention (Quick Voter uses PRN)
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    assert res.status_code == 409, "Should not authenticate if already voted"
