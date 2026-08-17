import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Float, ForeignKey, Index, Integer, JSON, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Role(str, enum.Enum):
    BIG_ADMIN = "big_admin"
    TEMP_ADMIN = "temp_admin"
    ADMIN = "admin"
    VOTER = "voter"


class ElectionState(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    OPEN = "open"
    PAUSED = "paused"
    CLOSED = "closed"
    PUBLISHED = "published"


class AuthStage(str, enum.Enum):
    IDENTIFIED = "identified"
    FINGERPRINT = "fingerprint"
    FACE = "face"
    LIVENESS = "liveness"
    CHALLENGE = "challenge"
    RISK = "risk"
    GRANTED = "granted"
    FAILED = "failed"


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    voter: Mapped["Voter | None"] = relationship(back_populates="user", uselist=False)


class AdminProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "admins"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str] = mapped_column(String(160))


class Voter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "voters"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    voter_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    date_of_birth: Mapped[str] = mapped_column(String(10))
    gender: Mapped[str] = mapped_column(String(40))
    mobile: Mapped[str] = mapped_column(String(20), unique=True)
    address_ciphertext: Mapped[str] = mapped_column(Text)
    aadhaar_last_four: Mapped[str] = mapped_column(String(4))
    aadhaar_digest: Mapped[str] = mapped_column(String(64), unique=True)
    user: Mapped[User] = relationship(back_populates="voter")
    face_embedding: Mapped["FaceEmbedding | None"] = relationship(back_populates="voter", uselist=False)
    fingerprint: Mapped["FingerprintTemplate | None"] = relationship(back_populates="voter", uselist=False)
    webauthn_credentials: Mapped[list["WebAuthnCredential"]] = relationship(back_populates="voter", cascade="all, delete-orphan")


class FaceEmbedding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "face_embeddings"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="CASCADE"), unique=True)
    embedding_ciphertext: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str] = mapped_column(String(100))
    voter: Mapped[Voter] = relationship(back_populates="face_embedding")


class FingerprintTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "fingerprint_templates"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="CASCADE"), unique=True)
    sensor_template_id: Mapped[int] = mapped_column(Integer, unique=True)
    template_ciphertext: Mapped[str] = mapped_column(Text)
    sensor_serial: Mapped[str] = mapped_column(String(100))
    voter: Mapped[Voter] = relationship(back_populates="fingerprint")


class WebAuthnCredential(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "webauthn_credentials"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="CASCADE"), index=True)
    credential_id: Mapped[bytes] = mapped_column(LargeBinary, unique=True, index=True)
    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    transports: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    aaguid: Mapped[str | None] = mapped_column(String(36), nullable=True)
    voter: Mapped[Voter] = relationship(back_populates="webauthn_credentials")


class Election(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "elections"
    election_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    state: Mapped[ElectionState] = mapped_column(Enum(ElectionState), default=ElectionState.DRAFT, index=True)
    remote_voting_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_public_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    secure_voting_token: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    secure_voting_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    token_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_flow_mode: Mapped[str] = mapped_column(String(30), default="full")
    enable_step_2: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_step_3: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_step_4: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_step_5: Mapped[bool] = mapped_column(Boolean, default=True)
    show_voter_names_in_results: Mapped[bool] = mapped_column(Boolean, default=False)
    temp_admin_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    temp_admin_user: Mapped["User | None"] = relationship("User", foreign_keys=[temp_admin_user_id])
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="election", cascade="all, delete-orphan")


class Candidate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "candidates"
    election_id: Mapped[str] = mapped_column(String(36), ForeignKey("elections.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    party: Mapped[str] = mapped_column(String(160))
    manifesto: Mapped[str] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    symbol_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    election: Mapped[Election] = relationship(back_populates="candidates")
    __table_args__ = (UniqueConstraint("election_id", "name", name="uq_candidate_election_name"),)


class VoterElectionStatus(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "voter_election_status"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="CASCADE"))
    election_id: Mapped[str] = mapped_column(String(36), ForeignKey("elections.id", ondelete="CASCADE"))
    eligible: Mapped[bool] = mapped_column(Boolean, default=True)
    voted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("voter_id", "election_id", name="uq_voter_election"),)


class Vote(UUIDMixin, Base):
    __tablename__ = "votes"
    election_id: Mapped[str] = mapped_column(String(36), ForeignKey("elections.id", ondelete="RESTRICT"), index=True)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("candidates.id", ondelete="RESTRICT"), index=True)
    receipt_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    cast_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthenticationLog(UUIDMixin, Base):
    __tablename__ = "authentication_logs"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="RESTRICT"), index=True)
    election_id: Mapped[str] = mapped_column(String(36), ForeignKey("elections.id", ondelete="RESTRICT"), index=True)
    stage: Mapped[AuthStage] = mapped_column(Enum(AuthStage), index=True)
    is_success: Mapped[bool] = mapped_column(Boolean)
    fingerprint_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    face_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    liveness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    spoof_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "authentication_sessions"
    voter_id: Mapped[str] = mapped_column(String(36), ForeignKey("voters.id", ondelete="CASCADE"), index=True)
    election_id: Mapped[str] = mapped_column(String(36), ForeignKey("elections.id", ondelete="CASCADE"), index=True)
    stage: Mapped[AuthStage] = mapped_column(Enum(AuthStage), default=AuthStage.IDENTIFIED)
    challenge: Mapped[str | None] = mapped_column(String(32), nullable=True)
    issued_grant_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)


class RefreshSession(UUIDMixin, Base):
    __tablename__ = "refresh_sessions"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SpoofLog(UUIDMixin, Base):
    __tablename__ = "spoof_logs"
    auth_log_id: Mapped[str] = mapped_column(String(36), ForeignKey("authentication_logs.id", ondelete="CASCADE"), index=True)
    attack_type: Mapped[str] = mapped_column(String(80))
    probability: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(UUIDMixin, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class FailedAttempt(UUIDMixin, Base):
    __tablename__ = "failed_attempts"
    identifier: Mapped[str] = mapped_column(String(320), index=True)
    reason: Mapped[str] = mapped_column(String(160))
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Notification(UUIDMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class SystemSetting(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text)


Index("ix_auth_voter_election_created", AuthenticationLog.voter_id, AuthenticationLog.election_id, AuthenticationLog.created_at)

