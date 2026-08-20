"""End-to-End Verification Test for Passwordless Voter Registration, Authentication, and Isolation.
"""

import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app, run_auto_migrations
from app.core.database import SessionLocal, engine
from app.models import (
    Candidate,
    Election,
    ElectionState,
    Role,
    User,
    Voter,
    VoterElectionStatus,
)

def test_complete_voter_registration_and_authentication_flow(client, db_session):
    now = datetime.now(timezone.utc)

    # 1. Create Election A via Onboarding Endpoint
    admin_id_a = f"local_admin_a_{uuid.uuid4().hex[:6]}@civitas.local"
    election_id_a = f"ELEC-A-{uuid.uuid4().hex[:6].upper()}"
    onboard_payload_a = {
        "temp_admin_id": admin_id_a,
        "temp_admin_password": "LocalAdminPass123!",
        "name": f"Test Election A {uuid.uuid4().hex[:6]}",
        "election_id": election_id_a,
        "description": "Election A testing voter authentication",
        "starts_at": (now - timedelta(hours=1)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "candidates": [
            {"name": "Candidate A1", "party": "Party A", "manifesto": "Manifesto A"}
        ],
        "voters": [
            {
                "voter_id": "VOTER-ALPHA",
                "full_name": "Alpha Voter",
            }
        ],
    }

    create_a_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload_a)
    assert create_a_res.status_code == 201, f"Election A creation failed: {create_a_res.text}"
    data_a = create_a_res.json()
    internal_election_id_a = data_a["id"]
    assert data_a["election_id"] == election_id_a

    # 2. Local Admin Login for Election A
    login_a_res = client.post(
        "/api/v1/admin/temp-login",
        json={"temp_admin_id": admin_id_a, "password": "LocalAdminPass123!"},
    )
    assert login_a_res.status_code == 200, f"Local Admin A login failed: {login_a_res.text}"
    token_a = login_a_res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Local Admin Registers Voter "beta" without Password
    voter_beta_payload = {
        "voter_id": "VOTER-BETA",
        "full_name": "Beta Voter",
        "election_id": internal_election_id_a,
    }
    reg_beta_res = client.post(
        f"/api/v1/admin/elections/{internal_election_id_a}/voters",
        json=voter_beta_payload,
        headers=headers_a,
    )
    assert reg_beta_res.status_code == 201, f"Voter Beta registration failed: {reg_beta_res.text}"

    # 4. Duplicate Voter ID Registration for Same Election must return 409
    dup_res = client.post(
        f"/api/v1/admin/elections/{internal_election_id_a}/voters",
        json=voter_beta_payload,
        headers=headers_a,
    )
    assert dup_res.status_code == 409, f"Duplicate voter should return 409, got {dup_res.status_code}"
    assert "already registered for this election" in dup_res.text

    # 5. Verify Voter Portal Authentication for VOTER-ALPHA (Voter Name + Voter ID)
    verify_alpha = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": election_id_a,
            "voter_id": "VOTER-ALPHA",
            "voter_name": "Alpha Voter",
        },
    )
    assert verify_alpha.status_code == 200, f"Voter Alpha auth failed: {verify_alpha.text}"
    alpha_data = verify_alpha.json()
    assert alpha_data["eligible"] is True
    assert alpha_data["voter_id"] == "VOTER-ALPHA"

    # 6. Verify Voter Portal Authentication for VOTER-BETA
    verify_beta = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": election_id_a,
            "voter_id": "VOTER-BETA",
            "voter_name": "Beta Voter",
        },
    )
    assert verify_beta.status_code == 200, f"Voter Beta auth failed: {verify_beta.text}"

    # 7. Test Wrong Name Rejection for Valid Voter ID
    verify_wrong_name = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": election_id_a,
            "voter_id": "VOTER-BETA",
            "voter_name": "Wrong Person Name",
        },
    )
    assert verify_wrong_name.status_code == 401, f"Wrong name should return 401, got {verify_wrong_name.status_code}"
    assert "Voter name and voter ID do not match" in verify_wrong_name.text

    # 8. Test Edit Voter (Update Full Name & Voter ID)
    voter_beta_db_id = reg_beta_res.json()["id"]
    edit_res = client.put(
        f"/api/v1/admin/voters/{voter_beta_db_id}",
        json={"voter_id": "VOTER-BETA-NEW", "full_name": "Beta Updated Voter"},
        headers=headers_a,
    )
    assert edit_res.status_code == 200, f"Edit voter failed: {edit_res.text}"

    # Verify authentication with NEW name and ID
    verify_beta_new = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": election_id_a,
            "voter_id": "VOTER-BETA-NEW",
            "voter_name": "Beta Updated Voter",
        },
    )
    assert verify_beta_new.status_code == 200, "Voter Beta auth with updated credentials failed"

    # 9. Test Election Isolation: Create Election B and verify VOTER-BETA cannot access Election B
    admin_id_b = f"local_admin_b_{uuid.uuid4().hex[:6]}@civitas.local"
    election_id_b = f"ELEC-B-{uuid.uuid4().hex[:6].upper()}"
    onboard_payload_b = {
        "temp_admin_id": admin_id_b,
        "temp_admin_password": "LocalAdminPass123!",
        "name": f"Test Election B {uuid.uuid4().hex[:6]}",
        "election_id": election_id_b,
        "starts_at": (now - timedelta(hours=1)).isoformat(),
        "ends_at": (now + timedelta(days=1)).isoformat(),
        "candidates": [{"name": "Candidate B1", "party": "Party B", "manifesto": "Manifesto B"}],
    }
    create_b_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload_b)
    assert create_b_res.status_code == 201

    # Attempt login for Election B with VOTER-BETA credentials (not registered for Election B)
    verify_cross_election = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": election_id_b,
            "voter_id": "VOTER-BETA-NEW",
            "voter_name": "Beta Updated Voter",
        },
    )
    assert verify_cross_election.status_code == 403, f"Cross-election access should return 403, got {verify_cross_election.status_code}"
    assert "Voter is not registered for this election" in verify_cross_election.text
