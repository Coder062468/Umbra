"""
Organization Management Routes
CRUD operations and member management for multi-user organizations

Security:
- All endpoints require authentication
- Role-based access control enforced
- Audit logging for sensitive operations
- E2EE: wrapped org keys distributed to members
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime
from uuid import UUID

from app.database import get_db
from app.models import (
    User,
    Organization,
    OrganizationMember,
    Account,
    AuditLog,
)
from app.dependencies import get_current_user
from app.schemas import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListItem,
    OrganizationMemberResponse,
    MemberRoleUpdate,
    TransferOwnership,
    AuditLogResponse,
    AuditLogList,
    RoleEnum,
    KeyRotationRequest,
    KeyRotationResponse,
)
from app.utils.permissions import (
    check_org_permission,
    check_org_owner,
    check_org_admin,
    can_manage_member,
    log_audit,
    get_org_member_count,
    get_org_account_count,
    validate_role_transition,
)


router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new organization.
    Creator automatically becomes owner.

    Request body:
    - name: Organization display name
    - description: Optional description
    - wrapped_org_key: Org master key encrypted with creator's master key
    """
    new_org = Organization(
        name=org_data.name,
        description=org_data.description,
        created_by=current_user.id,
        settings={}
    )

    db.add(new_org)
    db.flush()

    creator_member = OrganizationMember(
        organization_id=new_org.id,
        user_id=current_user.id,
        role="owner",
        wrapped_org_key=org_data.wrapped_org_key,
        invited_by=current_user.id,
    )

    db.add(creator_member)
    db.commit()
    db.refresh(new_org)

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(new_org.id),
        action="org_created",
        resource_type="organization",
        resource_id=str(new_org.id),
        details={"name": new_org.name},
        request=request
    )

    return OrganizationResponse(
        id=new_org.id,
        name=new_org.name,
        description=new_org.description,
        role=RoleEnum.OWNER,
        member_count=1,
        account_count=0,
        created_at=new_org.created_at,
        updated_at=new_org.updated_at,
        wrapped_org_key=org_data.wrapped_org_key
    )


@router.get("", response_model=List[OrganizationListItem])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all organizations user is a member of.
    Returns lightweight organization list for UI.
    """
    memberships = db.query(
        Organization,
        OrganizationMember
    ).join(
        OrganizationMember,
        OrganizationMember.organization_id == Organization.id
    ).filter(
        OrganizationMember.user_id == current_user.id,
        Organization.deleted_at.is_(None)
    ).all()

    result = []
    for org, member in memberships:
        member_count = get_org_member_count(db, str(org.id))
        account_count = get_org_account_count(db, str(org.id))

        result.append(OrganizationListItem(
            id=org.id,
            name=org.name,
            role=RoleEnum(member.role),
            member_count=member_count,
            account_count=account_count,
            created_at=org.created_at,
            wrapped_org_key=member.wrapped_org_key  # E2EE: Include wrapped org key
        ))

    return result


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed organization information.
    Includes member's wrapped org key for E2EE.
    """
    member = check_org_permission(db, current_user, str(org_id))

    org = db.query(Organization).filter(
        Organization.id == org_id
    ).first()

    member_count = get_org_member_count(db, str(org_id))
    account_count = get_org_account_count(db, str(org_id))

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        role=RoleEnum(member.role),
        member_count=member_count,
        account_count=account_count,
        created_at=org.created_at,
        updated_at=org.updated_at,
        wrapped_org_key=member.wrapped_org_key
    )


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    org_data: OrganizationUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update organization details.
    Requires admin or owner role.
    """
    member = check_org_admin(db, current_user, str(org_id))

    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    changes = {}
    if org_data.name is not None:
        changes["name_old"] = org.name
        changes["name_new"] = org_data.name
        org.name = org_data.name

    if org_data.description is not None:
        org.description = org_data.description

    if org_data.settings is not None:
        org.settings = org_data.settings

    org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(org)

    if changes:
        log_audit(
            db=db,
            user_id=str(current_user.id),
            organization_id=str(org.id),
            action="org_updated",
            resource_type="organization",
            resource_id=str(org.id),
            details=changes,
            request=request
        )

    member_count = get_org_member_count(db, str(org_id))
    account_count = get_org_account_count(db, str(org_id))

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        role=RoleEnum(member.role),
        member_count=member_count,
        account_count=account_count,
        created_at=org.created_at,
        updated_at=org.updated_at,
        wrapped_org_key=member.wrapped_org_key
    )


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete organization (soft delete).
    Only owners can delete organizations.

    WARNING: This will cascade soft-delete all accounts and data.
    """
    check_org_owner(db, current_user, str(org_id))

    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    org.deleted_at = datetime.utcnow()

    accounts = db.query(Account).filter(
        Account.organization_id == org_id,
        Account.deleted_at.is_(None)
    ).all()

    for account in accounts:
        account.deleted_at = datetime.utcnow()
        account.deleted_by = current_user.id

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org.id),
        action="org_deleted",
        resource_type="organization",
        resource_id=str(org.id),
        details={"name": org.name, "accounts_deleted": len(accounts)},
        request=request
    )

    db.commit()
    return None


