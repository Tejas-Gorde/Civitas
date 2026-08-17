from datetime import datetime, timedelta, timezone
from app.core.security import create_token, password_hash
from app.models import Election, ElectionState, Role, User


def create_temp_admin_headers(user_id):
    token = create_token(user_id, Role.TEMP_ADMIN.value, "access", timedelta(minutes=15))
    return {"Authorization": f"Bearer {token}"}


def create_admin_headers(user_id):
    token = create_token(user_id, Role.BIG_ADMIN.value, "access", timedelta(minutes=15))
    return {"Authorization": f"Bearer {token}"}


def test_create_and_manage_election(client, db_session):
    local_admin = User(
        email="local_admin@gov.in",
        password_hash=password_hash("securepass12345"),
        role=Role.TEMP_ADMIN,
        is_active=True,
    )
    big_admin = User(
        email="big_admin@gov.in",
        password_hash=password_hash("securepass12345"),
        role=Role.BIG_ADMIN,
        is_active=True,
    )
    db_session.add_all([local_admin, big_admin])
    db_session.commit()

    headers = create_temp_admin_headers(local_admin.id)
    big_headers = create_admin_headers(big_admin.id)
    now = datetime.now(timezone.utc)
    starts_at = (now + timedelta(hours=1)).isoformat()
    ends_at = (now + timedelta(hours=24)).isoformat()

    # Local Admin creates election
    create_res = client.post(
        "/api/v1/admin/elections",
        json={
            "name": "General Election 2026",
            "description": "National Digital Vote",
            "starts_at": starts_at,
            "ends_at": ends_at,
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    election_id = create_res.json()["id"]
    assert create_res.json()["state"] == "draft"

    # Big Admin attempting to mutate state -> 403 Forbidden
    big_state_res = client.post(
        f"/api/v1/admin/elections/{election_id}/state?target=scheduled",
        headers=big_headers,
    )
    assert big_state_res.status_code == 403

    # Local Admin transition state draft -> scheduled -> 200 OK
    state_res = client.post(
        f"/api/v1/admin/elections/{election_id}/state?target=scheduled",
        headers=headers,
    )
    assert state_res.status_code == 200
    assert state_res.json()["state"] == "scheduled"

    # Local Admin adds candidate -> 201 Created
    cand_res = client.post(
        f"/api/v1/admin/elections/{election_id}/candidates",
        json={
            "name": "Candidate Alpha",
            "party": "Progressive Alliance",
            "manifesto": "Technology and Transparency",
        },
        headers=headers,
    )
    assert cand_res.status_code == 201
    assert cand_res.json()["election_id"] == election_id


def test_admin_analytics_and_report(client, db_session):
    admin = User(
        email="admin@gov.in",
        password_hash=password_hash("securepass12345"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    headers = create_admin_headers(admin.id)

    analytics_res = client.get("/api/v1/admin/analytics", headers=headers)
    assert analytics_res.status_code == 200
    assert "authentication_attempts" in analytics_res.json()

    # Verify voter list endpoint
    voters_res = client.get("/api/v1/admin/voters", headers=headers)
    assert voters_res.status_code == 200


    report_res = client.get("/api/v1/admin/reports/authentication.csv", headers=headers)
    assert report_res.status_code == 200
    assert "text/csv" in report_res.headers["content-type"]


def test_voice_guidance_settings_api(client, db_session):
    admin = User(
        email="admin_voice@gov.in",
        password_hash=password_hash("securepass12345"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()

    headers = create_admin_headers(admin.id)

    # 1. Public endpoint default check
    public_res = client.get("/api/v1/voting/settings/voice-guidance")
    assert public_res.status_code == 200
    assert "enabled" in public_res.json()

    # 2. Admin GET
    get_res = client.get("/api/v1/admin/settings/voice-guidance", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["language"] == "en-US"

    # 3. Admin PUT to update setting OFF
    put_res = client.put("/api/v1/admin/settings/voice-guidance", json={"enabled": False}, headers=headers)
    assert put_res.status_code == 200
    assert put_res.json()["enabled"] is False

    # 4. Verify public endpoint reflects change
    public_res2 = client.get("/api/v1/voting/settings/voice-guidance")
    assert public_res2.status_code == 200
    assert public_res2.json()["enabled"] is False
