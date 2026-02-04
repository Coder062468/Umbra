"""add e2e encryption columns

Revision ID: 003_add_e2e_encryption
Revises: 002_add_soft_deletes
Create Date: 2026-02-02

Adds columns needed for True End-to-End Encryption:
  - users.salt                  → PBKDF2 salt for client-side master key derivation
  - accounts.encrypted_data     → AES-GCM encrypted {name, opening_balance}
  - accounts.encrypted_dek      → Per-account Data Encryption Key, wrapped with user's master key
  - accounts.encryption_version → 0 = legacy plaintext, 1 = E2E encrypted
  - transactions.encrypted_data → AES-GCM encrypted {amount, paid_to_from, narration}
  - transactions.encryption_version → 0 = legacy plaintext, 1 = E2E encrypted

Plaintext columns (amount, paid_to_from, narration, balance_after, name, opening_balance)
are made NULLABLE so legacy rows can coexist with new encrypted rows during migration.
After migration is complete and verified, a follow-up migration can DROP those columns.

Drops idx_account_person index: paid_to_from is now encrypted and no longer searchable.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '003_add_e2e_encryption'
down_revision = '002_add_soft_deletes'
branch_labels = None
depends_on = None


def upgrade():
    # ─── users: add PBKDF2 salt ─────────────────────────────────────────
    op.add_column('users', sa.Column('salt', sa.Text(), nullable=True))

    # ─── accounts: add encryption columns ───────────────────────────────
    op.add_column('accounts', sa.Column(
        'encrypted_data', sa.Text(), nullable=True
    ))
    op.add_column('accounts', sa.Column(
        'encrypted_dek', sa.Text(), nullable=True
    ))
    op.add_column('accounts', sa.Column(
        'encryption_version', sa.Integer(), nullable=False, server_default='0'
    ))

    # Make legacy plaintext columns nullable (migration coexistence)
    op.alter_column('accounts', 'name', nullable=True)
    op.alter_column('accounts', 'opening_balance', nullable=True)

    # ─── transactions: add encryption columns ───────────────────────────
    op.add_column('transactions', sa.Column(
        'encrypted_data', sa.Text(), nullable=True
    ))
    op.add_column('transactions', sa.Column(
        'encryption_version', sa.Integer(), nullable=False, server_default='0'
    ))

    # Make legacy plaintext columns nullable (migration coexistence)
    op.alter_column('transactions', 'amount', nullable=True)
    op.alter_column('transactions', 'paid_to_from', nullable=True)
    op.alter_column('transactions', 'balance_after', nullable=True)
    # narration is already nullable — no change needed

    # ─── Drop index on paid_to_from (encrypted, no longer searchable) ───
    op.drop_index('idx_account_person', table_name='transactions')


def downgrade():
    # Restore index
    op.create_index(
        'idx_account_person', 'transactions',
        ['account_id', 'paid_to_from'], unique=False
    )

    # Restore NOT NULL on transaction plaintext columns
    op.alter_column('transactions', 'balance_after', nullable=False)
    op.alter_column('transactions', 'paid_to_from', nullable=False)
    op.alter_column('transactions', 'amount', nullable=False)

    # Remove encryption columns from transactions
    op.drop_column('transactions', 'encryption_version')
    op.drop_column('transactions', 'encrypted_data')

    # Restore NOT NULL on account plaintext columns
    op.alter_column('accounts', 'opening_balance', nullable=False)
    op.alter_column('accounts', 'name', nullable=False)

    # Remove encryption columns from accounts
    op.drop_column('accounts', 'encryption_version')
    op.drop_column('accounts', 'encrypted_dek')
    op.drop_column('accounts', 'encrypted_data')

    # Remove salt from users
    op.drop_column('users', 'salt')
