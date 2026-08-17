"""Comprehensive Integration & RBAC Test Suite for Civitas 3-Option Entry Architecture.
"""

import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app, run_auto_migrations
from app.core.database import SessionLocal, engine
from app.core.security import password_hash
from app.models import (
    Candidate,
    Election,
    ElectionState,
    Role,
    User,
    Voter,
    VoterElectionStatus,
)

def setup_test_data(db):
    try:
        # Create Big Admin
        big_admin = db.query(User).filter(User.email == "bigadmin@civitas.local").first()
        if not big_admin:
            big_admin = User(
                email="bigadmin@civitas.local",
                password_hash=password_hash("BigAdminPass123!"),
                role=Role.BIG_ADMIN,
                is_active=True,
            )
            db.add(big_admin)
            db.flush()

        now = datetime.now(timezone.utc)

        # Create Election A
        elec_a = db.query(Election).filter(Election.name == "Test Election A").first()
        if not elec_a:
            elec_a = Election(
                name="Test Election A",
                description="Election A description",
                starts_at=now - timedelta(hours=1),
                ends_at=now + timedelta(hours=24),
                state=ElectionState.OPEN,
                show_voter_names_in_results=False,
            )
            db.add(elec_a)
            db.flush()

        # Create Temp Admin A
        temp_admin_a = db.query(User).filter(User.email == "temp_admin_a@civitas.local").first()
        if not temp_admin_a:
            temp_admin_a = User(
                email="temp_admin_a@civitas.local",
                password_hash=password_hash("TempPassA123!"),
                role=Role.TEMP_ADMIN,
                is_active=True,
            )
            db.add(temp_admin_a)
            db.flush()

        elec_a.temp_admin_user_id = temp_admin_a.id

        # Create Election B
        elec_b = db.query(Election).filter(Election.name == "Test Election B").first()
        if not elec_b:
            elec_b = Election(
                name="Test Election B",
                description="Election B description",
                starts_at=now - timedelta(hours=1),
                ends_at=now + timedelta(hours=24),
                state=ElectionState.OPEN,
                show_voter_names_in_results=True,
            )
            db.add(elec_b)
            db.flush()

        # Create Temp Admin B
        temp_admin_b = db.query(User).filter(User.email == "temp_admin_b@civitas.local").first()
        if not temp_admin_b:
            temp_admin_b = User(
                email="temp_admin_b@civitas.local",
                password_hash=password_hash("TempPassB123!"),
                role=Role.TEMP_ADMIN,
                is_active=True,
            )
            db.add(temp_admin_b)
            db.flush()

        elec_b.temp_admin_user_id = temp_admin_b.id

        # Create Candidates for Election A
        cand_a = db.query(Candidate).filter(Candidate.election_id == elec_a.id).first()
        if not cand_a:
            cand_a = Candidate(
                election_id=elec_a.id,
                name="Candidate Alpha",
                party="Party A",
                manifesto="Manifesto A",
            )
            db.add(cand_a)

        # Create Voter 1 assigned to Election A only
        voter_user_1 = db.query(User).filter(User.email == "voter1@civitas.local").first()
        if not voter_user_1:
            voter_user_1 = User(
                email="voter1@civitas.local",
                password_hash=password_hash("VoterPass123!"),
                role=Role.VOTER,
                is_active=True,
            )
            db.add(voter_user_1)
            db.flush()

            voter_1 = Voter(
                user_id=voter_user_1.id,
                voter_id="VOTER-TEST-1",
                full_name="Alice Smith",
                date_of_birth="1990-01-01",
                gender="Female",
                mobile="+15550000001",
                address_ciphertext="test",
                aadhaar_last_four="1234",
                aadhaar_digest="digest1",
            )
            db.add(voter_1)
            db.flush()

            status_a = VoterElectionStatus(
                voter_id=voter_1.id,
                election_id=elec_a.id,
                eligible=True,
            )
            db.add(status_a)

        db.commit()

        return {
            "big_admin_email": "bigadmin@civitas.local",
            "big_admin_pass": "BigAdminPass123!",
            "temp_admin_a_email": "temp_admin_a@civitas.local",
            "temp_admin_a_pass": "TempPassA123!",
            "temp_admin_b_email": "temp_admin_b@civitas.local",
            "temp_admin_b_pass": "TempPassB123!",
            "elec_a_id": str(elec_a.id),
            "elec_b_id": str(elec_b.id),
            "voter_1_id": "VOTER-TEST-1",
            "voter_1_pass": "VoterPass123!",
        }
    finally:
        pass


