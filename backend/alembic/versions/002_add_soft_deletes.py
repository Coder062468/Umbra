"""add soft deletes

Revision ID: 002_add_soft_deletes
Revises: 001_add_indexes
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '002_add_soft_deletes'
down_revision = '001_add_indexes'
branch_labels = None
depends_on = None


def upgrade():
    # Add soft delete columns to transactions table
    op.add_column('transactions', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('transactions', sa.Column('deleted_by', UUID(as_uuid=True), nullable=True))
    op.create_index('ix_transactions_deleted_at', 'transactions', ['deleted_at'], unique=False)
    op.create_index('idx_account_active', 'transactions', ['account_id', 'deleted_at'], unique=False)
    op.create_foreign_key('fk_transactions_deleted_by', 'transactions', 'users', ['deleted_by'], ['id'])

    # Add soft delete columns to accounts table
    op.add_column('accounts', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('accounts', sa.Column('deleted_by', UUID(as_uuid=True), nullable=True))
    op.create_index('ix_accounts_deleted_at', 'accounts', ['deleted_at'], unique=False)
    op.create_foreign_key('fk_accounts_deleted_by', 'accounts', 'users', ['deleted_by'], ['id'])


def downgrade():
    # Drop accounts soft delete columns
    op.drop_constraint('fk_accounts_deleted_by', 'accounts', type_='foreignkey')
    op.drop_index('ix_accounts_deleted_at', table_name='accounts')
    op.drop_column('accounts', 'deleted_by')
    op.drop_column('accounts', 'deleted_at')

    # Drop transactions soft delete columns
    op.drop_constraint('fk_transactions_deleted_by', 'transactions', type_='foreignkey')
    op.drop_index('idx_account_active', table_name='transactions')
    op.drop_index('ix_transactions_deleted_at', table_name='transactions')
    op.drop_column('transactions', 'deleted_by')
    op.drop_column('transactions', 'deleted_at')
