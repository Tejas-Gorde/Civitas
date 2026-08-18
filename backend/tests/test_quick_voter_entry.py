import io
import re
import uuid
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import openpyxl
from sqlalchemy import select
from app.main import app
from app.core.database import Base, engine, get_db
from app.models import Election, ElectionState, QuickVoterRecord, Role, User, Vote, Voter
from app.core.security import create_token, password_hash


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_quick_voter_entry_full_lifecycle(client):
    unique_suffix = uuid.uuid4().hex[:6]
    admin_id = f"qadmin_{unique_suffix}"
    custom_elec_id = f"ELEC-QK-{unique_suffix}"
    elec_name = f"Student Council Election 2026 {unique_suffix}"

    starts = datetime.now(timezone.utc) - timedelta(minutes=5)
    ends = datetime.now(timezone.utc) + timedelta(hours=2)

    onboard_payload = {
        "temp_admin_id": admin_id,
        "temp_admin_password": "Password123!",
        "election_id": custom_elec_id,
        "name": elec_name,
        "description": "Annual student council election with quick voter entry",
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "voting_type": "regular",
        "voter_registration_mode": "quick_entry",
        "voting_flow_mode": "full",
        "enable_step_2": False,
        "enable_step_3": False,
        "enable_step_4": False,
        "enable_step_5": False,
        "candidates": [
            {"name": "Alice Candidate", "party": "Party Blue", "manifesto": "Progress for all"},
            {"name": "Bob Candidate", "party": "Party Green", "manifesto": "Sustainability first"},
        ],
        "voters": [],
    }

    res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload)
    assert res.status_code == 201, res.text
    elec_data = res.json()
    elec_id = elec_data["id"]
    assert elec_data["voter_registration_mode"] == "quick_entry"

    # Get Candidates
    cands_res = client.get(f"/api/v1/voting/elections/{elec_id}/candidates")
    assert cands_res.status_code == 200
    candidates = cands_res.json()
    assert len(candidates) == 2
    alice_id = candidates[0]["id"]
    bob_id = candidates[1]["id"]

    # 2. Test Invalid PRNs (Scenario 3, 4, 5)
    # 9 digits -> 422
    res_9 = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Rahul Sharma",
        "prn": "123456789",
    })
    assert res_9.status_code == 422

    # 11 digits -> 422
    res_11 = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Rahul Sharma",
        "prn": "12345678901",
    })
    assert res_11.status_code == 422

    # Non-digit letters -> 422
    res_alpha = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Rahul Sharma",
        "prn": "12345ABCDE",
    })
    assert res_alpha.status_code == 422

    # 3. First Valid Quick Voter Verification (Scenario 2, 6)
    valid_prn_1 = "1234567890"
    res_v1 = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Rahul Sharma",
        "prn": "  1234567890  ",  # with spaces to test normalization
    })
    assert res_v1.status_code == 200, res_v1.text
    v1_data = res_v1.json()
    assert v1_data["eligible"] is True
    assert v1_data["prn"] == "1234567890"
    v1_session_id = v1_data["session_id"]

    # Advance Session to GRANTED
    with next(get_db()) as db:
        from app.models import AuthSession, AuthStage
        sess = db.get(AuthSession, v1_session_id)
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

    # Cast Vote for Alice
    cast_res = client.post("/api/v1/voting/cast", json={
        "election_id": elec_id,
        "candidate_id": alice_id,
        "voting_grant": grant_token,
    })
    assert cast_res.status_code == 201, cast_res.text
    receipt_1 = cast_res.json()["receipt_id"]
    assert len(receipt_1) > 0

    # 4. Same PRN tries again in SAME election -> Rejected (Scenario 7)
    dup_res = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Rahul Sharma",
        "prn": "1234567890",
    })
    assert dup_res.status_code == 409
    assert "already participated" in dup_res.json()["detail"]

    # 5. Second Voter (Amit Patil) votes for Bob
    valid_prn_2 = "9876543210"
    res_v2 = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Amit Patil",
        "prn": valid_prn_2,
    })
    assert res_v2.status_code == 200
    v2_session_id = res_v2.json()["session_id"]

    with next(get_db()) as db:
        sess = db.get(AuthSession, v2_session_id)
        sess.stage = AuthStage.GRANTED
        grant_token_2 = create_token(
            subject=sess.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=sess.id,
        )
        import hashlib
        sess.issued_grant_hash = hashlib.sha256(grant_token_2.encode()).hexdigest()
        db.commit()

    cast_res_2 = client.post("/api/v1/voting/cast", json={
        "election_id": elec_id,
        "candidate_id": bob_id,
        "voting_grant": grant_token_2,
    })
    assert cast_res_2.status_code == 201

    # 6. Same PRN 1234567890 participates in DIFFERENT Election (Scenario 8)
    admin_id_2 = f"qadmin2_{unique_suffix}"
    elec2_custom_id = f"ELEC-QK2-{unique_suffix}"
    elec2_name = f"Engineering Department Poll {unique_suffix}"
    onboard_payload_2 = {
        "temp_admin_id": admin_id_2,
        "temp_admin_password": "Password123!",
        "election_id": elec2_custom_id,
        "name": elec2_name,
        "description": "Department survey",
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "voting_type": "poll",
        "voter_registration_mode": "quick_entry",
        "voting_flow_mode": "full",
        "enable_step_2": False,
        "enable_step_3": False,
        "enable_step_4": False,
        "enable_step_5": False,
        "candidates": [
            {"name": "Option 1", "party": "Party 1", "manifesto": "M1"},
            {"name": "Option 2", "party": "Party 2", "manifesto": "M2"},
        ],
        "voters": [],
    }
    elec2_res = client.post("/api/v1/admin/elections/onboarding", json=onboard_payload_2)
    assert elec2_res.status_code == 201
    elec2_id = elec2_res.json()["id"]

    # PRN 1234567890 is allowed in Election 2!
    elec2_voter_res = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec2_id,
        "full_name": "Rahul Sharma",
        "prn": "1234567890",
    })
    assert elec2_voter_res.status_code == 200
    assert elec2_voter_res.json()["eligible"] is True

    # 7. Local Admin Views Results (Scenario 10, 11)
    login_res = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": admin_id,
        "password": "Password123!",
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    results_res = client.get(f"/api/v1/admin/elections/{elec_id}/results", headers=auth_headers)
    assert results_res.status_code == 200
    res_json = results_res.json()

    assert res_json["voter_registration_mode"] == "quick_entry"
    assert res_json["statistics"]["votes_cast"] == 2
    assert len(res_json["voter_records"]) == 2

    # Check Voter-wise Record table contents
    v_names = [vr["voter_name"] for vr in res_json["voter_records"]]
    prns = [vr["prn"] for vr in res_json["voter_records"]]
    assert "Rahul Sharma" in v_names
    assert "Amit Patil" in v_names
    assert "1234567890" in prns
    assert "9876543210" in prns

    # Check Candidate-centric voter grouping
    cand_voters = res_json["candidate_voters"]
    assert len(cand_voters) == 2
    alice_entry = next(c for c in cand_voters if c["candidate_name"] == "Alice Candidate")
    bob_entry = next(c for c in cand_voters if c["candidate_name"] == "Bob Candidate")
    assert alice_entry["total_votes"] == 1
    assert alice_entry["voters"][0]["name"] == "Rahul Sharma"
    assert bob_entry["total_votes"] == 1
    assert bob_entry["voters"][0]["name"] == "Amit Patil"

    # 8. Quick Election Excel Export (Scenario 12)
    excel_res = client.get(f"/api/v1/admin/elections/{elec_id}/export/excel", headers=auth_headers)
    assert excel_res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(excel_res.content))
    sheet_names = wb.sheetnames
    assert "Cover" in sheet_names
    assert "Results Dashboard" in sheet_names
    assert "Candidate-wise Results" in sheet_names
    assert "Voter-wise Vote Record" in sheet_names
    assert "Statistics" in sheet_names

    # Check Voter-wise Sheet
    ws_v = wb["Voter-wise Vote Record"]
    assert ws_v["B2"].value in ["Rahul Sharma", "Amit Patil"]

    # 9. Unauthorized Local Admin Access Check (Scenario 13)
    login_admin2 = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": admin_id_2,
        "password": "Password123!",
    })
    token_2 = login_admin2.json()["access_token"]
    unauth_headers = {"Authorization": f"Bearer {token_2}"}

    unauth_res = client.get(f"/api/v1/admin/elections/{elec_id}/results", headers=unauth_headers)
    assert unauth_res.status_code == 403

    unauth_excel = client.get(f"/api/v1/admin/elections/{elec_id}/export/excel", headers=unauth_headers)
    assert unauth_excel.status_code == 403