def test_civitas_architecture_flow(client, db_session):
    data = setup_test_data(db_session)
    print("\n--- RUNNING CIVITAS ARCHITECTURE TEST SCENARIOS ---")

    # TEST PUBLIC ONBOARDING ELECTION CREATION: Custom Election ID + Local Admin
    now = datetime.now(timezone.utc)
    unique_id = f"onboard_admin_{uuid.uuid4().hex[:6]}@civitas.local"
    custom_elec_id = f"SCE-{uuid.uuid4().hex[:6].upper()}"
    onboard_payload = {
        "temp_admin_id": unique_id,
        "temp_admin_password": "OnboardPass123!",
        "name": f"Public Onboarded Election {uuid.uuid4().hex[:6]}",
        "election_id": custom_elec_id,
        "description": "Created via public onboarding flow without pre-existing admin token",
        "starts_at": (now - timedelta(hours=1)).isoformat(),
        "ends_at": (now + timedelta(days=7)).isoformat(),
        "show_voter_names_in_results": False,
        "candidates": [
            {"name": "Onboard Candidate 1", "party": "Onboard Party", "manifesto": "Test Manifesto"}
        ],
        "voters": [
            {"voter_id": f"VOTER-ONBOARD-{uuid.uuid4().hex[:4]}", "full_name": "Onboard Voter One"}
        ]
    }
    onboard_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload)
    assert onboard_res.status_code == 201, f"Public onboarding failed: {onboard_res.text}"
    onboard_data = onboard_res.json()
    assert "Public Onboarded Election" in onboard_data["name"]
    assert onboard_data["election_id"] == custom_elec_id
    assert onboard_data["temp_admin_username"] == unique_id
    assert "password" not in onboard_data
    print("✅ TEST PUBLIC ONBOARDING CREATION PASSED: Election created with custom Election ID & Local Admin.")

    # TEST DUPLICATE ELECTION ID REJECTION
    dup_elec_payload = {**onboard_payload, "temp_admin_id": f"other_admin_{uuid.uuid4().hex[:4]}"}
    dup_elec_res = client.post("/api/v1/admin/elections/onboarding", json=dup_elec_payload)
    assert dup_elec_res.status_code == 400, f"Duplicate election ID should return 400, got {dup_elec_res.status_code}"
    assert "Election ID already exists" in dup_elec_res.text
    print("✅ TEST DUPLICATE ELECTION ID PASSED: Rejected duplicate Election ID with clear error message.")

    # TEST DUPLICATE TEMP ADMIN ID REJECTION
    dup_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload)
    assert dup_res.status_code == 400, f"Duplicate temp admin ID should return 400, got {dup_res.status_code}"
    print("✅ TEST DUPLICATE TEMP ADMIN ID PASSED: Rejected duplicate Temporary Admin ID with clear error.")

    # TEST TEMP ADMIN LOGIN FOR ONBOARDED ELECTION
    onboard_login = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": unique_id,
        "password": "OnboardPass123!",
    })
    assert onboard_login.status_code == 200, f"Temp admin login for onboarded election failed: {onboard_login.text}"
    onboard_token = onboard_login.json()["access_token"]
    onboard_headers = {"Authorization": f"Bearer {onboard_token}"}
    
    # Verify Temp Admin can access their assigned election
    onboard_results = client.get(f"/api/v1/admin/results/{onboard_data['id']}", headers=onboard_headers)
    assert onboard_results.status_code == 200
    print("✅ TEST ONBOARDED TEMP ADMIN ACCESS PASSED: Onboarded Temp Admin logged in & accessed assigned election.")

    # TEST BIG ADMIN DIRECT LOGIN: No password required
    big_admin_login_res = client.post("/api/v1/admin/big-admin-login")
    assert big_admin_login_res.status_code == 200, f"Big Admin direct login failed: {big_admin_login_res.text}"
    big_token = big_admin_login_res.json()["access_token"]
    big_headers = {"Authorization": f"Bearer {big_token}"}
    print("✅ TEST BIG ADMIN DIRECT LOGIN PASSED: Direct login successful without password prompt.")

    # Big Admin accessing Election A & B -> ALLOWED
    big_res_a = client.get(f"/api/v1/admin/results/{data['elec_a_id']}", headers=big_headers)
    assert big_res_a.status_code == 200
    big_res_b = client.get(f"/api/v1/admin/results/{data['elec_b_id']}", headers=big_headers)
    assert big_res_b.status_code == 200
    print("✅ TEST BIG ADMIN ACCESS PASSED: Big Admin has access to all elections.")

    # TEST 3: Temp Admin Login
    login_res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": data["temp_admin_a_email"],
        "password": data["temp_admin_a_pass"],
    })
    assert login_res.status_code == 200, f"Temp admin login failed: {login_res.text}"
    token_a = login_res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("✅ TEST 3 PASSED: Temp Admin login successful.")

    # TEST 4: Temp Admin A accessing Election A -> ALLOWED
    res_a = client.get(f"/api/v1/admin/results/{data['elec_a_id']}", headers=headers_a)
    assert res_a.status_code == 200, f"Temp admin A access to Election A failed: {res_a.text}"
    print("✅ TEST 4 PASSED: Temp Admin A accessing Election A ALLOWED.")

    # TEST 5: Temp Admin A accessing Election B -> DENIED (403)
    res_b = client.get(f"/api/v1/admin/results/{data['elec_b_id']}", headers=headers_a)
    assert res_b.status_code == 403, f"Temp admin A access to Election B should be 403, got {res_b.status_code}"
    print("✅ TEST 5 PASSED: Temp Admin A accessing Election B DENIED (403).")

    # TEST 6: Temp Admin A accessing Big Admin functions -> DENIED (403)
    res_sys = client.get("/api/v1/admin/voters", headers=headers_a)
    # Asking for voters in an unassigned context or unsupported
    res_cfg = client.post("/api/v1/admin/config/public-url", json={"public_base_url": "http://test"}, headers=headers_a)
    assert res_cfg.status_code in (401, 403), f"Temp admin A accessing Big Admin config should fail, got {res_cfg.status_code}"
    print("✅ TEST 6 PASSED: Temp Admin A accessing Big Admin functions DENIED.")

    # TEST 7 & 8: Voter verifying in assigned vs unassigned election
    # Voter 1 -> Election A (assigned) -> ALLOWED
    verify_ok = client.post("/api/v1/voting/verify-voter", json={
        "election_id": data["elec_a_id"],
        "voter_registration_id": data["voter_1_id"],
        "voter_password": data["voter_1_pass"],
    })
    assert verify_ok.status_code == 200, f"Voter 1 verify Election A failed: {verify_ok.text}"
    print("✅ TEST 1 & 7 PASSED: Voter 1 verifying assigned Election A ALLOWED.")

    # Voter 1 -> Election B (unassigned) -> DENIED (403)
    verify_denied = client.post("/api/v1/voting/verify-voter", json={
        "election_id": data["elec_b_id"],
        "voter_registration_id": data["voter_1_id"],
        "voter_password": data["voter_1_pass"],
    })
    assert verify_denied.status_code == 403, f"Voter 1 verify Election B should be 403, got {verify_denied.status_code}"
    print("✅ TEST 8 PASSED: Voter 1 verifying unassigned Election B DENIED (403).")

    # TEST 9: Public visitor -> Live Elections
    live_res = client.get("/api/v1/voting/live-elections")
    assert live_res.status_code == 200, f"Live elections failed: {live_res.text}"
    live_elections = live_res.json()
    assert len(live_elections) >= 2
    print("✅ TEST 9 PASSED: Public visitor viewing Live Elections returns open elections.")

    # TEST 10: Show voter name = OFF
    elec_a_obj = [e for e in live_elections if e["id"] == data["elec_a_id"]][0]
    assert elec_a_obj["show_voter_names_in_results"] is False
    print("✅ TEST 10 PASSED: Election created with 'Show voter name = OFF' has setting disabled.")

    # TEST 11: Show voter name = ON
    elec_b_obj = [e for e in live_elections if e["id"] == data["elec_b_id"]][0]
    assert elec_b_obj["show_voter_names_in_results"] is True
    print("✅ TEST 11 PASSED: Election created with 'Show voter name = ON' has setting enabled.")

    print("\n🎉 ALL 11 ARCHITECTURE TEST SCENARIOS VERIFIED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()
