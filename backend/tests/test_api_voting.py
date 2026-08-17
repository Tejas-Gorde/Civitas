from datetime import datetime, timedelta, timezone
import uuid
from app.core.security import create_token, password_hash
from app.models import (
    AuthSession,
    AuthStage,
    Candidate,
    Election,
    ElectionState,
    Role,
    User,
    Voter,
)


def setup_election_and_voter(db_session):
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

    candidate = Candidate(
        election_id=election.id,
        name="Leader One",
        party="Independent",
        manifesto="Public Service",
    )
    db_session.add(candidate)

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
    db_session.refresh(election)
    db_session.refresh(candidate)
    db_session.refresh(voter)
    return election, candidate, voter


def test_list_elections_and_candidates(client, db_session):
    election, candidate, voter = setup_election_and_voter(db_session)

    res_elections = client.get("/api/v1/voting/elections")
    assert res_elections.status_code == 200
    assert any(e["id"] == str(election.id) for e in res_elections.json())

    res_candidates = client.get(f"/api/v1/voting/elections/{election.id}/candidates")
    assert res_candidates.status_code == 200
    assert len(res_candidates.json()) == 1
    assert res_candidates.json()[0]["id"] == str(candidate.id)


def test_cast_vote_success_and_double_vote_prevention(client, db_session):
    election, candidate, voter = setup_election_and_voter(db_session)

    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.GRANTED,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db_session.add(session)
    db_session.flush()

    grant_token = create_token(
        subject=voter.id,
        role="voter",
        kind="voting",
        lifetime=timedelta(minutes=3),
        session_id=session.id,
    )
    import hashlib
    session.issued_grant_hash = hashlib.sha256(grant_token.encode()).hexdigest()
    db_session.commit()

    # First vote cast
    cast_payload = {
        "election_id": str(election.id),
        "candidate_id": str(candidate.id),
        "voting_grant": grant_token,
    }
    cast_res = client.post("/api/v1/voting/cast", json=cast_payload)
    assert cast_res.status_code == 201
    assert "receipt_id" in cast_res.json()

    # Second vote attempt with consumed grant (SEC-01 & SEC-02)
    second_cast_res = client.post("/api/v1/voting/cast", json=cast_payload)
    assert second_cast_res.status_code in (401, 409)


def test_upload_session_photo_success(client, db_session):
    election, candidate, voter = setup_election_and_voter(db_session)

    session = AuthSession(
        voter_id=voter.id,
        election_id=election.id,
        stage=AuthStage.FINGERPRINT,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db_session.add(session)
    db_session.commit()

    # Upload photo as multipart form data
    photo_data = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00"
    files = {"file": ("test_photo.jpg", photo_data, "image/jpeg")}

    res = client.post(f"/api/v1/voting/sessions/{session.id}/photo", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["stage"] == "face"

    db_session.refresh(session)
    assert session.stage == AuthStage.FACE
    assert session.metrics.get("photo_captured") is True

