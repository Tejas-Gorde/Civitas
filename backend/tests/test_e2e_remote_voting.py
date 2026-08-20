import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.main import app
from app.models import User, Role
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

def test_e2e_remote_voting(db_session: Session):
    admin_token = create_admin_token(db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    start_time = datetime.now(timezone.utc) - timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    
    import uuid
    uid = str(uuid.uuid4())[:8]
    temp_admin_id = f"temp_admin_remote_{uid}"
    
    election_data = {
        "name": f"E2E Remote {uid}",
        "description": "Testing remote voting",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "pre_registered",
        "voting_flow_mode": "direct",
        "candidates": [
            {"name": "Alice", "party": "None", "manifesto": ""}
        ],
        "voters": [
            {"voter_id": f"VOTER-{uid}", "full_name": "Test Voter"}
        ],
        "temp_admin_id": temp_admin_id,
        "temp_admin_password": "password123"
    }

    res = client.post("/api/v1/admin/elections/onboarding", json=election_data, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    election_id = data["id"]
    
    res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": temp_admin_id,
        "password": "password123"
    })
    temp_admin_token = res.json()["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_admin_token}"}

    # 1. Enable remote voting
    res = client.post(f"/api/v1/admin/elections/{election_id}/remote-voting/enable", headers=temp_headers)
    assert res.status_code == 200, res.text
    assert res.json()["remote_voting_enabled"] is True

    # 2. Get the token
    res = client.get(f"/api/v1/admin/elections/{election_id}/remote-voting", headers=temp_headers)
    assert res.status_code == 200, res.text
    token = res.json()["secure_voting_token"]
    assert token

    # 3. Verify token as voter
    res = client.get(f"/api/v1/voting/verify-token/{token}")
    assert res.status_code == 200, res.text
    assert res.json()["valid"] is True

    # 4. Authenticate and vote
    auth_req = {
        "election_id": election_id,
        "voter_id": f"VOTER-{uid}",
        "voter_name": "Test Voter"
    }
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    session_id = res.json()["session_id"]
    
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    voting_grant = res.json()["voting_grant"]

    res = client.get(f"/api/v1/voting/elections/{election_id}/candidates")
    candidates = res.json()
    candidate_id = candidates[0]["id"]

    vote_data = {
        "election_id": election_id,
        "candidate_id": candidate_id,
        "voting_grant": voting_grant
    }
    res = client.post("/api/v1/voting/cast", json=vote_data)
    assert res.status_code == 201, res.text

    # 5. Disable remote voting
    res = client.post(f"/api/v1/admin/elections/{election_id}/remote-voting/disable", headers=temp_headers)
    assert res.status_code == 200, res.text
    
    # 6. Verify token again (should fail)
    res = client.get(f"/api/v1/voting/verify-token/{token}")
    assert res.status_code == 403, "Should reject when remote voting disabled"
