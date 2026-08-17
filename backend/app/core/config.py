from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "Secure Digital Voting API"
    environment: str = "development"
    database_url: str = f"sqlite:///{BACKEND_DIR}/voting.db"
    redis_url: str = "redis://redis:6379/0"
    jwt_private_key: str = ""
    jwt_secret: str = "change-me-development-only"
    biometric_encryption_key: str = ""
    hardware_bridge_token: str = "change-me-hardware-token"
    public_base_url: str = ""
    public_app_url: str = ""
    next_public_public_app_url: str = ""
    next_public_public_voting_url: str = ""
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://civitas-frontend.onrender.com,https://civitas-frontend-nvp6.onrender.com"
    cors_allowed_origins: str = ""
    access_token_minutes: int = 10
    refresh_token_days: int = 1
    max_authentication_minutes: int = 5
    face_threshold: float = 0.72
    fingerprint_threshold: float = 80.0
    risk_threshold: float = 25.0
    cookie_secure: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def resolve_db_url(cls, v: str) -> str:
        if isinstance(v, str) and (v == "sqlite:///./voting.db" or v.startswith("sqlite:///./")):
            rel_path = v.replace("sqlite:///./", "")
            return f"sqlite:///{BACKEND_DIR}/{rel_path}"
        return v

    @property
    def raw_public_url(self) -> str:
        url = (
            self.public_base_url
            or self.public_app_url
            or self.next_public_public_voting_url
            or self.next_public_public_app_url
        )
        return url.strip().rstrip("/") if url else ""

    @property
    def effective_public_app_url(self) -> str:
        url = self.raw_public_url
        if not url:
            return ""
        # Validate that it is not localhost or private IP
        low = url.lower()
        if (
            "localhost" in low
            or "127.0.0.1" in low
            or "192.168." in low
            or "10." in low
            or "172.16." in low
            or "172.17." in low
            or "172.18." in low
            or "172.19." in low
            or "172.20." in low
            or "172.21." in low
            or "172.22." in low
            or "172.23." in low
            or "172.24." in low
            or "172.25." in low
            or "172.26." in low
            or "172.27." in low
            or "172.28." in low
            or "172.29." in low
            or "172.30." in low
            or "172.31." in low
        ):
            return ""
        return url

    @property
    def origins(self) -> list[str]:
        raw_combined = f"{self.cors_origins},{self.cors_allowed_origins}"
        base_list = [origin.strip() for origin in raw_combined.split(",") if origin.strip()]
        # Add default local development and known production origins
        defaults = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "https://civitas-frontend.onrender.com",
        ]
        for d in defaults:
            if d not in base_list:
                base_list.append(d)
        eff = self.effective_public_app_url
        if eff and eff not in base_list:
            base_list.append(eff)
        return base_list


_settings_instance: Settings | None = None


def set_runtime_public_base_url(url: str):
    s = get_settings()
    s.public_base_url = url.strip().rstrip("/")


@lru_cache
def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance


