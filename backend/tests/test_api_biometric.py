from datetime import datetime, timedelta, timezone
import uuid
from app.core.security import password_hash
from app.models import Election, ElectionState, FingerprintTemplate, Role, User, Voter


def test_start_biometric_session(client, db_session):
    now = datetime.now(timezone.utc)
    election = Election(
        name=f"Election {uuid.uuid4()}",
        description="Public Vote",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=5),
        state=ElectionState.OPEN,
    )
    db_session.add(election)
    db_session.flush()

    user = User(
        email=f"voter_{uuid.uuid4()}@example.com",
        password_hash=password_hash("randompass123"),
        role=Role.VOTER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    voter_id = f"VOTER-{uuid.uuid4().hex[:8]}"
    voter = Voter(
        user_id=user.id,
        voter_id=voter_id,
        full_name="Jane Doe",
        date_of_birth="1990-01-01",
        gender="Female",
        mobile=f"+1555{uuid.uuid4().int % 10000000:07d}",
        address_ciphertext="encrypted_address",
        aadhaar_last_four="1234",
        aadhaar_digest=uuid.uuid4().hex,
    )
    db_session.add(voter)
    db_session.commit()

    # Valid start
    res = client.post(
        "/api/v1/biometric/start",
        json={"voter_id": voter_id, "election_id": str(election.id)},
    )
    assert res.status_code == 200
    assert res.json()["stage"] == "identified"
    assert "session_id" in res.json()

    # Invalid Voter ID (API-01)
    res_invalid = client.post(
        "/api/v1/biometric/start",
        json={"voter_id": "NON-EXISTENT-ID", "election_id": str(election.id)},
    )
    assert res_invalid.status_code == 401


def test_fingerprint_verification_hardware_token(client, db_session):
    now = datetime.now(timezone.utc)
    election = Election(
        name=f"Election {uuid.uuid4()}",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=5),
        state=ElectionState.OPEN,
    )
    db_session.add(election)
    db_session.flush()

    user = User(
        email=f"voter_{uuid.uuid4()}@example.com",
        password_hash=password_hash("randompass123"),
        role=Role.VOTER,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    voter = Voter(
        user_id=user.id,
        voter_id=f"VOTER-{uuid.uuid4().hex[:8]}",
        full_name="John Doe",
        date_of_birth="1985-05-05",
        gender="Male",
        mobile=f"+1555{uuid.uuid4().int % 10000000:07d}",
        address_ciphertext="encrypted",
        aadhaar_last_four="5678",
        aadhaar_digest=uuid.uuid4().hex,
    )
    db_session.add(voter)
    db_session.flush()

    fp_template = FingerprintTemplate(
        voter_id=voter.id,
        sensor_template_id=42,
        template_ciphertext="encrypted_template",
        sensor_serial="R307-SERIAL-123",
    )
    db_session.add(fp_template)
    db_session.commit()

    start_res = client.post(
        "/api/v1/biometric/start",
        json={"voter_id": voter.voter_id, "election_id": str(election.id)},
    )
    session_id = start_res.json()["session_id"]

    # Wrong bridge token (API-02)
    wrong_token_res = client.post(
        "/api/v1/biometric/fingerprint",
        json={
            "session_id": session_id,
            "sensor_template_id": 42,
            "sensor_score": 95.0,
            "sensor_serial": "R307-SERIAL-123",
        },
        headers={"X-Hardware-Token": "invalid-token"},
    )
    assert wrong_token_res.status_code == 403

    # Valid bridge token
    valid_res = client.post(
        "/api/v1/biometric/fingerprint",
        json={
            "session_id": session_id,
            "sensor_template_id": 42,
            "sensor_score": 95.0,
            "sensor_serial": "R307-SERIAL-123",
        },
        headers={"X-Hardware-Token": "test-bridge-token"},
    )
    assert valid_res.status_code == 200
    assert valid_res.json()["stage"] == "fingerprint"
