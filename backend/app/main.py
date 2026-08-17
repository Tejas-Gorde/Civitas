from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from app.api import admin, auth, biometric, help, verification, voting, webauthn
from app.core.config import get_settings
from app.core.database import Base, engine
from app import models  # noqa: F401

settings = get_settings(); limiter = Limiter(key_func=get_remote_address)


def run_auto_migrations(target_engine):
    from sqlalchemy import inspect, text
    inspector = inspect(target_engine)
    tables = inspector.get_table_names()
    if "voter_election_status" in tables:
        columns = [c["name"] for c in inspector.get_columns("voter_election_status")]
        if "eligible" not in columns:
            with target_engine.begin() as conn:
                conn.execute(text("ALTER TABLE voter_election_status ADD COLUMN eligible BOOLEAN DEFAULT 1"))
    if "elections" in tables:
        columns = [c["name"] for c in inspector.get_columns("elections")]
        with target_engine.begin() as conn:
            if "remote_voting_enabled" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN remote_voting_enabled BOOLEAN DEFAULT 0"))
            if "secure_voting_token" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN secure_voting_token VARCHAR(128)"))
            if "secure_voting_token_hash" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN secure_voting_token_hash VARCHAR(64)"))
            if "token_created_at" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN token_created_at DATETIME"))
            if "token_revoked_at" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN token_revoked_at DATETIME"))
            if "voting_flow_mode" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN voting_flow_mode VARCHAR(30) DEFAULT 'full'"))
            if "enable_step_2" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN enable_step_2 BOOLEAN DEFAULT 1"))
            if "enable_step_3" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN enable_step_3 BOOLEAN DEFAULT 1"))
            if "enable_step_4" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN enable_step_4 BOOLEAN DEFAULT 1"))
            if "enable_step_5" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN enable_step_5 BOOLEAN DEFAULT 1"))
            if "show_voter_names_in_results" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN show_voter_names_in_results BOOLEAN DEFAULT 0"))
            if "temp_admin_user_id" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN temp_admin_user_id VARCHAR(36)"))
            if "election_id" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN election_id VARCHAR(64)"))
            if "custom_public_url" not in columns:
                conn.execute(text("ALTER TABLE elections ADD COLUMN custom_public_url VARCHAR(500)"))
    if "authentication_sessions" in tables:
        columns = [c["name"] for c in inspector.get_columns("authentication_sessions")]
        with target_engine.begin() as conn:
            if "created_at" not in columns:
                conn.execute(text("ALTER TABLE authentication_sessions ADD COLUMN created_at DATETIME"))
            if "updated_at" not in columns:
                conn.execute(text("ALTER TABLE authentication_sessions ADD COLUMN updated_at DATETIME"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
        run_auto_migrations(engine)
        from app.seed import main as seed_db
        seed_db()
    else:
        run_auto_migrations(engine)
    yield



app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan, openapi_url="/openapi.json", docs_url="/docs")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], allow_headers=["Authorization", "Content-Type", "X-Hardware-Token"])
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(biometric.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(voting.router, prefix="/api/v1")
app.include_router(webauthn.router, prefix="/api/v1")
app.include_router(help.router, prefix="/api/v1")





@app.get("/health", tags=["Operations"])
def health(): return {"status": "ok", "service": settings.app_name}
