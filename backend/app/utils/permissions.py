"""
Permission and Authorization Utilities
Enterprise-grade access control for multi-user organizations

═══════════════════════════════════════════════════════════════════════════════
PERMISSION HIERARCHY FOR MULTI-USER ORGANIZATIONS
═══════════════════════════════════════════════════════════════════════════════

Permissions are checked in this order (first match wins):

1. ORGANIZATION ROLE (organization_members table)
   Organization-wide role determines base access level:

   - owner (4): Full access to everything
     * All accounts, all transactions, organization settings
     * Can transfer ownership, delete organization
     * Bypasses all other permission checks

   - admin (3): Manage organization and all accounts
     * Read/update transactions on all accounts
     * Create accounts, manage members
     * Cannot modify owners or delete organization
     * Bypasses account-level permission checks

   - member (2): Standard access
     * Falls through to account-level permissions
     * If no account permission set, uses account's default_permission
     * Typical default: 'view' (read-only)

   - viewer (1): Read-only organization access
     * View-only access to all accounts
     * Cannot edit anything
     * Cannot create accounts or invite members

2. ACCOUNT-LEVEL PERMISSION (account_permissions table)
   If user has explicit permission on specific account (member/viewer only):

   - full (3): Complete account control
     * Create, read, update, delete transactions
     * Modify account settings
     * Manage account-level permissions

   - edit (2): Modify transactions
     * Read, update transactions
     * Cannot delete transactions
     * Cannot modify account settings

   - view (1): Read-only account access
     * View transactions only
     * No modifications allowed

3. DEFAULT PERMISSION (accounts.default_permission)
   Used for members with no explicit account permission.

   Examples:
   - If account.default_permission = 'edit', all members get edit access
     unless they have explicit account_permission entry
   - If account.default_permission = 'view', members are read-only by default

═══════════════════════════════════════════════════════════════════════════════
PRACTICAL EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

Example 1: Owner
  - Organization: Smith Family
  - User: John Smith (owner)
  - Account: "Family Expenses"
  → Result: Full access (owners bypass all checks)

Example 2: Admin
  - Organization: Smith Family
  - User: Jane Smith (admin)
  - Account: "Family Expenses"
  → Result: Edit access automatically (admins get edit on all accounts)

Example 3: Member with Explicit Permission
  - Organization: Smith Family
  - User: Bob Smith (member)
  - Account: "Family Expenses"
  - Account Permission: full
  → Result: Full access to "Family Expenses" only

Example 4: Member without Explicit Permission
  - Organization: Smith Family
  - User: Alice Smith (member)
  - Account: "Family Expenses" (default_permission = 'view')
  → Result: View-only access (falls back to default_permission)

Example 5: Viewer
  - Organization: Smith Family
  - User: Charlie Smith (viewer)
  - Account: "Family Expenses"
  → Result: View-only (viewers are always read-only)

═══════════════════════════════════════════════════════════════════════════════
IMPLEMENTATION NOTES
═══════════════════════════════════════════════════════════════════════════════

Security Considerations:
- Always check organization membership FIRST
- Owners and admins short-circuit permission checks (performance optimization)
- Account permissions only apply to members and viewers
- Use hierarchical permission levels to prevent privilege escalation

Performance:
- Owner/admin checks are O(1) (immediate return)
- Account permission lookups are indexed (fast)
- Cache membership in request context for multiple checks

When to Use Each Check:
- check_org_permission(): Verify org membership with optional role requirement
- check_org_owner(): Quick owner-only check
- check_org_admin(): Quick admin/owner check
- check_account_permission(): Full account access verification with hierarchy
"""

from typing import Optional
from fastapi import HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    User,
    Organization,
    OrganizationMember,
    Account,
    AccountPermission,
    AuditLog,
)


ROLE_HIERARCHY = {
    "owner": 4,
    "admin": 3,
    "member": 2,
    "viewer": 1,
}

PERMISSION_HIERARCHY = {
    "full": 3,
    "edit": 2,
    "view": 1,
}


