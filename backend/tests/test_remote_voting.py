from datetime import datetime, timedelta, timezone
from app.core.security import create_token, password_hash
from app.models import Election, ElectionState, Role, User


def create_admin_headers(user_id):
    token = create_token(user_id, Role.TEMP_ADMIN.value, "access", timedelta(minutes=15))
    return {"Authorization": f"Bearer {token}"}


def test_remote_voting_lifecycle(client, db_session):
    admin = User(
        email="remote_admin@gov.in",
        password_hash=password_hash("securepass12345"),
        role=Role.TEMP_ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    headers = create_admin_headers(admin.id)
    now = datetime.now(timezone.utc)
    starts_at = (now - timedelta(hours=1)).isoformat()
    ends_at = (now + timedelta(hours=24)).isoformat()

    # 1. Create an open election
    create_res = client.post(
        "/api/v1/admin/elections",
        json={
            "name": "Remote Voting Test Election",
            "description": "Testing secure remote voting link generation",
            "starts_at": starts_at,
            "ends_at": ends_at,
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    election_id = create_res.json()["id"]

    # Open election state
    state_res = client.post(
        f"/api/v1/admin/elections/{election_id}/state?target=open",
        headers=headers,
    )
    assert state_res.status_code == 200

    # 2. Get initial remote voting status (should be disabled)
    status_res = client.get(
        f"/api/v1/admin/elections/{election_id}/remote-voting",
        headers=headers,
    )
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["remote_voting_enabled"] is False

    # 3. Enable remote voting
    enable_res = client.post(
        f"/api/v1/admin/elections/{election_id}/remote-voting/enable",
        headers=headers,
    )
    assert enable_res.status_code == 200
    enable_data = enable_res.json()
    assert enable_data["remote_voting_enabled"] is True
    token = enable_data["secure_voting_token"]
    assert token is not None
    assert enable_data["voting_url"] is not None

    # 4. Validate public access endpoint with token
    access_res = client.get(f"/api/v1/voting/access/{token}")
    assert access_res.status_code == 200
    assert access_res.json()["name"] == "Remote Voting Test Election"

    # 4b. Test Updating Remote Voting URL (Cloudflare Tunnel URL)
    invalid_url_res = client.post(
        f"/api/v1/admin/elections/{election_id}/remote-voting/url",
        json={"public_url": "invalid-url-string"},
        headers=headers,
    )
    assert invalid_url_res.status_code == 400

    custom_url = "https://custom-tunnel.trycloudflare.com"
    update_url_res = client.post(
        f"/api/v1/admin/elections/{election_id}/remote-voting/url",
        json={"public_url": custom_url},
        headers=headers,
    )
    assert update_url_res.status_code == 200
    updated_data = update_url_res.json()
    target_id = create_res.json().get("election_id") or election_id
    assert "https://custom-tunnel.trycloudflare.com" in updated_data["voting_url"]
    assert target_id in updated_data["voting_url"]

    # Verify GET status returns the persisted URL
    get_status_res = client.get(
        f"/api/v1/admin/elections/{election_id}/remote-voting",
        headers=headers,
    )
    assert get_status_res.status_code == 200
    assert get_status_res.json()["voting_url"] == updated_data["voting_url"]

    # 5. Regenerate token
    regen_res = client.post(
        f"/api/v1/admin/elections/{election_id}/remote-voting/regenerate",
        headers=headers,
    )
    assert regen_res.status_code == 200
    new_token = regen_res.json()["secure_voting_token"]
    assert new_token != token

    # Old token should fail now
    old_access_res = client.get(f"/api/v1/voting/access/{token}")
    assert old_access_res.status_code == 404

    # New token should work
    new_access_res = client.get(f"/api/v1/voting/access/{new_token}")
    assert new_access_res.status_code == 200

    # 6. Revoke token
    revoke_res = client.post(
        f"/api/v1/admin/elections/{election_id}/remote-voting/revoke",
        headers=headers,
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["remote_voting_enabled"] is False

    # Revoked access attempt should be rejected with 410
    revoked_access_res = client.get(f"/api/v1/voting/access/{new_token}")
    assert revoked_access_res.status_code == 410
