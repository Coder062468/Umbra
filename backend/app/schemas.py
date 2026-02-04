"""
Pydantic Schemas
Request/Response models for API validation

E2E note: Server cannot validate encrypted field contents (amount, person, narration).
All data validation for those fields must happen CLIENT-SIDE before encryption.
Server validates only structural properties: encrypted_data is a non-empty string,
date is valid, encryption_version is present.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from enum import Enum


# ════════════════════════════════════════════════════════════
# User Schemas
# ════════════════════════════════════════════════════════════

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    """Registration payload.
    salt: base64-encoded 16-byte random value generated client-side.
          Used for PBKDF2 master-key derivation. Server stores it verbatim.
    wrapped_org_key: base64-encoded organization master key wrapped with user's master key.
                     Auto-creates default organization on registration.
    public_key: base64-encoded RSA public key for invitation key wrapping (optional for backwards compatibility).
    """
    password: str = Field(..., min_length=8, max_length=100)
    salt: str = Field(..., min_length=1, description="Base64-encoded 16-byte PBKDF2 salt")
    wrapped_org_key: str = Field(..., min_length=1, description="Wrapped organization key for default org")
    public_key: Optional[str] = Field(None, description="RSA public key for E2EE invitation key wrapping")


class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════════════
# Token Schemas
# ════════════════════════════════════════════════════════════

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    salt: Optional[str] = None   # Returned on login so client can derive master key


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ════════════════════════════════════════════════════════════
# Account Schemas (E2E Encrypted)
# ════════════════════════════════════════════════════════════

class AccountCreate(BaseModel):
    """
    Create an account.
    encrypted_data: base64 AES-GCM blob → { name, opening_balance }
    encrypted_dek:  base64 AES-GCM blob → the account's DEK wrapped with master key or org key
    organization_id: optional UUID for organization accounts
    """
    encrypted_data: str = Field(..., min_length=1)
    encrypted_dek: str = Field(..., min_length=1)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    encryption_version: int = Field(default=1)
    organization_id: Optional[UUID] = Field(default=None)


class AccountUpdate(BaseModel):
    """Update account encrypted payload (e.g. rename, change opening balance)."""
    encrypted_data: Optional[str] = Field(None, min_length=1)
    organization_id: Optional[UUID] = None  # For account migration
    wrapped_dek: Optional[str] = None       # Re-encrypted DEK for migration
    migrated: Optional[bool] = None         # Migration flag


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    organization_id: Optional[UUID] = None
    encrypted_data: Optional[str] = None
    encrypted_dek: Optional[str] = None
    currency: str
    encryption_version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountSummary(BaseModel):
    """
    Summary statistics for an account.
    Note: Since transactions are E2EE, server returns placeholder/zero values.
    Real calculations happen client-side after decryption.
    """
    total_credit: float
    total_debit: float
    net_balance: float
    transaction_count: int


# ════════════════════════════════════════════════════════════
# Transaction Schemas (E2E Encrypted)
# ════════════════════════════════════════════════════════════

class TransactionCreate(BaseModel):
    """
    Create a transaction.
    encrypted_data: base64 AES-GCM blob → { amount, paid_to_from, narration }
    date: kept plaintext for server-side chronological ordering.
    """
    account_id: UUID
    date: date
    encrypted_data: str = Field(..., min_length=1)
    encryption_version: int = Field(default=1)


class TransactionUpdate(BaseModel):
    """
    Update a transaction.
    Client re-encrypts the full payload with any changes and sends it.
    """
    date: Optional[date] = None
    encrypted_data: Optional[str] = Field(None, min_length=1)


class TransactionResponse(BaseModel):
    id: UUID
    account_id: UUID
    date: date
    encrypted_data: Optional[str] = None
    encryption_version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionList(BaseModel):
    """Full transaction list for an account (no server-side pagination in E2E)."""
    transactions: List[TransactionResponse]
    total: int


# ════════════════════════════════════════════════════════════
# Organization Schemas
# ════════════════════════════════════════════════════════════

class RoleEnum(str, Enum):
    """Organization member roles with hierarchical permissions."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class PermissionEnum(str, Enum):
    """Per-account permission levels."""
    FULL = "full"
    EDIT = "edit"
    VIEW = "view"


