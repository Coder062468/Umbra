"""add indexes

Revision ID: 001_add_indexes
Revises:
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_indexes'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add index on transactions.created_at
    op.create_index('ix_transactions_created_at', 'transactions', ['created_at'], unique=False)

    # Add composite index for account + date + created_at (already has account_id indexed)
    op.create_index('idx_account_date_created', 'transactions', ['account_id', 'date', 'created_at'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index('idx_account_date_created', table_name='transactions')
    op.drop_index('ix_transactions_created_at', table_name='transactions')
