from datetime import datetime, timedelta, timezone
from app.core.security import create_token, password_hash
from app.models import Election, ElectionState, Role, User, Candidate, Voter, VoterElectionStatus, Vote


def create_token_headers(user_id, role):
    token = create_token(user_id, role.value, "access", timedelta(minutes=15))
    return {"Authorization": f"Bearer {token}"}


def test_complete_audit_and_role_isolation(client, db_session):
    now = datetime.now(timezone.utc)

    # 1. Create Big Admin
    big_admin = User(
        email="big_admin_monitor@civitas.gov",
        password_hash=password_hash("BigAdminPass123!"),
        role=Role.BIG_ADMIN,
        is_active=True,
    )

    # 2. Create Local Admin A and Local Admin B
    local_admin_a = User(
        email="local_admin_a@civitas.gov",
        password_hash=password_hash("LocalAdminAPass123!"),
        role=Role.TEMP_ADMIN,
        is_active=True,
    )
    local_admin_b = User(
        email="local_admin_b@civitas.gov",
        password_hash=password_hash("LocalAdminBPass123!"),
        role=Role.TEMP_ADMIN,
        is_active=True,
    )
    db_session.add_all([big_admin, local_admin_a, local_admin_b])
    db_session.commit()

    big_headers = create_token_headers(big_admin.id, Role.BIG_ADMIN)
    headers_a = create_token_headers(local_admin_a.id, Role.TEMP_ADMIN)
    headers_b = create_token_headers(local_admin_b.id, Role.TEMP_ADMIN)

    # 3. Local Admin A creates Election A
    res_create_a = client.post(
        "/api/v1/admin/elections",
        json={
            "name": "Local Election Alpha",
            "election_id": "ALPHA-2026",
            "description": "University Student Government Election",
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(hours=24)).isoformat(),
        },
        headers=headers_a,
    )
    assert res_create_a.status_code == 201
    elec_a_id = res_create_a.json()["id"]

    # 4. Local Admin B creates Election B
    res_create_b = client.post(
        "/api/v1/admin/elections",
        json={
            "name": "Local Election Beta",
            "election_id": "BETA-2026",
            "description": "Faculty Council Election",
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(hours=24)).isoformat(),
        },
        headers=headers_b,
    )
    assert res_create_b.status_code == 201
    elec_b_id = res_create_b.json()["id"]

    # 5. TEST: Big Admin Read-Only System Monitoring
    # Big Admin can view list, results, and audit logs
    elec_list_res = client.get("/api/v1/admin/elections", headers=big_headers)
    assert elec_list_res.status_code == 200
    assert len(elec_list_res.json()) >= 2

    res_a_view = client.get(f"/api/v1/admin/elections/{elec_a_id}/results", headers=big_headers)
    assert res_a_view.status_code == 200

    # Big Admin CANNOT mutate state -> 403 Forbidden
    big_state_deny = client.post(f"/api/v1/admin/elections/{elec_a_id}/state?target=open", headers=big_headers)
    assert big_state_deny.status_code == 403

    # Big Admin CANNOT add voters -> 403 Forbidden
    big_voter_deny = client.post(
        f"/api/v1/admin/elections/{elec_a_id}/voters",
        json={"full_name": "Illegal Voter", "voter_id": "VOTER-ILLEGAL"},
        headers=big_headers,
    )
    assert big_voter_deny.status_code == 403

    # Big Admin CANNOT delete election -> 403 Forbidden
    big_delete_deny = client.delete(f"/api/v1/admin/elections/{elec_a_id}", headers=big_headers)
    assert big_delete_deny.status_code == 403

    # 6. TEST: Local Admin Isolation
    # Local Admin A CANNOT access or mutate Election B -> 403 Forbidden
    res_a_on_b_state = client.post(f"/api/v1/admin/elections/{elec_b_id}/state?target=open", headers=headers_a)
    assert res_a_on_b_state.status_code == 403

    res_a_on_b_results = client.get(f"/api/v1/admin/elections/{elec_b_id}/results", headers=headers_a)
    assert res_a_on_b_results.status_code == 403

    # 7. TEST: Local Admin A Managing Election A
    # State transition to open -> 200 OK
    res_open = client.post(f"/api/v1/admin/elections/{elec_a_id}/state?target=open", headers=headers_a)
    assert res_open.status_code == 200
    assert res_open.json()["state"] == "open"

    # Add Candidate
    cand_res = client.post(
        f"/api/v1/admin/elections/{elec_a_id}/candidates",
        json={"name": "Alice Smith", "party": "Liberty Party", "manifesto": "Open governance"},
        headers=headers_a,
    )
    assert cand_res.status_code == 201
    cand_id = cand_res.json()["id"]

    # Register Voter
    voter_res = client.post(
        f"/api/v1/admin/elections/{elec_a_id}/voters",
        json={
            "full_name": "John Doe",
            "voter_id": "VOTER-ALPHA-01",
            "email": "john.doe@alpha.edu",
            "mobile": "+15550001111",
            "is_eligible": True,
        },
        headers=headers_a,
    )
    assert voter_res.status_code == 201
    voter_id = voter_res.json()["id"]

    # 8. TEST: Remote Voting & Election URL Formatting
    enable_qr_res = client.post(f"/api/v1/admin/elections/{elec_a_id}/remote-voting/enable", headers=headers_a)
    assert enable_qr_res.status_code == 200

    update_url_res = client.post(
        f"/api/v1/admin/elections/{elec_a_id}/remote-voting/url",
        json={"public_url": "https://civitas-live.trycloudflare.com"},
        headers=headers_a,
    )
    assert update_url_res.status_code == 200
    voting_url = update_url_res.json()["voting_url"]
    assert voting_url == "https://civitas-live.trycloudflare.com/vote/ALPHA-2026"

    # 9. TEST: Voting Flow & Ballots
    # Voter verifies against Election A (Voter Name + Voter ID)
    verify_res = client.post(
        "/api/v1/voting/verify-voter",
        json={
            "election_id": "ALPHA-2026",
            "voter_id": "VOTER-ALPHA-01",
            "voter_name": "John Doe",
        },
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["eligible"] is True
    assert verify_res.json()["voter_id"] == "VOTER-ALPHA-01"

    # Simulate cast vote record
    vote = Vote(
        election_id=elec_a_id,
        candidate_id=cand_id,
        receipt_id=f"REC-{now.timestamp()}",
        cast_at=now,
    )
    status_row = db_session.query(VoterElectionStatus).filter_by(election_id=elec_a_id, voter_id=voter_id).first()
    status_row.voted_at = now
    db_session.add(vote)
    db_session.commit()

    # 10. TEST: Safety Checks after Vote is Cast
    # Candidate cannot be deleted after receiving votes
    del_cand_res = client.delete(f"/api/v1/admin/candidates/{cand_id}", headers=headers_a)
    assert del_cand_res.status_code == 400
    assert "already been cast" in del_cand_res.json()["detail"]

    # Voter cannot be deleted after casting a ballot
    del_voter_res = client.delete(f"/api/v1/admin/voters/{voter_id}", headers=headers_a)
    assert del_voter_res.status_code == 400
    assert "already cast a ballot" in del_voter_res.json()["detail"]

    # Election cannot be deleted after votes recorded
    del_elec_res = client.delete(f"/api/v1/admin/elections/{elec_a_id}", headers=headers_a)
    assert del_elec_res.status_code == 400
    assert "votes have already been recorded" in del_elec_res.json()["detail"]

    # 11. TEST: Results & Tallies
    summary_res = client.get(f"/api/v1/admin/elections/{elec_a_id}/summary-results", headers=headers_a)
    assert summary_res.status_code == 200
    assert summary_res.json()["total_votes_cast"] == 1
    assert summary_res.json()["turnout_percent"] == 100.0

    detail_res = client.get(f"/api/v1/admin/elections/{elec_a_id}/results", headers=headers_a)
    assert detail_res.status_code == 200
    assert len(detail_res.json()["candidates"]) == 1
    assert detail_res.json()["candidates"][0]["votes"] == 1
    assert len(detail_res.json()["voter_participation_log"]) == 1
