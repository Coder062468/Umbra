"""add organizations and multi-user support

Revision ID: 004_add_organizations
Revises: 003_add_e2e_encryption
Create Date: 2026-02-03

Adds tables and columns for multi-user organization support:
  - organizations                → Organization entities (families, small groups)
  - organization_members         → Many-to-many: users ↔ organizations with roles
  - organization_invitations     → Pending invitations to join organizations
  - account_permissions          → Per-account granular access control
  - audit_logs                   → Audit trail for sensitive operations
  - user_activity                → Activity tracking for analytics

Updates accounts table:
  - organization_id    → Account now belongs to organization (not just user)
  - created_by         → Track who created the account
  - default_permission → Default permission level for new members
  - migrated           → Migration tracking flag

E2EE Key Sharing Architecture:
  - Organization has a master key shared by all members
  - Each member has encrypted copy in organization_members.wrapped_org_key
  - Organization master key wraps all account DEKs
  - Zero-knowledge maintained (server never sees plaintext)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, INET
import uuid


# revision identifiers
revision = '004_add_organizations'
down_revision = '003_add_e2e_encryption'
branch_labels = None
depends_on = None


def upgrade():
    # ─── Create organizations table ──────────────────────────────────────
    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_index('idx_organizations_created_by', 'organizations', ['created_by'])
    op.create_index('idx_organizations_deleted', 'organizations', ['deleted_at'])

    # ─── Create organization_members table ───────────────────────────────
    op.create_table(
        'organization_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='member'),
        sa.Column('wrapped_org_key', sa.Text(), nullable=False),
        sa.Column('invited_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('invited_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('joined_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('organization_id', 'user_id',
                           name='uq_org_member')
    )

    op.create_index('idx_org_members_org', 'organization_members', ['organization_id'])
    op.create_index('idx_org_members_user', 'organization_members', ['user_id'])
    op.create_index('idx_org_members_role', 'organization_members',
                   ['organization_id', 'role'])

    # ─── Create organization_invitations table ───────────────────────────
    op.create_table(
        'organization_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='member'),
        sa.Column('wrapped_org_key', sa.Text(), nullable=False),
        sa.Column('invited_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(255), unique=True, nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('organization_id', 'email',
                           name='uq_org_invitation')
    )

    op.create_index('idx_invitations_org', 'organization_invitations', ['organization_id'])
    op.create_index('idx_invitations_email', 'organization_invitations', ['email'])
    op.create_index('idx_invitations_token', 'organization_invitations', ['token'])
    op.create_index('idx_invitations_pending', 'organization_invitations',
                   ['accepted_at', 'rejected_at'])

    # ─── Create account_permissions table ────────────────────────────────
    op.create_table(
        'account_permissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('account_id', UUID(as_uuid=True),
                  sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission', sa.String(20), nullable=False, server_default='view'),
        sa.Column('granted_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('account_id', 'user_id',
                           name='uq_account_permission')
    )

    op.create_index('idx_account_perms_account', 'account_permissions', ['account_id'])
    op.create_index('idx_account_perms_user', 'account_permissions', ['user_id'])

    # ─── Create audit_logs table ──────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', UUID(as_uuid=True), nullable=True),
        sa.Column('details', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('ip_address', INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()'))
    )

    op.create_index('idx_audit_org', 'audit_logs', ['organization_id', 'created_at'],
                   postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_audit_user', 'audit_logs', ['user_id', 'created_at'],
                   postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_audit_action', 'audit_logs', ['action', 'created_at'],
                   postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})

    # ─── Create user_activity table ───────────────────────────────────────
    op.create_table(
        'user_activity',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()'))
    )

    op.create_index('idx_activity_user', 'user_activity', ['user_id', 'created_at'],
                   postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_activity_org', 'user_activity', ['organization_id', 'created_at'],
                   postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})

    # ─── Update accounts table ───────────────────────────────────────────
    op.add_column('accounts', sa.Column(
        'organization_id', UUID(as_uuid=True),
        sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True
    ))
    op.add_column('accounts', sa.Column(
        'created_by', UUID(as_uuid=True),
        sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    ))
    op.add_column('accounts', sa.Column(
        'default_permission', sa.String(20),
        nullable=False, server_default='view'
    ))
    op.add_column('accounts', sa.Column(
        'migrated', sa.Boolean(),
        nullable=False, server_default='false'
    ))

    op.create_index('idx_accounts_org', 'accounts', ['organization_id'])


def downgrade():
    # ─── Drop indexes and columns from accounts ──────────────────────────
    op.drop_index('idx_accounts_org', table_name='accounts')
    op.drop_column('accounts', 'migrated')
    op.drop_column('accounts', 'default_permission')
    op.drop_column('accounts', 'created_by')
    op.drop_column('accounts', 'organization_id')

    # ─── Drop user_activity table ────────────────────────────────────────
    op.drop_index('idx_activity_org', table_name='user_activity')
    op.drop_index('idx_activity_user', table_name='user_activity')
    op.drop_table('user_activity')

    # ─── Drop audit_logs table ───────────────────────────────────────────
    op.drop_index('idx_audit_action', table_name='audit_logs')
    op.drop_index('idx_audit_user', table_name='audit_logs')
    op.drop_index('idx_audit_org', table_name='audit_logs')
    op.drop_table('audit_logs')

    # ─── Drop account_permissions table ───────────────────────────────────
    op.drop_index('idx_account_perms_user', table_name='account_permissions')
    op.drop_index('idx_account_perms_account', table_name='account_permissions')
    op.drop_table('account_permissions')

    # ─── Drop organization_invitations table ──────────────────────────────
    op.drop_index('idx_invitations_pending', table_name='organization_invitations')
    op.drop_index('idx_invitations_token', table_name='organization_invitations')
    op.drop_index('idx_invitations_email', table_name='organization_invitations')
    op.drop_index('idx_invitations_org', table_name='organization_invitations')
    op.drop_table('organization_invitations')

    # ─── Drop organization_members table ──────────────────────────────────
    op.drop_index('idx_org_members_role', table_name='organization_members')
    op.drop_index('idx_org_members_user', table_name='organization_members')
    op.drop_index('idx_org_members_org', table_name='organization_members')
    op.drop_table('organization_members')

    # ─── Drop organizations table ─────────────────────────────────────────
    op.drop_index('idx_organizations_deleted', table_name='organizations')
    op.drop_index('idx_organizations_created_by', table_name='organizations')
    op.drop_table('organizations')
