from uuid import UUID
from sqlalchemy.orm import Session
from app.models import AuditLog


def audit(db: Session, actor_id: UUID | None, action: str, entity_type: str, entity_id: str, metadata: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=entity_id, metadata_json=metadata or {}))
