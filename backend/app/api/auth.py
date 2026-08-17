import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_token, decode_token, password_verify
from app.models import FailedAttempt, RefreshSession, User
from app.schemas import LoginRequest, TokenResponse
from app.services.audit import audit

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_tokens(db: Session, user: User, response: Response) -> TokenResponse:
    session = RefreshSession(user_id=user.id, token_hash="", expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days))
    db.add(session)
    db.flush()
    access = create_token(user.id, user.role.value, "access", timedelta(minutes=settings.access_token_minutes), session.id)
    refresh = create_token(user.id, user.role.value, "refresh", timedelta(days=settings.refresh_token_days), session.id)
    session.token_hash = digest(refresh)
    response.set_cookie("refresh_token", refresh, httponly=True, secure=settings.cookie_secure, samesite="strict", max_age=settings.refresh_token_days * 86400, path="/api/v1/auth")
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not user.is_active or not password_verify(data.password, user.password_hash):
        db.add(FailedAttempt(identifier=data.email.lower(), reason="invalid_credentials", source_ip=request.client.host if request.client else None))
        audit(db, user.id if user else None, "login_failed", "user", str(user.id) if user else data.email, {"ip": request.client.host if request.client else ""})
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    audit(db, user.id, "login_success", "user", str(user.id))
    result = issue_tokens(db, user, response)
    db.commit()
    return result


def ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh session")
    payload = decode_token(token, "refresh")
    session = db.get(RefreshSession, payload["sid"])
    if not session or session.revoked_at or session.token_hash != digest(token) or ensure_utc(session.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh session expired")
    session.revoked_at = datetime.now(timezone.utc)
    user = db.get(User, payload["sub"])
    result = issue_tokens(db, user, response)
    db.commit()
    return result


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if token:
        session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == digest(token)))
        if session:
            session.revoked_at = datetime.now(timezone.utc)
    audit(db, user.id, "logout", "user", str(user.id))
    db.commit()
    response.delete_cookie("refresh_token", path="/api/v1/auth")