class OrganizationCreate(BaseModel):
    """
    Create a new organization.
    name: Organization display name
    wrapped_org_key: Organization master key encrypted with creator's master key
    """
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    wrapped_org_key: str = Field(..., min_length=1, description="Org key wrapped with user's master key")

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Organization name cannot be empty or whitespace')
        return v.strip()


class OrganizationUpdate(BaseModel):
    """Update organization details."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    settings: Optional[dict] = None

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Organization name cannot be empty or whitespace')
        return v.strip() if v else None


class OrganizationMemberResponse(BaseModel):
    """Organization member details."""
    id: UUID
    user_id: UUID
    email: str
    role: RoleEnum
    joined_at: datetime

    class Config:
        from_attributes = True


class OrganizationResponse(BaseModel):
    """
    Organization details returned to member.
    Includes the member's wrapped org key for E2EE.
    """
    id: UUID
    name: str
    description: Optional[str] = None
    role: RoleEnum
    member_count: int
    account_count: int
    created_at: datetime
    updated_at: datetime
    wrapped_org_key: str

    class Config:
        from_attributes = True


class OrganizationListItem(BaseModel):
    """Lightweight organization item for list views."""
    id: UUID
    name: str
    role: RoleEnum
    member_count: int
    account_count: int
    created_at: datetime
    wrapped_org_key: Optional[str] = None  # E2EE: User's wrapped copy of org master key

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════════════
# Invitation Schemas
# ════════════════════════════════════════════════════════════

class InvitationCreate(BaseModel):
    """
    Create an invitation to join organization.
    email: Invitee email address
    role: Role to assign (owner can only be transferred, not invited as)
    wrapped_org_key: Org key pre-encrypted for invitee
    """
    email: EmailStr
    role: RoleEnum
    wrapped_org_key: str = Field(..., min_length=1)
    message: Optional[str] = Field(None, max_length=500)

    @field_validator('role')
    @classmethod
    def role_not_owner(cls, v: RoleEnum) -> RoleEnum:
        if v == RoleEnum.OWNER:
            raise ValueError('Cannot invite as owner. Use transfer ownership instead.')
        return v


class InvitationResponse(BaseModel):
    """Invitation details."""
    id: UUID
    organization_id: UUID
    organization_name: str
    email: str
    role: RoleEnum
    invited_by_email: str
    message: Optional[str] = None
    token: str
    wrapped_org_key: str  # RSA-encrypted org key for E2EE
    expires_at: datetime
    created_at: datetime
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvitationAccept(BaseModel):
    """
    Accept invitation payload.
    wrapped_org_key: Organization key re-wrapped with user's master key (PBKDF2-derived)
                     Frontend decrypts RSA-encrypted key from invitation and re-wraps with master key
    """
    wrapped_org_key: str = Field(..., min_length=1, description="Org key wrapped with user's master key")


class InvitationReject(BaseModel):
    """Reject invitation payload (if needed for future extensions)."""
    pass


# ════════════════════════════════════════════════════════════
# Member Management Schemas
# ════════════════════════════════════════════════════════════

class MemberRoleUpdate(BaseModel):
    """Update member's role."""
    role: RoleEnum

    @field_validator('role')
    @classmethod
    def role_not_owner(cls, v: RoleEnum) -> RoleEnum:
        if v == RoleEnum.OWNER:
            raise ValueError('Use transfer ownership endpoint to make someone owner.')
        return v


class TransferOwnership(BaseModel):
    """Transfer organization ownership to another member."""
    new_owner_id: UUID


# ════════════════════════════════════════════════════════════
# Account Permission Schemas
# ════════════════════════════════════════════════════════════

class AccountPermissionCreate(BaseModel):
    """Grant user-specific permission on an account."""
    user_id: UUID
    permission: PermissionEnum


class AccountPermissionUpdate(BaseModel):
    """Update user's permission on an account."""
    permission: PermissionEnum


class AccountPermissionResponse(BaseModel):
    """Account permission details."""
    id: UUID
    account_id: UUID
    user_id: UUID
    email: str
    permission: PermissionEnum
    granted_by: Optional[UUID] = None
    granted_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════════════
# Audit Log Schemas
# ════════════════════════════════════════════════════════════

class AuditLogResponse(BaseModel):
    """Audit log entry."""
    id: UUID
    user_email: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    details: dict
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogList(BaseModel):
    """Paginated audit log list."""
    logs: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


# ════════════════════════════════════════════════════════════
# Activity Schemas
# ════════════════════════════════════════════════════════════

