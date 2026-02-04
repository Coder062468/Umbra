"""
SQLAlchemy Models
Database table definitions for users, accounts, and transactions

E2E Encryption Design:
  - Server is ZERO-KNOWLEDGE for sensitive financial data.
  - Fields encrypted client-side (AES-256-GCM) before reaching this layer:
      transactions: amount, paid_to_from, narration  → stored in encrypted_data
      accounts:     name, opening_balance            → stored in encrypted_data
  - balance_after is computed CLIENT-SIDE; not stored in E2E mode.
  - date stays plaintext (needed for server-side chronological ordering).
  - encryption_version: 0 = legacy plaintext row, 1 = E2E encrypted row.
"""

from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey, Index, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class User(Base):
    """User model for authentication and E2E key derivation"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # E2E: PBKDF2 salt — client uses this + password to derive the master key.
    # Server never sees or uses the master key; it just stores the salt.
    salt = Column(Text, nullable=True)

    # E2E: RSA public key for invitation key wrapping
    # Used to wrap organization keys for invitees before they accept
    public_key = Column(Text, nullable=True)

    # E2E: RSA private key encrypted with user's master key (AES-GCM)
    # Stored on server but can only be decrypted client-side with master key
    # This ensures RSA keys persist across sessions while maintaining E2EE
    encrypted_private_key = Column(Text, nullable=True)

    # System administration
    is_system_admin = Column(Boolean, default=False, nullable=False, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True, index=True)
    login_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan",
                           foreign_keys="[Account.user_id]")


class Account(Base):
    """
    Account model for expense tracking.

    E2E fields:
      encrypted_data  — AES-GCM blob: { name, opening_balance }
      encrypted_dek   — The account's Data Encryption Key, wrapped (encrypted)
                        with the organization's master key (multi-user) or user's master key (single-user legacy).
      encryption_version — 0 = plaintext (legacy), 1 = E2E encrypted

    Multi-user support:
      organization_id    — Account belongs to organization (shared access)
      created_by         — Track who created the account
      default_permission — Default permission level for new organization members
    """
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    # Multi-user organization support
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
                            nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    default_permission = Column(String(20), default="view", nullable=False)
    migrated = Column(Boolean, default=False, nullable=False)

    # Legacy plaintext columns — nullable so encrypted rows can omit them.
    # After full migration these can be dropped.
    name = Column(String(100), nullable=True)
    opening_balance = Column(Numeric(15, 2), nullable=True)

    currency = Column(String(3), default="INR", nullable=False)

    # E2E encryption columns
    encrypted_data = Column(Text, nullable=True)
    encrypted_dek = Column(Text, nullable=True)
    encryption_version = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    # Soft delete
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    user = relationship("User", back_populates="accounts", foreign_keys=[user_id])
    organization = relationship("Organization", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account",
                                cascade="all, delete-orphan")
    permissions = relationship("AccountPermission", back_populates="account",
                              cascade="all, delete-orphan")


class Transaction(Base):
    """
    Transaction model for income/expense records.

    E2E fields:
      encrypted_data     — AES-GCM blob: { amount, paid_to_from, narration }
      encryption_version — 0 = plaintext (legacy), 1 = E2E encrypted

    Fields that remain PLAINTEXT (needed for server-side ordering):
      date       — transactions are ordered by date on the server
      created_at — secondary sort key; also used for serial number assignment
    """
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)   # Plaintext — date ordering

    # Legacy plaintext columns — nullable for migration coexistence.
    amount = Column(Numeric(15, 2), nullable=True)
    paid_to_from = Column(String(200), nullable=True)
    narration = Column(Text, nullable=True)
    balance_after = Column(Numeric(15, 2), nullable=True)  # Computed client-side in E2E

    # E2E encryption columns
    encrypted_data = Column(Text, nullable=True)
    encryption_version = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    # Soft delete
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    account = relationship("Account", back_populates="transactions")

    # Composite indexes
    # NOTE: idx_account_person was removed — paid_to_from is now encrypted.
    __table_args__ = (
        Index("idx_account_date", "account_id", "date"),
        Index("idx_account_date_created", "account_id", "date", "created_at"),
        Index("idx_account_active", "account_id", "deleted_at"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# Multi-User Organization Models
# ═══════════════════════════════════════════════════════════════════════════


class Organization(Base):
    """
    Organization model for multi-user expense tracking.

    Represents families, small groups, or teams that share expense accounts.
    Each organization has a master key (stored encrypted for each member).
    """
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    settings = Column(JSON, default={}, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Relationships
    members = relationship("OrganizationMember", back_populates="organization",
                          cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="organization")
    invitations = relationship("OrganizationInvitation", back_populates="organization",
                              cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization",
                             cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="organization",
                             cascade="all, delete-orphan")


class OrganizationMember(Base):
    """
    Organization membership model (many-to-many: users ↔ organizations).

    Each member has their own encrypted copy of the organization's master key
    (wrapped with their personal master key derived from password).

    Roles:
      owner  — Full control, can manage members, transfer ownership, delete org
      admin  — Can manage accounts and members (except owner operations)
      member — Can view and edit transactions
      viewer — Read-only access
    """
    __tablename__ = "organization_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    role = Column(String(20), default="member", nullable=False)
    wrapped_org_key = Column(Text, nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invited_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    joined_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


class OrganizationInvitation(Base):
    """
    Organization invitation model for pending member invitations.

    Invitations have a secure token and expiration date.
    The wrapped_org_key is pre-encrypted for the invitee (if they already have an account).
    """
    __tablename__ = "organization_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), default="member", nullable=False)
    wrapped_org_key = Column(Text, nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    message = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="invitations")


class AccountPermission(Base):
    """
    Per-account permission model for granular access control.

    Allows fine-grained permissions beyond organization-level roles.
    For example, a member might have full access to one account but view-only to another.

    Permissions:
      full — Full CRUD access
      edit — Can edit transactions
      view — Read-only
    """
    __tablename__ = "account_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    permission = Column(String(20), default="view", nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    account = relationship("Account", back_populates="permissions")
    user = relationship("User", foreign_keys=[user_id])


class AuditLog(Base):
    """
    Audit log model for tracking sensitive operations.

    Logs actions like member additions/removals, account creations,
    ownership transfers, etc.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
                            nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSON, default={}, nullable=False)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                       nullable=False, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="audit_logs")