def test_quick_voter_entry_multiple_choice(client):
    unique_suffix = uuid.uuid4().hex[:6]
    admin_id = f"mc_admin_{unique_suffix}"
    custom_elec_id = f"ELEC-MCQ-{unique_suffix}"
    elec_name = f"Committee Multi Selection {unique_suffix}"

    starts = datetime.now(timezone.utc) - timedelta(minutes=5)
    ends = datetime.now(timezone.utc) + timedelta(hours=2)

    onboard = {
        "temp_admin_id": admin_id,
        "temp_admin_password": "Password123!",
        "election_id": custom_elec_id,
        "name": elec_name,
        "description": "Select multiple options",
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "voting_type": "multiple_choice",
        "voter_registration_mode": "quick_entry",
        "voting_flow_mode": "full",
        "enable_step_2": False,
        "enable_step_3": False,
        "enable_step_4": False,
        "enable_step_5": False,
        "candidates": [
            {"name": "Option Alpha", "party": "Category A", "manifesto": "A"},
            {"name": "Option Beta", "party": "Category B", "manifesto": "B"},
            {"name": "Option Gamma", "party": "Category C", "manifesto": "C"},
        ],
        "voters": [],
    }
    elec_res = client.post("/api/v1/admin/elections/onboarding", json=onboard)
    assert elec_res.status_code == 201, elec_res.text
    elec_id = elec_res.json()["id"]

    cands = client.get(f"/api/v1/voting/elections/{elec_id}/candidates").json()
    opt1 = cands[0]["id"]
    opt2 = cands[1]["id"]

    # Verify quick voter
    v_res = client.post("/api/v1/voting/verify-quick-voter", json={
        "election_id": elec_id,
        "full_name": "Tejas Gorde",
        "prn": "5555555555",
    })
    assert v_res.status_code == 200
    sess_id = v_res.json()["session_id"]

    with next(get_db()) as db:
        from app.models import AuthSession, AuthStage
        sess = db.get(AuthSession, sess_id)
        sess.stage = AuthStage.GRANTED
        grant = create_token(
            subject=sess.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=sess.id,
        )
        import hashlib
        sess.issued_grant_hash = hashlib.sha256(grant.encode()).hexdigest()
        db.commit()

    # Cast multiple options
    cast = client.post("/api/v1/voting/cast", json={
        "election_id": elec_id,
        "candidate_ids": [opt1, opt2],
        "voting_grant": grant,
    })
    assert cast.status_code == 201

    # Login and check results
    login = client.post("/api/v1/admin/temp-login", json={
        "temp_admin_id": admin_id,
        "password": "Password123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    results = client.get(f"/api/v1/admin/elections/{elec_id}/results", headers=headers).json()
    assert results["statistics"]["votes_cast"] == 1
    assert results["statistics"]["total_vote_records"] == 2
    assert len(results["voter_records"]) == 1
    assert "Option Alpha" in results["voter_records"][0]["vote_given_to"]
    assert "Option Beta" in results["voter_records"][0]["vote_given_to"]
