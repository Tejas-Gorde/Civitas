"""Add voting_type to elections table

Revision ID: 4f123a4b56cd
Revises: 3abc9c15aad2
Create Date: 2026-08-18 18:17:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4f123a4b56cd'
down_revision = '3abc9c15aad2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('elections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('voting_type', sa.String(length=40), server_default='regular', nullable=False))


def downgrade():
    with op.batch_alter_table('elections', schema=None) as batch_op:
        batch_op.drop_column('voting_type')
