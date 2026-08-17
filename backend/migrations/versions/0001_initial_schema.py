"""initial normalized voting schema

Revision ID: 0001_initial_schema
"""
from alembic import op
from app.core.database import Base
from app import models  # noqa: F401

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # SQLAlchemy metadata is the single source of truth; Alembic records this immutable schema revision.
    Base.metadata.create_all(op.get_bind())


def downgrade():
    Base.metadata.drop_all(op.get_bind())
