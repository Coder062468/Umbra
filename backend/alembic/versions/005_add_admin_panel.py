"""add system admin and management tables

Revision ID: 005_add_admin_panel
Revises: 004_add_organizations
Create Date: 2026-02-04

Adds system administration capabilities:
  - system_settings     -> Configurable system parameters
  - system_logs         -> Centralized system logging
  - backup_metadata     -> Database backup tracking

Updates users table:
  - is_system_admin    -> System administrator flag
  - last_login_at      -> Track last login time
  - login_count        -> Login frequency tracking

Security Design:
  - System admin cannot decrypt user data (respects E2EE)
  - Separate from organization admin role
  - All admin actions logged
  - Statistics and monitoring only
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision = '005_add_admin_panel'
down_revision = '004_add_organizations'
branch_labels = None
depends_on = None


def upgrade():
    # Update users table with admin tracking
    op.add_column('users', sa.Column(
        'is_system_admin', sa.Boolean(),
        nullable=False, server_default='false'
    ))
    op.add_column('users', sa.Column(
        'last_login_at', sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('users', sa.Column(
        'login_count', sa.Integer(),
        nullable=False, server_default='0'
    ))

    op.create_index('idx_users_system_admin', 'users', ['is_system_admin'])
    op.create_index('idx_users_last_login', 'users', ['last_login_at'])

    # Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('key', sa.String(100), unique=True, nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()'))
    )

    op.create_index('idx_system_settings_key', 'system_settings', ['key'])

    # Create system_logs table
    op.create_table(
        'system_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('level', sa.String(20), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()'))
    )

    op.create_index('idx_system_logs_level', 'system_logs',
                   ['level', 'created_at'],
                   postgresql_using='btree',
                   postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_system_logs_category', 'system_logs',
                   ['category', 'created_at'],
                   postgresql_using='btree',
                   postgresql_ops={'created_at': 'DESC'})
    op.create_index('idx_system_logs_created', 'system_logs',
                   ['created_at'],
                   postgresql_using='btree',
                   postgresql_ops={'created_at': 'DESC'})

    # Create backup_metadata table
    op.create_table(
        'backup_metadata',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  default=uuid.uuid4, nullable=False),
        sa.Column('backup_file', sa.String(255), nullable=False),
        sa.Column('backup_size', sa.BigInteger(), nullable=True),
        sa.Column('backup_type', sa.String(20), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('restored_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True)
    )

    op.create_index('idx_backup_created', 'backup_metadata', ['created_at'],
                   postgresql_using='btree',
                   postgresql_ops={'created_at': 'DESC'})


def downgrade():
    # Drop backup_metadata table
    op.drop_index('idx_backup_created', table_name='backup_metadata')
    op.drop_table('backup_metadata')

    # Drop system_logs table
    op.drop_index('idx_system_logs_created', table_name='system_logs')
    op.drop_index('idx_system_logs_category', table_name='system_logs')
    op.drop_index('idx_system_logs_level', table_name='system_logs')
    op.drop_table('system_logs')

    # Drop system_settings table
    op.drop_index('idx_system_settings_key', table_name='system_settings')
    op.drop_table('system_settings')

    # Drop columns from users table
    op.drop_index('idx_users_last_login', table_name='users')
    op.drop_index('idx_users_system_admin', table_name='users')
    op.drop_column('users', 'login_count')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'is_system_admin')
