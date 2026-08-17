import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, status
from app.core.config import get_settings

settings = get_settings()
password_hasher = PasswordHasher()


def password_hash(password: str) -> str:
    return password_hasher.hash(password)


def password_verify(password: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False


def _encryption_key() -> bytes:
    if not settings.biometric_encryption_key:
        if settings.environment != "development":
            raise RuntimeError("BIOMETRIC_ENCRYPTION_KEY is required outside development")
        return hashlib.sha256(b"development-only-biometric-key").digest()
    return base64.urlsafe_b64decode(settings.biometric_encryption_key + "==")[:32]


def encrypt_biometric(value: bytes) -> str:
    nonce = os.urandom(12)
    return base64.urlsafe_b64encode(nonce + AESGCM(_encryption_key()).encrypt(nonce, value, None)).decode()


def decrypt_biometric(value: str) -> bytes:
    raw = base64.urlsafe_b64decode(value)
    return AESGCM(_encryption_key()).decrypt(raw[:12], raw[12:], None)


def create_token(subject: UUID, role: str, kind: str, lifetime: timedelta, session_id: UUID | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(subject), "role": role, "kind": kind, "iat": now, "exp": now + lifetime}
    if session_id:
        payload["sid"] = str(session_id)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, expected_kind: str = "access") -> dict:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from error
    if data.get("kind") != expected_kind:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect token type")
    return data
