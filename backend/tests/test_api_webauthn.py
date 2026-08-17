import pytest
from fastapi.testclient import TestClient
from app.models import Voter


def test_webauthn_register_options_not_found(client: TestClient):
    response = client.post("/api/v1/webauthn/register/options", json={"voter_id": "nonexistent-id"})
    assert response.status_code == 404


def test_webauthn_authenticate_options_no_credential(client: TestClient, db_session):
    voter = db_session.query(Voter).first()
    if voter:
        response = client.post("/api/v1/webauthn/authenticate/options", json={"voter_id": str(voter.id), "session_id": "00000000-0000-0000-0000-000000000000"})
        assert response.status_code == 404
        assert "No registered security credential" in response.json()["detail"]
