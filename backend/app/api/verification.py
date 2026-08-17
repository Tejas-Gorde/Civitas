import os
import re
import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import AuthSession, AuthStage, AuthenticationLog, Voter, VoterElectionStatus

router = APIRouter(prefix="/verification", tags=["Verification"])

from pathlib import Path

DESKTOP_PHOTOS_DIR = Path.home() / "Desktop" / "Civitas_Voter_Photos"
DESKTOP_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
VOTER_PHOTOS_DIR = str(DESKTOP_PHOTOS_DIR.resolve())
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}



def ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def save_voter_photo_file(db: Session, session: AuthSession, file: UploadFile) -> dict:
    current = datetime.now(timezone.utc)
    if not session or session.closed_at or ensure_utc(session.expires_at) < current:
        raise HTTPException(401, "Your voting session has expired. Please restart verification.")

    # Refresh session activity timestamp
    session.updated_at = current

    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, "Invalid image format. Only JPEG, PNG, and WebP images are allowed.")

    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "Image file size exceeds maximum limit of 5 MB.")

    if len(contents) == 0:
        raise HTTPException(400, "Uploaded photo file is empty.")

    voter = db.get(Voter, session.voter_id)
    voter_reg_id = voter.voter_id if voter else "VOTER-UNKNOWN"

    # Sanitize voter registration ID to prevent path traversal or unwanted chars in filename
    sanitized_voter_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voter_reg_id)

    ext = ".jpg"
    if file.filename and "." in file.filename:
        proposed_ext = "." + file.filename.rsplit(".", 1)[1].lower()
        if proposed_ext in (".jpg", ".jpeg", ".png", ".webp"):
            ext = proposed_ext

    timestamp_str = current.strftime("%Y%m%d_%H%M%S")
    suffix = secrets.token_hex(2)
    filename = f"{sanitized_voter_id}_{timestamp_str}_{suffix}{ext}"
    safe_filename = os.path.basename(filename)

    os.makedirs(VOTER_PHOTOS_DIR, exist_ok=True)
    target_path = os.path.abspath(os.path.join(VOTER_PHOTOS_DIR, safe_filename))

    if not target_path.startswith(os.path.abspath(VOTER_PHOTOS_DIR)):
        raise HTTPException(400, "Invalid filename or path traversal attempt detected.")

    with open(target_path, "wb") as f:
        f.write(contents)

    photo_id = str(uuid.uuid4())
    challenge_choice = secrets.choice(["blink", "smile", "turn_left", "turn_right"])
    session.stage = AuthStage.FACE
    session.challenge = challenge_choice
    session.metrics = {**session.metrics, "face": 100.0, "photo_captured": True, "photo_filename": safe_filename}

    db.add(
        AuthenticationLog(
            voter_id=session.voter_id,
            election_id=session.election_id,
            stage=AuthStage.FACE,
            is_success=True,
            face_confidence=100.0,
            detail={"photo_saved": True, "photo_id": photo_id, "filename": safe_filename, "challenge": challenge_choice},
        )
    )
    db.commit()

    return {
        "success": True,
        "message": "Voter photo saved successfully",
        "photo_id": photo_id,
        "filename": safe_filename,
        "challenge": challenge_choice,
    }



@router.post("/photo")
async def upload_voter_photo(
    session_id: str = Form(...),
    voter_id: Optional[str] = Form(None),
    election_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        session_uuid = uuid.UUID(session_id.strip())
    except ValueError:
        raise HTTPException(400, "Invalid session ID format.")

    session = db.get(AuthSession, str(session_uuid))
    if not session:
        raise HTTPException(404, "Verification session not found.")

    return save_voter_photo_file(db, session, file)
