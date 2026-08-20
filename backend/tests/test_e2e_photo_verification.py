import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import io

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

def test_e2e_photo_verification(db_session: Session):
    admin_token = create_admin_token(db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    start_time = datetime.now(timezone.utc)
    end_time = start_time + timedelta(hours=2)
    
    import uuid
    uid = str(uuid.uuid4())[:8]
    temp_admin_id = f"temp_admin_photo_{uid}"
    
    election_data = {
        "name": f"E2E Photo Flow {uid}",
        "description": "Testing full verification flow",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "pre_registered",
        "voting_flow_mode": "full",
        "enable_step_3": True,
        "enable_step_4": True,
        "candidates": [
            {"name": "Alice", "party": "None", "manifesto": ""},
            {"name": "Bob", "party": "None", "manifesto": ""}
        ],
        "voters": [
            {"voter_id": f"VOTER-{uid}", "full_name": "Photo Voter"}
        ],
        "temp_admin_id": temp_admin_id,
        "temp_admin_password": "password123"
    }

    res = client.post("/api/v1/admin/elections/onboarding", json=election_data, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    election_id = data["id"]
    
    res = client.get(f"/api/v1/voting/elections/{election_id}/candidates")
    candidates = res.json()
    candidate_id = candidates[0]["id"]
    
    res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": temp_admin_id,
        "password": "password123"
    })
    temp_admin_token = res.json()["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_admin_token}"}
    
    if data.get("state") != "open":
        client.post(f"/api/v1/admin/elections/{election_id}/state", params={"target": "open"}, headers=temp_headers)

    auth_req = {
        "election_id": election_id,
        "voter_id": f"VOTER-{uid}",
        "voter_name": "Photo Voter"
    }
    res = client.post("/api/v1/voting/authenticate", json=auth_req)
    assert res.status_code == 200, res.text
    session_id = res.json()["session_id"]

    # 1. Try to get risk grant early (should fail)
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    assert res.status_code == 403, "Should reject before photo capture"

    # 2. Upload photo
    fake_image = io.BytesIO(b"fake image data")
    fake_image.name = "photo.jpg"
    files = {"file": ("photo.jpg", fake_image, "image/jpeg")}
    res = client.post(f"/api/v1/voting/sessions/{session_id}/photo", files=files)
    assert res.status_code == 200, res.text

    # 3. Try risk grant again (should fail because challenge is not completed)
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    assert res.status_code == 403, "Should reject before challenge"

    # 4. Complete challenge
    res = client.post("/api/v1/biometric/challenge", json={
        "session_id": session_id,
        "observed_action": "smile"
    })
    assert res.status_code == 200, res.text

    # 5. Get risk grant (should pass)
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id}")
    assert res.status_code == 200, res.text
    voting_grant = res.json()["voting_grant"]

    # 6. Cast Vote
    vote_data = {
        "election_id": election_id,
        "candidate_id": candidate_id,
        "voting_grant": voting_grant
    }
    res = client.post("/api/v1/voting/cast", json=vote_data)
    assert res.status_code == 201, res.text

    client.post(f"/api/v1/admin/elections/{election_id}/state", params={"target": "closed"}, headers=temp_headers)
    
    res = client.get(f"/api/v1/admin/elections/{election_id}/summary-results", headers=temp_headers)
    results = res.json()
    assert results["total_votes_cast"] == 1
