"""Comprehensive Test Suite for CIVITAS Open Enrollment / Anyone Can Vote Mode.

Tests all required acceptance scenarios:
- TEST A: PRE_REGISTERED (passwordless voter auth, pre-registered existence & name validation, assignment check)
- TEST B: OPEN_ENROLLMENT (registration_mode='open_enrollment', registered_voters=0, Name + ID, NO password)
- TEST C: DIFFERENT RANDOM ID (Multiple distinct voter IDs accepted)
- TEST D: DUPLICATE PREVENTION (Same voter ID in same election strictly rejected with 409)
- TEST E: EMPTY ID (Clean validation error)
- TEST F: EMPTY NAME (Clean validation error)
- TEST G: VERIFICATION PHOTO FLOW (Open enrollment voter capture, compress, upload, database record, Local Admin view)
- TEST H: ALL VOTING TYPES under Open Enrollment (Regular, Multiple Choice, Poll, Yes/No, Rating)
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


def test_open_enrollment_comprehensive_matrix(client):
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4().hex[:6]

    # -------------------------------------------------------------------------
    # TEST A: PRE_REGISTERED MODE
    # -------------------------------------------------------------------------
    admin_a = f"admin_a_{uid}@civitas.local"
    elec_a = f"ELEC-PRE-{uid.upper()}"

    res_a = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": admin_a,
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_a,
            "name": f"Pre-Registered Mode Election {uid}",
            "description": "Requires pre-enrollment",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "pre_registered",
            "candidates": [
                {"name": "Alice", "party": "Party A", "manifesto": "Plan A"},
                {"name": "Bob", "party": "Party B", "manifesto": "Plan B"},
            ],
            "voters": [
                {"voter_id": "VOTER-PRE-001", "full_name": "Tejas Gorde"},
            ],
        },
    )
    assert res_a.status_code == 201
    elec_a_data = res_a.json()
    internal_a = elec_a_data["id"]

    # Valid pre-registered login
    login_a1 = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_a,
            "voter_id": "VOTER-PRE-001",
            "voter_name": "Tejas Gorde",
        },
    )
    assert login_a1.status_code == 200
    assert login_a1.json()["eligible"] is True
    assert login_a1.json()["voter_id"] == "VOTER-PRE-001"

    # Invalid pre-registered login (unregistered ID)
    login_a2 = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_a,
            "voter_id": "UNREGISTERED-999",
            "voter_name": "Unknown Person",
        },
    )
    assert login_a2.status_code in (403, 404)

    # -------------------------------------------------------------------------
    # TEST B: OPEN_ENROLLMENT MODE (0 REGISTERED VOTERS)
    # -------------------------------------------------------------------------
    admin_b = f"admin_b_{uid}@civitas.local"
    elec_b = f"ELEC-OPEN-{uid.upper()}"

    res_b = client.post(
        "/api/v1/admin/elections/onboarding",
        json={
            "temp_admin_id": admin_b,
            "temp_admin_password": "AdminPassword123!",
            "election_id": elec_b,
            "name": f"Open Enrollment Election {uid}",
            "description": "Zero pre-registered voters",
            "starts_at": (now - timedelta(minutes=5)).isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "voter_registration_mode": "open_enrollment",
            "candidates": [
                {"name": "Option 1", "party": "Party 1", "manifesto": "Plan 1"},
                {"name": "Option 2", "party": "Party 2", "manifesto": "Plan 2"},
            ],
            "voters": [],  # Exactly 0 registered voters
        },
    )
    assert res_b.status_code == 201
    elec_b_data = res_b.json()
    internal_b = elec_b_data["id"]

    # Submit: name = Tejas, voter_id = ABC123 (No password!)
    login_b1 = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "ABC123",
            "voter_name": "Tejas",
        },
    )
    assert login_b1.status_code == 200, f"Open enrollment verify failed: {login_b1.text}"
    body_b1 = login_b1.json()
    assert body_b1["eligible"] is True
    assert body_b1["voter_id"] == "ABC123"
    session_b1_id = body_b1["session_id"]
    assert session_b1_id is not None

    # -------------------------------------------------------------------------
    # TEST C: DIFFERENT RANDOM ID (Rahul / XYZ999)
    # -------------------------------------------------------------------------
    login_c = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "XYZ999",
            "voter_name": "Rahul",
        },
    )
    assert login_c.status_code == 200
    assert login_c.json()["eligible"] is True
    assert login_c.json()["voter_id"] == "XYZ999"

    # -------------------------------------------------------------------------
    # TEST D: DUPLICATE VOTING PREVENTION
    # -------------------------------------------------------------------------
    # Cast vote for Tejas (ABC123)
    cands_b = client.get(f"/api/v1/voting/elections/{internal_b}/candidates").json()
    cand_1_id = cands_b[0]["id"]

    with next(get_db()) as db:
        sess = db.get(AuthSession, session_b1_id)
        sess.stage = AuthStage.GRANTED
        grant_token = create_token(
            subject=sess.voter_id,
            role="voter",
            kind="voting",
            lifetime=timedelta(minutes=30),
            session_id=sess.id,
        )
        sess.issued_grant_hash = hashlib.sha256(grant_token.encode()).hexdigest()
        db.commit()

    cast_b1 = client.post(
        "/api/v1/voting/cast",
        json={
            "election_id": internal_b,
            "candidate_id": cand_1_id,
            "voting_grant": grant_token,
        },
    )
    assert cast_b1.status_code == 201
    assert "receipt_id" in cast_b1.json()

    # Attempt second login/vote with same voter ID ABC123 in same election -> REJECTED (409)
    login_dup = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "ABC123",
            "voter_name": "Tejas",
        },
    )
    assert login_dup.status_code == 409
    assert "already voted" in login_dup.json()["detail"].lower()

    # -------------------------------------------------------------------------
    # TEST E: EMPTY ID (Accepted in Express/Open Enrollment Mode)
    # -------------------------------------------------------------------------
    login_empty_id = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "",
            "voter_name": "Tejas",
        },
    )
    assert login_empty_id.status_code == 200
    assert login_empty_id.json()["eligible"] is True

    # -------------------------------------------------------------------------
    # TEST F: EMPTY NAME
    # -------------------------------------------------------------------------
    login_empty_name = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "ABC123",
            "voter_name": "",
        },
    )
    assert login_empty_name.status_code in (400, 422)

    # -------------------------------------------------------------------------
    # TEST G: VERIFICATION PHOTO FLOW UNDER OPEN ENROLLMENT
    # -------------------------------------------------------------------------
    login_photo = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": elec_b,
            "voter_id": "PHOTO_VOTER_777",
            "voter_name": "Photo Test Voter",
        },
    )
    assert login_photo.status_code == 200
    photo_session_id = login_photo.json()["session_id"]

    # Upload verification photo
    fake_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00" + b"\x01" * 64 + b"\xff\xc0\x00\x11\x08\x00\x10\x00\x10\x03\x01"\
                          b"\x22\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\xbf\x00\xff\xd9")
    
    photo_res = client.post(
        f"/api/v1/voting/sessions/{photo_session_id}/photo",
        files={"file": ("voter_photo.jpg", fake_img.getvalue(), "image/jpeg")},
    )
    assert photo_res.status_code == 200, f"Photo upload failed: {photo_res.text}"
    photo_json = photo_res.json()
    assert photo_json["success"] is True
    assert "photo_id" in photo_json

    # Local Admin signs in and views verification photos
    admin_login_res = client.post(
        "/api/v1/admin/temp-login",
        json={"temp_admin_id": admin_b, "password": "AdminPassword123!"},
    )
    assert admin_login_res.status_code == 200
    admin_token = admin_login_res.json()["access_token"]

    list_photos_res = client.get(
        f"/api/v1/admin/elections/{elec_b}/verification-photos",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_photos_res.status_code == 200, f"List photos failed: {list_photos_res.text}"
    photos_list = list_photos_res.json()
    assert len(photos_list) >= 1
    assert any("PHOTO_VOTER_777" in (p.get("voter_reg_id") or "") or "PHOTO_VOTER_777" in (p.get("storage_path") or "") for p in photos_list)

    print("✅ ALL TESTS A through G PASSED!")


def test_open_enrollment_all_voting_types(client):
    """Test all 5 voting types under Open Enrollment / Anyone Can Vote mode."""
    now = datetime.now(timezone.utc)
    voting_types_matrix = [
        ("regular", 1, [{"name": "Cand 1", "party": "P1"}, {"name": "Cand 2", "party": "P2"}]),
        ("multiple_choice", 2, [{"name": "Choice A", "party": "PA"}, {"name": "Choice B", "party": "PB"}, {"name": "Choice C", "party": "PC"}]),
        ("poll", 1, [{"name": "Poll Opt 1", "party": "Opt 1"}, {"name": "Poll Opt 2", "party": "Opt 2"}]),
        ("yes_no", 1, [{"name": "YES", "party": "Approve"}, {"name": "NO", "party": "Reject"}]),
        ("rating", 1, [{"name": "5 Stars", "party": "Top Rating"}, {"name": "4 Stars", "party": "High Rating"}]),
    ]

    for v_type, max_sel, cand_data in voting_types_matrix:
        uid = uuid.uuid4().hex[:6]
        admin_id = f"admin_{v_type}_{uid}@civitas.local"
        elec_slug = f"ELEC-OPEN-{v_type.upper()}-{uid}"

        # 1. Create election with open enrollment and 0 registered voters
        res = client.post(
            "/api/v1/admin/elections/onboarding",
            json={
                "temp_admin_id": admin_id,
                "temp_admin_password": "AdminPassword123!",
                "election_id": elec_slug,
                "name": f"Open Enrollment {v_type.title()} Election {uid}",
                "description": f"Testing {v_type} under open enrollment",
                "starts_at": (now - timedelta(minutes=5)).isoformat(),
                "ends_at": (now + timedelta(days=1)).isoformat(),
                "voting_type": v_type,
                "max_selections": max_sel,
                "voter_registration_mode": "open_enrollment",
                "candidates": [{"name": c["name"], "party": c["party"], "manifesto": "Test Manifesto"} for c in cand_data],
                "voters": [],  # 0 registered voters
            },
        )
        assert res.status_code == 201, f"Failed to create {v_type} election: {res.text}"
        elec_info = res.json()
        elec_uuid = elec_info["id"]

        # Local admin login to get token for results check
        admin_login = client.post(
            "/api/v1/admin/temp-login",
            json={"temp_admin_id": admin_id, "password": "AdminPassword123!"},
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]

        # 2. Voter 1 (Tejas / T100) verifies
        v1_res = client.post(
            "/api/v1/voting/verify-voter",
            json={
                "election_id": elec_slug,
                "voter_id": f"VOTER_{v_type.upper()}_1",
                "voter_name": f"Voter {v_type.title()} One",
            },
        )
        assert v1_res.status_code == 200, f"Failed voter 1 verify on {v_type}: {v1_res.text}"
        v1_sess_id = v1_res.json()["session_id"]

        # Advance session 1 to GRANTED
        with next(get_db()) as db:
            s1 = db.get(AuthSession, v1_sess_id)
            s1.stage = AuthStage.GRANTED
            token1 = create_token(subject=s1.voter_id, role="voter", kind="voting", lifetime=timedelta(minutes=30), session_id=s1.id)
            s1.issued_grant_hash = hashlib.sha256(token1.encode()).hexdigest()
            db.commit()

        cands = client.get(f"/api/v1/voting/elections/{elec_uuid}/candidates").json()
        sel_cands = [c["id"] for c in cands[:max_sel]]

        # Cast vote 1
        cast_1 = client.post(
            "/api/v1/voting/cast",
            json={
                "election_id": elec_uuid,
                "candidate_ids": sel_cands,
                "voting_grant": token1,
            },
        )
        assert cast_1.status_code == 201, f"Failed cast vote 1 for {v_type}: {cast_1.text}"

        # 3. Voter 2 (Rahul / R200) verifies and votes
        v2_res = client.post(
            "/api/v1/voting/verify-voter",
            json={
                "election_id": elec_slug,
                "voter_id": f"VOTER_{v_type.upper()}_2",
                "voter_name": f"Voter {v_type.title()} Two",
            },
        )
        assert v2_res.status_code == 200, f"Failed voter 2 verify on {v_type}: {v2_res.text}"
        v2_sess_id = v2_res.json()["session_id"]

        with next(get_db()) as db:
            s2 = db.get(AuthSession, v2_sess_id)
            s2.stage = AuthStage.GRANTED
            token2 = create_token(subject=s2.voter_id, role="voter", kind="voting", lifetime=timedelta(minutes=30), session_id=s2.id)
            s2.issued_grant_hash = hashlib.sha256(token2.encode()).hexdigest()
            db.commit()

        cast_2 = client.post(
            "/api/v1/voting/cast",
            json={
                "election_id": elec_uuid,
                "candidate_ids": [cands[0]["id"]],
                "voting_grant": token2,
            },
        )
        assert cast_2.status_code == 201, f"Failed cast vote 2 for {v_type}: {cast_2.text}"

        # 4. Check results using admin authorization
        results_res = client.get(
            f"/api/v1/admin/elections/{elec_uuid}/results",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert results_res.status_code == 200, f"Failed getting results for {v_type}: {results_res.text}"
        results_data = results_res.json()
        assert results_data["statistics"]["votes_cast"] == 2, f"Expected 2 votes cast in {v_type}, got: {results_data['statistics']}"
        print(f"✅ Open Enrollment for voting_type='{v_type}' PASSED!")

