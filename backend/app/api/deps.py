from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Election, Role, User

bearer = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication credentials required")
    try:
        payload = decode_token(credentials.credentials)
        user_id = str(UUID(payload["sub"]))
        user = db.get(User, user_id)
        if user and user.is_active:
            return user
    except Exception:
        pass
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired authorization token")


def optional_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User | None:
    if credentials and credentials.credentials:
        try:
            payload = decode_token(credentials.credentials)
            user_id = str(UUID(payload["sub"]))
            user = db.get(User, user_id)
            if user and user.is_active:
                return user
        except Exception:
            pass
    return None


def big_admin_only(user: User = Depends(current_user)) -> User:
    if user.role not in (Role.BIG_ADMIN, Role.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Big Administrator role required")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role not in (Role.BIG_ADMIN, Role.ADMIN, Role.TEMP_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator privileges required")
    return user


def local_admin_only(user: User = Depends(current_user)) -> User:
    if user.role != Role.TEMP_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Local Administrator privileges required")
    return user


def verify_election_access(election_id: str, user: User, db: Session, write_access: bool = False) -> Election:
    clean_id = str(election_id).strip()
    election = db.scalar(
        select(Election).where(
            (func.lower(Election.id) == clean_id.lower()) |
            (func.lower(Election.election_id) == clean_id.lower())
        )
    )
    if not election:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Election not found.")

    if write_access:
        # Big Admin cannot modify elections managed by Local Admins
        if user.role in (Role.BIG_ADMIN, Role.ADMIN):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Big Administrator is restricted to read-only system monitoring and cannot modify election configurations or records.",
            )

        if user.role == Role.TEMP_ADMIN:
            if election.temp_admin_user_id == user.id:
                return election
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not authorized to modify this election.")

        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is not authorized to modify elections.")

    # Read-only access: Big Admin can monitor; Local Admin can only view their own election
    if user.role in (Role.BIG_ADMIN, Role.ADMIN):
        return election

    if user.role == Role.TEMP_ADMIN:
        if election.temp_admin_user_id == user.id:
            return election
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not authorized to access this election.")

    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is not authorized to access election records.")