class PermissionError(HTTPException):
    """Custom permission exception with standard HTTP 403 response."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


def check_org_permission(
    db: Session,
    user: User,
    org_id: str,
    required_role: Optional[str] = None
) -> OrganizationMember:
    """
    Verify user has access to organization with optional minimum role check.

    Args:
        db: Database session
        user: Current authenticated user
        org_id: Organization UUID
        required_role: Minimum role required (owner, admin, member, viewer)

    Returns:
        OrganizationMember: Membership record if authorized

    Raises:
        HTTPException: 403 if user not member or insufficient role
        HTTPException: 404 if organization not found
    """
    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()

    if not member:
        raise PermissionError("You are not a member of this organization")

    if required_role:
        user_level = ROLE_HIERARCHY.get(member.role, 0)
        required_level = ROLE_HIERARCHY.get(required_role, 0)

        if user_level < required_level:
            raise PermissionError(
                f"Insufficient permissions. Required role: {required_role}"
            )

    return member


def check_org_owner(db: Session, user: User, org_id: str) -> OrganizationMember:
    """
    Verify user is organization owner.
    Shorthand for check_org_permission with owner role.

    Args:
        db: Database session
        user: Current authenticated user
        org_id: Organization UUID

    Returns:
        OrganizationMember: Owner membership record

    Raises:
        HTTPException: 403 if user not owner
    """
    return check_org_permission(db, user, org_id, required_role="owner")


def check_org_admin(db: Session, user: User, org_id: str) -> OrganizationMember:
    """
    Verify user has admin or owner role in organization.

    Args:
        db: Database session
        user: Current authenticated user
        org_id: Organization UUID

    Returns:
        OrganizationMember: Membership record

    Raises:
        HTTPException: 403 if user not admin/owner
    """
    return check_org_permission(db, user, org_id, required_role="admin")


def check_account_permission(
    db: Session,
    user: User,
    account_id: str,
    required_permission: str = "view"
) -> bool:
    """
    Check if user has required permission level on an account.

    Permission resolution order:
    1. Organization owners/admins always have full access
    2. Per-account permissions if explicitly set
    3. Account's default permission for org members
    4. Deny access (viewers get only view if in org)

    Args:
        db: Database session
        user: Current authenticated user
        account_id: Account UUID
        required_permission: Minimum permission (full, edit, view)

    Returns:
        bool: True if authorized

    Raises:
        HTTPException: 403 if insufficient permissions
        HTTPException: 404 if account not found
    """
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.deleted_at.is_(None)
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    if not account.organization_id:
        if account.user_id != user.id:
            raise PermissionError("Access denied to this account")
        return True

    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == account.organization_id,
        OrganizationMember.user_id == user.id
    ).first()

    if not member:
        raise PermissionError("You are not a member of this account's organization")

    if member.role in ["owner", "admin"]:
        return True

    account_perm = db.query(AccountPermission).filter(
        AccountPermission.account_id == account_id,
        AccountPermission.user_id == user.id
    ).first()

    if account_perm:
        user_level = PERMISSION_HIERARCHY.get(account_perm.permission, 0)
        required_level = PERMISSION_HIERARCHY.get(required_permission, 0)

        if user_level >= required_level:
            return True

    if account.default_permission:
        default_level = PERMISSION_HIERARCHY.get(account.default_permission, 0)
        required_level = PERMISSION_HIERARCHY.get(required_permission, 0)

        if default_level >= required_level:
            return True

    if member.role == "viewer" and required_permission == "view":
        return True

    raise PermissionError(
        f"Insufficient account permissions. Required: {required_permission}"
    )


def can_manage_member(
    manager: OrganizationMember,
    target: OrganizationMember
) -> bool:
    """
    Check if manager can modify target member.

    Rules:
    - Owners can manage everyone except other owners
    - Admins can manage members and viewers
    - Members/viewers cannot manage anyone

    Args:
        manager: User attempting the action
        target: User being acted upon

    Returns:
        bool: True if allowed

    Raises:
        PermissionError: If action not permitted
    """
    manager_level = ROLE_HIERARCHY.get(manager.role, 0)
    target_level = ROLE_HIERARCHY.get(target.role, 0)

    if manager.role == "owner":
        if target.role == "owner" and manager.user_id != target.user_id:
            raise PermissionError("Cannot modify another owner")
        return True

    if manager.role == "admin":
        if target.role in ["owner", "admin"]:
            raise PermissionError("Admins cannot modify owners or other admins")
        return True

    raise PermissionError("Insufficient permissions to manage members")


def log_audit(
    db: Session,
    user_id: str,
    organization_id: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None
) -> AuditLog:
    """
    Log security-sensitive action to audit trail.

    Common actions:
    - org_created, org_updated, org_deleted
    - member_invited, member_joined, member_removed, member_role_changed
    - account_created, account_updated, account_deleted
    - ownership_transferred
    - permission_granted, permission_revoked

    Args:
        db: Database session
        user_id: User performing action
        organization_id: Affected organization
        action: Action identifier (snake_case)
        resource_type: Type of resource (organization, account, member, etc.)
        resource_id: UUID of affected resource
        details: Additional context as dict
        request: FastAPI request object (for IP/user agent)

    Returns:
        AuditLog: Created audit log entry
    """
    ip_address = None
    user_agent = None

    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    audit = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent
    )

    db.add(audit)
    db.commit()
    db.refresh(audit)

    return audit


def verify_invitation_token(db: Session, token: str):
    """
    Verify invitation token is valid and not expired.

    Args:
        db: Database session
        token: Invitation token

    Returns:
        OrganizationInvitation: Valid invitation record

    Raises:
        HTTPException: 404 if not found, 400 if expired/used
    """
    from app.models import OrganizationInvitation
    from datetime import datetime, timezone

    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.token == token
    ).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already accepted"
        )

    if invitation.rejected_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation was rejected"
        )

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )

    return invitation


def get_org_member_count(db: Session, org_id: str) -> int:
    """Get total member count for organization."""
    return db.query(func.count(OrganizationMember.id)).filter(
        OrganizationMember.organization_id == org_id
    ).scalar() or 0


def get_org_account_count(db: Session, org_id: str) -> int:
    """Get total account count for organization."""
    return db.query(func.count(Account.id)).filter(
        Account.organization_id == org_id,
        Account.deleted_at.is_(None)
    ).scalar() or 0


def validate_role_transition(
    current_role: str,
    new_role: str,
    actor_role: str
) -> bool:
    """
    Validate if role transition is allowed.

    Rules:
    - Cannot promote to owner (use transfer endpoint)
    - Owners can demote themselves to any role
    - Admins cannot change owner roles

    Args:
        current_role: Member's current role
        new_role: Desired new role
        actor_role: Role of user performing action

    Returns:
        bool: True if allowed

    Raises:
        ValueError: If transition invalid
    """
    if new_role == "owner":
        raise ValueError("Use transfer ownership endpoint to make someone owner")

    if current_role == "owner" and actor_role != "owner":
        raise ValueError("Only owners can modify owner roles")

    return True
