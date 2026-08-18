"""add voter_registration_mode and quick_voter_records

Revision ID: 5a6b7c8d9e0f
Revises: 4f123a4b56cd
Create Date: 2026-08-18 18:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5a6b7c8d9e0f'
down_revision = '4f123a4b56cd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add voter_registration_mode to elections
    with op.batch_alter_table('elections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('voter_registration_mode', sa.String(length=40), nullable=False, server_default='pre_registered'))

    # Create quick_voter_records table
    op.create_table(
        'quick_voter_records',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('election_id', sa.String(length=36), nullable=False),
        sa.Column('voter_name', sa.String(length=200), nullable=False),
        sa.Column('prn', sa.String(length=10), nullable=False),
        sa.Column('candidate_id', sa.String(length=36), nullable=True),
        sa.Column('candidate_ids_json', sa.JSON(), nullable=True),
        sa.Column('receipt_id', sa.String(length=80), nullable=False),
        sa.Column('cast_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['election_id'], ['elections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('election_id', 'prn', name='uq_quick_voter_election_prn'),
    )
    op.create_index('ix_quick_voter_election_prn', 'quick_voter_records', ['election_id', 'prn'], unique=False)
    op.create_index('ix_quick_voter_records_prn', 'quick_voter_records', ['prn'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_quick_voter_records_prn', table_name='quick_voter_records')
    op.drop_index('ix_quick_voter_election_prn', table_name='quick_voter_records')
    op.drop_table('quick_voter_records')
    with op.batch_alter_table('elections', schema=None) as batch_op:
        batch_op.drop_column('voter_registration_mode')
