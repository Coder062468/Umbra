"""add user public key for invitation key wrapping

Revision ID: 006_add_user_public_key
Revises: 005_add_admin_panel
Create Date: 2026-02-04

Adds public key infrastructure for E2EE invitation key distribution:
  - users.public_key -> RSA public key for wrapping organization keys

Security Design:
  - Public keys are safe to store on server (only encrypt, cannot decrypt)
  - Private keys are derived client-side from master key (never sent to server)
  - Enables proper E2EE key wrapping for organization invitations
  - Inviter can wrap org key with invitee's public key before they accept
"""
from alembic import op
import sqlalchemy as sa


revision = '006_add_user_public_key'
down_revision = '005_add_admin_panel'
branch_labels = None
depends_on = None


def upgrade():
    # Add public_key column to users table
    op.add_column('users', sa.Column(
        'public_key', sa.Text(),
        nullable=True
    ))


def downgrade():
    # Drop public_key column from users table
    op.drop_column('users', 'public_key')