class UserActivityResponse(BaseModel):
    """User activity entry."""
    id: UUID
    user_email: str
    activity_type: str
    details: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityList(BaseModel):
    """Paginated activity list."""
    activities: List[UserActivityResponse]
    total: int
    page: int
    page_size: int


# ════════════════════════════════════════════════════════════
# Key Rotation Schemas
# ════════════════════════════════════════════════════════════

class MemberKeyRotation(BaseModel):
    """Wrapped organization key for a specific member during rotation."""
    user_id: UUID
    wrapped_org_key: str


class KeyRotationRequest(BaseModel):
    """Request to rotate organization keys."""
    member_keys: List[MemberKeyRotation]
    account_deks: dict  # account_id -> new_wrapped_dek


class KeyRotationResponse(BaseModel):
    """Response after successful key rotation."""
    status: str
    accounts_updated: int
    members_updated: int
    timestamp: datetime


# ════════════════════════════════════════════════════════════
# System Administration Schemas
# ════════════════════════════════════════════════════════════

class SystemStatsResponse(BaseModel):
    """System-wide statistics for admin dashboard."""
    total_users: int
    total_organizations: int
    total_accounts: int
    total_transactions: int
    active_users_today: int
    active_users_week: int
    active_users_month: int
    database_size_mb: float
    avg_transactions_per_user: float
    avg_accounts_per_org: float


class UserStatsResponse(BaseModel):
    """User statistics for admin user management."""
    id: UUID
    email: str
    is_system_admin: bool
    organization_count: int
    account_count: int
    transaction_count: int
    last_login_at: Optional[datetime]
    login_count: int
    created_at: datetime


class OrganizationStatsResponse(BaseModel):
    """Organization statistics for admin organization management."""
    id: UUID
    name: str
    member_count: int
    account_count: int
    transaction_count: int
    storage_used_mb: float
    created_at: datetime
    last_activity: Optional[datetime]


class SystemLogResponse(BaseModel):
    """System log entry for admin logs viewer."""
    id: UUID
    level: str
    category: str
    message: str
    details: dict
    created_at: datetime

    class Config:
        from_attributes = True


class SystemLogListResponse(BaseModel):
    """Paginated list of system logs."""
    logs: List[SystemLogResponse]
    total: int
    page: int
    page_size: int


class SystemSettingResponse(BaseModel):
    """System setting for admin configuration."""
    id: UUID
    key: str
    value: Optional[str]
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    """Request to update a system setting."""
    value: str
    description: Optional[str] = None


class BackupMetadataResponse(BaseModel):
    """Backup metadata for admin backup management."""
    id: UUID
    backup_file: str
    backup_size: Optional[int]
    backup_type: Optional[str]
    created_at: datetime
    restored_at: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True


class BackupCreateResponse(BaseModel):
    """Response after creating a backup."""
    backup_file: str
    backup_size: int
    status: str
    message: str


# ════════════════════════════════════════════════════════════
# Account Backup Schemas
# ════════════════════════════════════════════════════════════

class AccountBackupCreate(BaseModel):
    """Request to create an account backup."""
    notes: Optional[str] = Field(None, max_length=500, description="Optional notes about the backup")


class AccountBackupResponse(BaseModel):
    """Response after creating an account backup."""
    filename: str = Field(..., description="Backup filename")
    size_bytes: int = Field(..., description="Size of backup in bytes")
    transaction_count: int = Field(..., description="Number of transactions in backup")
    backup_data: str = Field(..., description="JSON backup data")
    created_at: datetime = Field(..., description="Backup creation timestamp")


class RestoreMode(str, Enum):
    """Restore mode options."""
    REPLACE = "replace"
    MERGE = "merge"
    NEW_ACCOUNT = "new_account"


class AccountBackupRestore(BaseModel):
    """Request to restore an account from backup."""
    mode: RestoreMode = Field(..., description="How to restore: replace, merge, or new_account")


class AccountBackupRestoreResponse(BaseModel):
    """Response after restoring an account backup."""
    status: str = Field(..., description="Restore status")
    mode: str = Field(..., description="Restore mode used")
    restored_transactions: int = Field(..., description="Number of transactions restored")
    new_account_id: Optional[UUID] = Field(None, description="ID of new account if mode=new_account")
    backup_info: dict = Field(..., description="Information about the backup")


# ════════════════════════════════════════════════════════════
# Error Schemas
# ════════════════════════════════════════════════════════════

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