@router.get("/{org_id}/accounts")
async def list_organization_accounts(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all accounts in this organization.
    Returns encrypted account data that members can decrypt client-side.

    Any member can view organization accounts.
    """
    from app.schemas import AccountResponse

    check_org_permission(db, current_user, str(org_id))

    accounts = db.query(Account).filter(
        Account.organization_id == org_id,
        Account.deleted_at.is_(None)
    ).order_by(
        Account.created_at.desc()
    ).all()

    return [AccountResponse.from_orm(account) for account in accounts]


@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def list_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all organization members with their roles.
    Any member can view the member list.
    """
    check_org_permission(db, current_user, str(org_id))

    members = db.query(
        OrganizationMember,
        User
    ).join(
        User,
        User.id == OrganizationMember.user_id
    ).filter(
        OrganizationMember.organization_id == org_id
    ).order_by(
        OrganizationMember.joined_at.desc()
    ).all()

    result = []
    for member, user in members:
        result.append(OrganizationMemberResponse(
            id=member.id,
            user_id=user.id,
            email=user.email,
            role=RoleEnum(member.role),
            joined_at=member.joined_at
        ))

    return result


@router.put("/{org_id}/members/{user_id}", response_model=OrganizationMemberResponse)
async def update_member_role(
    org_id: UUID,
    user_id: UUID,
    role_data: MemberRoleUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update member's role.
    Owners can change any role except other owners.
    Admins can change members and viewers.
    """
    manager = check_org_admin(db, current_user, str(org_id))

    target = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    can_manage_member(manager, target)
    validate_role_transition(target.role, role_data.role.value, manager.role)

    old_role = target.role
    target.role = role_data.role.value
    db.commit()
    db.refresh(target)

    user = db.query(User).filter(User.id == user_id).first()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org_id),
        action="member_role_changed",
        resource_type="organization_member",
        resource_id=str(target.id),
        details={
            "target_user": user.email,
            "old_role": old_role,
            "new_role": role_data.role.value
        },
        request=request
    )

    return OrganizationMemberResponse(
        id=target.id,
        user_id=user.id,
        email=user.email,
        role=RoleEnum(target.role),
        joined_at=target.joined_at
    )


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: UUID,
    user_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove member from organization.
    Owners can remove anyone except themselves (use transfer ownership first).
    Admins can remove members and viewers.
    """
    manager = check_org_admin(db, current_user, str(org_id))

    target = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove owner. Transfer ownership first."
        )

    can_manage_member(manager, target)

    user = db.query(User).filter(User.id == user_id).first()

    db.delete(target)
    db.commit()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org_id),
        action="member_removed",
        resource_type="organization_member",
        details={
            "removed_user": user.email,
            "removed_role": target.role
        },
        request=request
    )

    return None


