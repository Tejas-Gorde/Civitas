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

def test_e2e_isolation(db_session: Session):
    admin_token = create_admin_token(db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    start_time = datetime.now(timezone.utc) - timedelta(hours=1)
    end_time = start_time + timedelta(hours=2)
    
    import uuid
    uid_a = str(uuid.uuid4())[:8]
    uid_b = str(uuid.uuid4())[:8]
    
    # ELECTION A
    temp_admin_a = f"temp_admin_a_{uid_a}"
    election_data_a = {
        "name": f"E2E Isolation A {uid_a}",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "pre_registered",
        "voting_flow_mode": "direct",
        "candidates": [{"name": "Alice A"}],
        "voters": [{"voter_id": f"VOTER-A-{uid_a}", "full_name": "Voter A"}],
        "temp_admin_id": temp_admin_a,
        "temp_admin_password": "password123"
    }
    res = client.post("/api/v1/admin/elections/onboarding", json=election_data_a, headers=headers)
    assert res.status_code == 201
    election_id_a = res.json()["id"]

    # ELECTION B
    temp_admin_b = f"temp_admin_b_{uid_b}"
    election_data_b = {
        "name": f"E2E Isolation B {uid_b}",
        "starts_at": start_time.isoformat(),
        "ends_at": end_time.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "pre_registered",
        "voting_flow_mode": "direct",
        "candidates": [{"name": "Bob B"}],
        "voters": [{"voter_id": f"VOTER-B-{uid_b}", "full_name": "Voter B"}],
        "temp_admin_id": temp_admin_b,
        "temp_admin_password": "password123"
    }
    res = client.post("/api/v1/admin/elections/onboarding", json=election_data_b, headers=headers)
    assert res.status_code == 201
    election_id_b = res.json()["id"]

    # Verify temp admin A can only access election A
    res = client.post("/api/v1/admin/temp-login", json={"temp_admin_id": temp_admin_a, "password": "password123"})
    temp_token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {temp_token_a}"}

    res = client.get("/api/v1/admin/elections", headers=headers_a)
    assert res.status_code == 200
    elections_list = res.json()
    assert len(elections_list) == 1
    assert elections_list[0]["id"] == election_id_a

    res = client.post(f"/api/v1/admin/elections/{election_id_b}/state", params={"target": "paused"}, headers=headers_a)
    assert res.status_code == 403, "Temp admin A changed Election B state!"

    # Verify voter A cannot authenticate in election B
    res = client.post("/api/v1/voting/authenticate", json={
        "election_id": election_id_b,
        "voter_id": f"VOTER-A-{uid_a}",
        "voter_name": "Voter A"
    })
    assert res.status_code in (401, 403, 404), "Voter A authenticated in Election B!"

    # Verify session from election A cannot be used to cast vote in election B
    res = client.post("/api/v1/voting/authenticate", json={
        "election_id": election_id_a,
        "voter_id": f"VOTER-A-{uid_a}",
        "voter_name": "Voter A"
    })
    assert res.status_code == 200
    session_id_a = res.json()["session_id"]
    
    res = client.post(f"/api/v1/biometric/risk?session_id={session_id_a}")
    assert res.status_code == 200
    grant_a = res.json()["voting_grant"]

    res = client.get(f"/api/v1/voting/elections/{election_id_b}/candidates")
    cand_b = res.json()[0]["id"]

    # Cast vote in election B using grant A
    res = client.post("/api/v1/voting/cast", json={
        "election_id": election_id_b,
        "candidate_id": cand_b,
        "voting_grant": grant_a
    })
    assert res.status_code in (401, 403), "Voter A cast vote in Election B using Election A grant!"