class UserActivity(Base):
    """
    User activity tracking model for analytics and monitoring.

    Tracks user interactions like logins, account views, transaction edits, etc.
    """
    __tablename__ = "user_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
                            nullable=True, index=True)
    activity_type = Column(String(50), nullable=False)
    details = Column(JSON, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                       nullable=False, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="activities")


# System Administration Models


class SystemSettings(Base):
    """
    System settings model for configurable application parameters.

    Stores key-value pairs for system-wide configuration.
    Only system administrators can modify these settings.
    """
    __tablename__ = "system_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class SystemLog(Base):
    """
    System log model for centralized logging.

    Separate from audit_logs (which are organization-specific).
    Used for system-level events, errors, and monitoring.

    Levels: INFO, WARNING, ERROR, CRITICAL
    Categories: auth, database, backup, system, admin
    """
    __tablename__ = "system_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level = Column(String(20), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    message = Column(Text, nullable=False)
    details = Column(JSON, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                       nullable=False, index=True)


class BackupMetadata(Base):
    """
    Backup metadata model for tracking database backups.

    Stores information about backups created through the admin panel.
    Actual backup files are stored on disk, this tracks metadata only.
    """
    __tablename__ = "backup_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    backup_file = Column(String(255), nullable=False)
    backup_size = Column(Integer, nullable=True)
    backup_type = Column(String(20), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow,
                       nullable=False, index=True)
    restored_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