@router.post("/{org_id}/transfer-ownership", response_model=OrganizationMemberResponse)
async def transfer_ownership(
    org_id: UUID,
    transfer_data: TransferOwnership,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transfer organization ownership to another member.
    Only current owner can initiate transfer.
    Current owner becomes admin after transfer.
    """
    current_owner = check_org_owner(db, current_user, str(org_id))

    new_owner = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == transfer_data.new_owner_id
    ).first()

    if not new_owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="New owner must be an existing member"
        )

    if new_owner.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already the owner"
        )

    current_owner.role = "admin"
    new_owner.role = "owner"

    db.commit()
    db.refresh(new_owner)

    new_owner_user = db.query(User).filter(User.id == transfer_data.new_owner_id).first()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org_id),
        action="ownership_transferred",
        resource_type="organization",
        resource_id=str(org_id),
        details={
            "previous_owner": current_user.email,
            "new_owner": new_owner_user.email
        },
        request=request
    )

    return OrganizationMemberResponse(
        id=new_owner.id,
        user_id=new_owner_user.id,
        email=new_owner_user.email,
        role=RoleEnum.OWNER,
        joined_at=new_owner.joined_at
    )


@router.get("/{org_id}/audit-logs", response_model=AuditLogList)
async def get_audit_logs(
    org_id: UUID,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get organization audit logs.
    Owners and admins can view audit logs.
    Paginated for performance.
    """
    check_org_admin(db, current_user, str(org_id))

    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 50

    total = db.query(func.count(AuditLog.id)).filter(
        AuditLog.organization_id == org_id
    ).scalar() or 0

    logs = db.query(AuditLog, User).outerjoin(
        User,
        User.id == AuditLog.user_id
    ).filter(
        AuditLog.organization_id == org_id
    ).order_by(
        AuditLog.created_at.desc()
    ).limit(page_size).offset((page - 1) * page_size).all()

    result = []
    for log, user in logs:
        result.append(AuditLogResponse(
            id=log.id,
            user_email=user.email if user else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at
        ))

    return AuditLogList(
        logs=result,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{org_id}/activity")
async def get_organization_activity(
    org_id: UUID,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user activity in organization.
    All members can view activity.
    Paginated for performance.
    """
    check_org_permission(db, current_user, str(org_id))

    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 50

    total = db.query(func.count(UserActivity.id)).filter(
        UserActivity.organization_id == org_id
    ).scalar() or 0

    activities = db.query(UserActivity, User).join(
        User,
        User.id == UserActivity.user_id
    ).filter(
        UserActivity.organization_id == org_id
    ).order_by(
        UserActivity.created_at.desc()
    ).limit(page_size).offset((page - 1) * page_size).all()

    result = []
    for activity, user in activities:
        result.append({
            "id": activity.id,
            "user_email": user.email,
            "activity_type": activity.activity_type,
            "details": activity.details,
            "created_at": activity.created_at
        })

    return {
        "activities": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/{org_id}/activity", status_code=status.HTTP_201_CREATED)
async def log_user_activity(
    org_id: UUID,
    activity_type: str,
    details: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log user activity in organization.
    All members can log their own activity.
    """
    check_org_permission(db, current_user, str(org_id))

    activity = UserActivity(
        user_id=current_user.id,
        organization_id=org_id,
        activity_type=activity_type,
        details=details or {}
    )

    db.add(activity)
    db.commit()

    return {"status": "logged"}


@router.post("/{org_id}/rotate-keys", response_model=KeyRotationResponse)
async def rotate_organization_keys(
    org_id: UUID,
    rotation_data: KeyRotationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rotate organization master key and re-encrypt all account DEKs.

    Security: Only organization owners can rotate keys.

    This operation:
    1. Validates that user is organization owner
    2. Updates all member wrapped_org_key fields with new keys
    3. Updates all account encrypted_dek fields with new DEKs
    4. Performs all updates in a single atomic transaction
    5. Logs the rotation event to audit trail

    Use Case:
    - After removing a member to permanently revoke their access
    - Periodically for enhanced security (e.g., annually)
    - After suspected key compromise

    Note: This is an expensive operation for organizations with many accounts.
    For a family expense tracker (10 users, <100 accounts), takes ~30 seconds.
    """
    check_org_owner(db, current_user, str(org_id))

    org = db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None)
    ).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    try:
        accounts_updated = 0
        members_updated = 0

        for member_key_data in rotation_data.member_keys:
            member = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == member_key_data.user_id
            ).first()

            if member:
                member.wrapped_org_key = member_key_data.wrapped_org_key
                members_updated += 1

        for account_id_str, new_wrapped_dek in rotation_data.account_deks.items():
            account = db.query(Account).filter(
                Account.id == account_id_str,
                Account.organization_id == org_id,
                Account.deleted_at.is_(None)
            ).first()

            if account:
                account.encrypted_dek = new_wrapped_dek
                accounts_updated += 1

        db.commit()

        log_audit(
            db=db,
            user_id=str(current_user.id),
            organization_id=str(org_id),
            action="keys_rotated",
            resource_type="organization",
            resource_id=str(org_id),
            details={
                "accounts_updated": accounts_updated,
                "members_updated": members_updated
            },
            request=request
        )

        return KeyRotationResponse(
            status="success",
            accounts_updated=accounts_updated,
            members_updated=members_updated,
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Key rotation failed: {str(e)}"
        )
