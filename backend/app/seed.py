"""Database seeder: creates an admin, demo election (OPEN), and sample candidates.

Runs automatically on startup in development mode.  Safe to re-run — skips
if data already exists.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import password_hash
from app.models import Candidate, Election, ElectionState, Role, User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default admin credentials (can be overridden via env vars)
# ---------------------------------------------------------------------------
DEFAULT_ADMIN_EMAIL = "admin@civitas.local"
DEFAULT_ADMIN_PASSWORD = "Admin@Civitas2026!"


def seed_admin(db) -> User:
    """Create the initial admin user if none exists."""
    email = os.getenv("INITIAL_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).lower()
    password = os.getenv("INITIAL_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)

    admin = db.scalar(select(User).where(User.email == email))
    if admin:
        logger.info("Admin user '%s' already exists — skipping.", email)
        return admin

    admin = User(
        email=email,
        password_hash=password_hash(password),
        role=Role.ADMIN,
    )
    db.add(admin)
    db.flush()
    logger.info("Created admin user '%s'.", email)
    return admin


def seed_election(db) -> Election:
    """Create a demo election in OPEN state if no elections exist."""
    existing = db.scalar(select(Election))
    if existing:
        logger.info("Elections already present — skipping seed.")
        return existing

    now = datetime.now(timezone.utc)
    election = Election(
        name="2026 General Election",
        description=(
            "National general election for the democratic selection of "
            "representatives.  This is a demonstration election created "
            "automatically for local development."
        ),
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(days=7),
        state=ElectionState.OPEN,
    )
    db.add(election)
    db.flush()
    logger.info("Created demo election '%s' (state=OPEN).", election.name)
    return election


DEMO_CANDIDATES = [
    {
        "name": "Aarav Sharma",
        "party": "Progressive Democratic Alliance",
        "manifesto": (
            "Committed to universal digital literacy, transparent governance "
            "through blockchain-verified public records, and green energy "
            "infrastructure for every district."
        ),
    },
    {
        "name": "Priya Deshmukh",
        "party": "National Unity Front",
        "manifesto": (
            "Focused on healthcare reform, affordable housing initiatives, "
            "and strengthening rural connectivity through 5G expansion and "
            "smart village programs."
        ),
    },
    {
        "name": "Rahul Verma",
        "party": "Citizens' Reform Party",
        "manifesto": (
            "Advocating for judicial reform, anti-corruption task forces, "
            "and a modernized education system emphasizing STEM and vocational "
            "training for the youth."
        ),
    },
    {
        "name": "Meera Iyer",
        "party": "Independent",
        "manifesto": (
            "Running as an independent voice for electoral transparency, "
            "environmental sustainability, and technology-driven public "
            "services accessible to all citizens."
        ),
    },
]


def seed_candidates(db, election: Election) -> None:
    """Add sample candidates to the given election if it has none."""
    existing = db.scalar(
        select(Candidate).where(Candidate.election_id == election.id)
    )
    if existing:
        logger.info("Candidates already present — skipping seed.")
        return

    for data in DEMO_CANDIDATES:
        db.add(Candidate(election_id=election.id, **data))

    db.flush()
    logger.info(
        "Created %d demo candidates for '%s'.",
        len(DEMO_CANDIDATES),
        election.name,
    )


def seed_settings(db) -> None:
    """Initialize system settings default values if missing."""
    from app.models import SystemSetting

    defaults = {
        "voice_guidance_enabled": "true",
        "chat_assistant_enabled": "true",
        "default_voice_language": "en",
        "chat_read_aloud_enabled": "true",
    }

    for key, default_val in defaults.items():
        setting = db.scalar(select(SystemSetting).where(SystemSetting.key == key))
        if not setting:
            db.add(SystemSetting(key=key, value=default_val))
            logger.info("Created default system setting '%s=%s'.", key, default_val)



# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def main() -> None:
    """Run all seeders inside a single transaction."""
    db = SessionLocal()
    try:
        seed_admin(db)
        election = seed_election(db)
        seed_candidates(db, election)
        seed_settings(db)
        db.commit()
        logger.info("Database seeding complete.")
    except Exception:
        db.rollback()
        logger.exception("Seeding failed — rolled back.")
        raise
    finally:
        db.close()



if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
