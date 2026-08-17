import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before loading settings
os.environ["ENVIRONMENT"] = "development"
os.environ["JWT_SECRET"] = "test-secret-key-that-is-at-least-32-chars-long"
os.environ["HARDWARE_BRIDGE_TOKEN"] = "test-bridge-token"
os.environ["BIOMETRIC_ENCRYPTION_KEY"] = "c29tZS0zMi1ieXRlLWtleS1mb3ItdGVzdGluZy0xMjM0NTY="

from app.main import app, run_auto_migrations
import app.models as _models
from app.core.database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    run_auto_migrations(engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
