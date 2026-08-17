from app.core.security import password_hash
from app.models import Role, User


def test_login_success(client, db_session):
    user = User(
        email="admin@example.com",
        password_hash=password_hash("password123456"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "password123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in response.cookies


def test_login_invalid_password(client, db_session):
    user = User(
        email="admin@example.com",
        password_hash=password_hash("password123456"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "wrongpassword123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_refresh_token(client, db_session):
    user = User(
        email="admin@example.com",
        password_hash=password_hash("password123456"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "password123456"},
    )
    refresh_token = login_res.cookies.get("refresh_token")

    client.cookies.set("refresh_token", refresh_token)
    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()


def test_logout(client, db_session):
    user = User(
        email="admin@example.com",
        password_hash=password_hash("password123456"),
        role=Role.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "password123456"},
    )
    access_token = login_res.json()["access_token"]
    refresh_token = login_res.cookies.get("refresh_token")

    headers = {"Authorization": f"Bearer {access_token}"}
    client.cookies.set("refresh_token", refresh_token)
    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 204
