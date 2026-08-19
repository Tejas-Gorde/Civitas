from datetime import datetime
from uuid import UUID
from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class ElectionCreate(BaseModel):
    election_id: str | None = Field(default=None, min_length=3, max_length=64)
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=3000)
    starts_at: datetime
    ends_at: datetime
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    show_voter_names_in_results: bool = False
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    temp_admin_id: str | None = None
    temp_admin_password: str | None = None

    @model_validator(mode="after")
    def validate_election_dates(self) -> "ElectionCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be later than start time")
        return self


class OnboardingCandidateItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    party: str | None = Field(default=None, max_length=160)
    manifesto: str = Field(default="", max_length=5000)

    @field_validator("name")
    @classmethod
    def validate_candidate_name(cls, v: str) -> str:
        cleaned = str(v).strip()
        if not cleaned:
            raise ValueError("Candidate name cannot be empty")
        return cleaned

    @field_validator("party")
    @classmethod
    def validate_candidate_party(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = str(v).strip()
        return cleaned if cleaned else None


class OnboardingVoterItem(BaseModel):
    voter_id: str = Field(min_length=1, max_length=64)
    full_name: str = Field(min_length=1, max_length=200)


class ElectionOnboardingCreate(BaseModel):
    temp_admin_id: str = Field(min_length=3, max_length=120)
    temp_admin_password: str = Field(min_length=4, max_length=128)
    election_id: str | None = Field(default=None, min_length=3, max_length=64)
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=3000)
    starts_at: datetime
    ends_at: datetime
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    show_voter_names_in_results: bool = False
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    candidates: list[OnboardingCandidateItem] = Field(default_factory=list)
    voters: list[OnboardingVoterItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_election_dates(self) -> "ElectionOnboardingCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be later than start time")
        return self


class ElectionUpdate(BaseModel):
    election_id: str | None = Field(default=None, min_length=3, max_length=64)
    name: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=3000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    voting_type: str | None = None
    voter_registration_mode: str | None = None
    voting_flow_mode: str | None = None
    enable_step_2: bool | None = None
    enable_step_3: bool | None = None
    enable_step_4: bool | None = None
    enable_step_5: bool | None = None
    show_voter_names_in_results: bool | None = None
    max_selections: int | None = None
    allow_abstain: bool | None = None
    position_title: str | None = None
    temp_admin_id: str | None = None
    temp_admin_password: str | None = None


class ElectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    election_id: str | None = None
    name: str
    description: str
    starts_at: datetime
    ends_at: datetime
    state: str
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    remote_voting_enabled: bool = False
    has_active_token: bool = False
    token_created_at: datetime | None = None
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    show_voter_names_in_results: bool = False
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    temp_admin_username: str | None = None
    candidate_count: int = 0


class TempAdminLoginRequest(BaseModel):
    temp_admin_id: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=128)

class VoterPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    election_id: str
    voter_id: str
    local_admin_id: str
    photo_type: str
    created_at: datetime
    # Display fields
    voter_reg_id: str | None = None
    voter_name: str | None = None
    election_name: str | None = None
    


class RemoteVotingStatusOut(BaseModel):
    election_id: UUID
    election_name: str
    election_state: str
    remote_voting_enabled: bool
    secure_voting_token: str | None = None
    public_base_url: str | None = None
    voting_url: str | None = None
    is_configured: bool = False
    is_https: bool = False
    is_online: bool = False
    warning_message: str | None = None
    token_created_at: datetime | None = None
    token_revoked_at: datetime | None = None


class PublicUrlConfigIn(BaseModel):
    public_base_url: str


class PublicUrlConfigOut(BaseModel):
    public_base_url: str
    is_configured: bool
    is_https: bool
    is_online: bool = False
    warning_message: str | None = None


class RemoteVotingUrlUpdateIn(BaseModel):
    public_url: str = Field(..., min_length=1, max_length=500)



class CandidateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    party: str | None = Field(default=None, max_length=160)
    manifesto: str = Field(default="", max_length=5000)
    photo_url: str | None = Field(default=None, max_length=500)
    symbol_url: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_candidate_name(cls, v: str) -> str:
        cleaned = str(v).strip()
        if not cleaned:
            raise ValueError("Candidate name cannot be empty")
        return cleaned

    @field_validator("party")
    @classmethod
    def validate_candidate_party(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = str(v).strip()
        return cleaned if cleaned else None


class CandidateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    party: str | None = Field(default=None, max_length=160)
    manifesto: str | None = Field(default=None, max_length=5000)
    photo_url: str | None = Field(default=None, max_length=500)
    symbol_url: str | None = Field(default=None, max_length=500)


class CandidateOut(CandidateCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    election_id: UUID


class VoterRegistration(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    date_of_birth: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: str = Field(min_length=1, max_length=40)
    mobile: str = Field(pattern=r"^\+?[0-9]{10,15}$")
    email: EmailStr
    address: str = Field(min_length=5, max_length=1000)
    aadhaar_number: str = Field(pattern=r"^\d{12}$")
    voter_id: str = Field(pattern=r"^[A-Za-z0-9-]{4,64}$")
    fingerprint_template_id: int = Field(ge=0, le=65535)
    fingerprint_template: str = Field(min_length=8, max_length=4000)
    sensor_serial: str = Field(min_length=3, max_length=100)
    face_frames: list[str] = Field(min_length=3, max_length=5)

    @field_validator("face_frames")
    @classmethod
    def unique_angles(cls, value: list[str]) -> list[str]:
        if len(set(value)) < 3:
            raise ValueError("Capture three distinct live face frames")
        return value


class AdminVoterCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    voter_id: str = Field(min_length=1, max_length=64)
    election_id: str | None = None
    email: EmailStr | None = None
    mobile: str | None = None
    is_eligible: bool = True


class VoterUpdate(BaseModel):
    voter_id: str | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    mobile: str | None = None
    is_active: bool | None = None


class VoterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    voter_id: str
    full_name: str
    email: str
    mobile: str
    is_active: bool
    has_voted: bool = False
    has_webauthn: bool = False
    created_at: datetime


class VoterVerifyRequest(BaseModel):
    election_id: str = Field(..., validation_alias=AliasChoices("election_id", "electionId"))
    voter_id: str = Field(..., validation_alias=AliasChoices("voter_id", "voter_registration_id", "voterId", "prn", "voter_prn"), min_length=1, max_length=64)
    voter_name: str = Field(..., validation_alias=AliasChoices("voter_name", "voterName", "name", "full_name"), min_length=1, max_length=200)

    model_config = ConfigDict(populate_by_name=True)


class VoterVerifyResponse(BaseModel):
    eligible: bool
    message: str
    voter_id: str | None = None
    voter_internal_id: UUID | None = None
    session_id: UUID | None = None
    expires_at: str | None = None
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None


class WebAuthnRegisterOptionsRequest(BaseModel):
    voter_id: str


class WebAuthnRegisterVerifyRequest(BaseModel):
    voter_id: str
    credential: str


class WebAuthnAuthOptionsRequest(BaseModel):
    voter_id: str
    session_id: UUID


class WebAuthnAuthVerifyRequest(BaseModel):
    session_id: UUID
    credential: str


class BiometricStart(BaseModel):
    voter_id: str = Field(min_length=4, max_length=64)
    election_id: UUID
    full_name: str | None = None


class CandidateTally(BaseModel):
    id: UUID
    name: str
    party: str
    votes: int


class ResultSummaryOut(BaseModel):
    election_id: UUID
    election_name: str
    state: str
    total_voters: int
    total_votes_cast: int
    turnout_percent: float
    candidates: list[CandidateTally]


class FingerprintResult(BaseModel):
    session_id: UUID
    sensor_template_id: int = Field(ge=0, le=65535)
    sensor_score: float = Field(ge=0, le=100)
    sensor_serial: str = Field(min_length=3, max_length=100)


class FramePayload(BaseModel):
    session_id: UUID
    image: str = Field(min_length=100, max_length=10_000_000)


class ChallengePayload(BaseModel):
    session_id: UUID
    observed_action: str = Field(default="shake_hand", min_length=1, max_length=40)
    image: str = ""


class VoiceGuidanceSettingsOut(BaseModel):
    enabled: bool
    language: str = "en-US"


class VoiceGuidanceSettingsUpdate(BaseModel):
    enabled: bool


class VoterAssistanceSettingsOut(BaseModel):
    voice_guidance_enabled: bool
    chat_assistant_enabled: bool
    default_voice_language: str = "en"
    chat_read_aloud_enabled: bool
    mobile_device_verification_enabled: bool = False
    session_timeout_minutes: int = 30
    inactivity_timeout_minutes: int = 15
    step_timeout_minutes: int = 10
    photo_upload_max_retries: int = 5
    photo_max_attempts: int | None = None
    liveness_max_attempts: int | None = None
    supported_languages: list[str] = ["en", "hi"]


class VoterAssistanceSettingsUpdate(BaseModel):
    voice_guidance_enabled: bool | None = None
    chat_assistant_enabled: bool | None = None
    default_voice_language: str | None = None
    chat_read_aloud_enabled: bool | None = None
    mobile_device_verification_enabled: bool | None = None
    session_timeout_minutes: int | None = None
    inactivity_timeout_minutes: int | None = None
    step_timeout_minutes: int | None = None
    photo_upload_max_retries: int | None = None
    photo_max_attempts: int | None = None
    liveness_max_attempts: int | None = None


class HelpChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    language: str = Field(default="en", pattern="^(en|hi)$")


class HelpChatResponse(BaseModel):
    answer: str
    language: str = "en"



class AuthProgress(BaseModel):
    session_id: UUID
    stage: str
    challenge: str | None = None
    metrics: dict = {}
    voting_grant: str | None = None


class QuickVoterVerifyRequest(BaseModel):
    election_id: str = Field(..., validation_alias=AliasChoices("election_id", "electionId"))
    full_name: str = Field(..., validation_alias=AliasChoices("full_name", "name", "voter_name", "voterName"), min_length=1, max_length=200)
    prn: str = Field(..., validation_alias=AliasChoices("prn", "voter_id", "voter_prn", "voterId", "prn_number"), min_length=1, max_length=64)

    @field_validator("prn")
    @classmethod
    def validate_and_normalize_prn(cls, v: str) -> str:
        normalized = str(v).strip()
        if not normalized:
            raise ValueError("PRN / Voter ID is required.")
        return normalized

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = str(v).strip()
        if not cleaned:
            raise ValueError("Full Name is required.")
        return cleaned

    model_config = ConfigDict(populate_by_name=True)


class QuickVoterVerifyResponse(BaseModel):
    eligible: bool
    message: str
    voter_name: str
    prn: str
    session_id: UUID
    voting_type: str = "regular"
    voter_registration_mode: str = "quick_entry"
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None


class QuickVoterRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    voter_name: str
    prn: str
    vote_given_to: str
    cast_at: datetime


class CastVote(BaseModel):
    election_id: UUID
    candidate_id: UUID | None = None
    candidate_ids: list[UUID] | None = None
    voting_grant: str = Field(min_length=64, max_length=4096)
    voter_name: str | None = None
    prn: str | None = None


class VoteReceipt(BaseModel):
    receipt_id: str
    cast_at: datetime


class LiveElectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    election_id: str | None = None
    name: str
    description: str = ""
    starts_at: datetime
    ends_at: datetime
    state: str
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    remote_voting_enabled: bool = False
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    show_voter_names_in_results: bool = False
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    is_live_now: bool = False
    candidate_count: int = 0


class VerifyTokenResponse(BaseModel):
    valid: bool
    election_id: UUID
    election_name: str
    starts_at: datetime
    ends_at: datetime
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    message: str = "Token is valid and active."


class PublicElectionDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    election_id: str | None = None
    name: str
    description: str = ""
    starts_at: datetime
    ends_at: datetime
    state: str
    voting_type: str = "regular"
    voter_registration_mode: str = "pre_registered"
    remote_voting_enabled: bool = False
    voting_flow_mode: str = "full"
    enable_step_2: bool = True
    enable_step_3: bool = True
    enable_step_4: bool = True
    enable_step_5: bool = True
    show_voter_names_in_results: bool = False
    max_selections: int = 1
    allow_abstain: bool = False
    position_title: str | None = None
    is_live_now: bool = False
    candidate_count: int = 0
