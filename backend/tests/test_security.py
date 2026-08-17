from datetime import timedelta
from uuid import uuid4
import pytest
from app.core.security import create_token, decode_token, decrypt_biometric, encrypt_biometric, password_hash, password_verify


def test_password_hash_is_not_reversible():
    hashed = password_hash("a-strong-password-that-is-long")
    assert hashed != "a-strong-password-that-is-long"
    assert password_verify("a-strong-password-that-is-long", hashed)
    assert not password_verify("wrong-password", hashed)


def test_biometric_ciphertext_round_trip():
    encrypted = encrypt_biometric(b"never store this template in plaintext")
    assert "never store" not in encrypted
    assert decrypt_biometric(encrypted) == b"never store this template in plaintext"


def test_voting_token_cannot_be_decoded_as_access_token():
    token = create_token(uuid4(), "voter", "voting", timedelta(minutes=1), uuid4())
    assert decode_token(token, "voting")["kind"] == "voting"
    with pytest.raises(Exception): decode_token(token, "access")
