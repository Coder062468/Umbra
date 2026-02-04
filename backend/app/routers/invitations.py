"""
Organization Invitation Management Routes
Handle invitation lifecycle: create, accept, reject, cancel

Security:
- All endpoints require authentication
- Only admins/owners can create invitations
- Invitation tokens are secure and time-limited
- Audit logging for all actions
- E2EE: wrapped org keys distributed via invitation
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import UUID
import secrets

from app.database import get_db
from app.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationInvitation,
    AuditLog,
)
from app.dependencies import get_current_user
from app.schemas import (
    InvitationCreate,
    InvitationResponse,
    InvitationAccept,
    InvitationReject,
    RoleEnum,
)
from app.utils.permissions import (
    check_org_admin,
    check_org_permission,
    log_audit,
    verify_invitation_token,
)
from app.utils.email import send_invitation_email


router = APIRouter(prefix="/api", tags=["Invitations"])


@router.post("/organizations/{org_id}/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    org_id: UUID,
    invitation_data: InvitationCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create invitation to join organization.
    Only admins and owners can invite members.

    Request body:
    - email: Invitee email address
    - role: Role to assign (admin, member, viewer - not owner)
    - wrapped_org_key: Organization key encrypted for invitee
    - message: Optional personal message
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

    existing_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == db.query(User.id).filter(User.email == invitation_data.email).scalar_subquery()
    ).first()

    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization"
        )

    existing_invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.organization_id == org_id,
        OrganizationInvitation.email == invitation_data.email,
        OrganizationInvitation.accepted_at.is_(None),
        OrganizationInvitation.rejected_at.is_(None),
        OrganizationInvitation.expires_at > datetime.utcnow()
    ).first()

    if existing_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active invitation already exists for this email"
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)

    new_invitation = OrganizationInvitation(
        organization_id=org_id,
        email=invitation_data.email,
        role=invitation_data.role.value,
        wrapped_org_key=invitation_data.wrapped_org_key,
        invited_by=current_user.id,
        token=token,
        message=invitation_data.message,
        expires_at=expires_at
    )

    db.add(new_invitation)
    db.commit()
    db.refresh(new_invitation)

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org_id),
        action="member_invited",
        resource_type="organization_invitation",
        resource_id=str(new_invitation.id),
        details={
            "invitee_email": invitation_data.email,
            "role": invitation_data.role.value
        },
        request=request
    )

    send_invitation_email(
        to_email=invitation_data.email,
        inviter_name=current_user.email,
        organization_name=org.name,
        role=invitation_data.role.value,
        token=token,
        message=invitation_data.message,
        expires_at=expires_at
    )

    return InvitationResponse(
        id=new_invitation.id,
        organization_id=org_id,
        organization_name=org.name,
        email=new_invitation.email,
        role=RoleEnum(new_invitation.role),
        invited_by_email=current_user.email,
        message=new_invitation.message,
        token=token,
        wrapped_org_key=new_invitation.wrapped_org_key,
        expires_at=expires_at,
        created_at=new_invitation.created_at,
        accepted_at=None,
        rejected_at=None
    )


@router.get("/invitations", response_model=List[InvitationResponse])
async def list_my_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all pending invitations for current user's email.
    Only shows active (non-expired, not accepted/rejected) invitations.
    """
    invitations = db.query(
        OrganizationInvitation,
        Organization,
        User
    ).join(
        Organization,
        Organization.id == OrganizationInvitation.organization_id
    ).join(
        User,
        User.id == OrganizationInvitation.invited_by
    ).filter(
        OrganizationInvitation.email == current_user.email,
        OrganizationInvitation.accepted_at.is_(None),
        OrganizationInvitation.rejected_at.is_(None),
        OrganizationInvitation.expires_at > datetime.utcnow()
    ).order_by(
        OrganizationInvitation.created_at.desc()
    ).all()

    result = []
    for invitation, org, inviter in invitations:
        print(f"[DEBUG] Invitation {invitation.id}: wrapped_org_key = {invitation.wrapped_org_key[:50] if invitation.wrapped_org_key else 'None'}...")
        result.append(InvitationResponse(
            id=invitation.id,
            organization_id=org.id,
            organization_name=org.name,
            email=invitation.email,
            role=RoleEnum(invitation.role),
            invited_by_email=inviter.email,
            message=invitation.message,
            token=invitation.token,
            wrapped_org_key=invitation.wrapped_org_key,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
            rejected_at=invitation.rejected_at
        ))

    print(f"[DEBUG] Returning {len(result)} invitations")
    return result


@router.get("/invitations/{token}", response_model=InvitationResponse)
async def get_invitation_by_token(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get invitation details by token.
    User must be authenticated and email must match invitation.
    """
    invitation = verify_invitation_token(db, token)

    if invitation.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is for a different email address"
        )

    org = db.query(Organization).filter(
        Organization.id == invitation.organization_id
    ).first()

    inviter = db.query(User).filter(
        User.id == invitation.invited_by
    ).first()

    return InvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        organization_name=org.name,
        email=invitation.email,
        role=RoleEnum(invitation.role),
        invited_by_email=inviter.email,
        message=invitation.message,
        token=invitation.token,
        wrapped_org_key=invitation.wrapped_org_key,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        accepted_at=invitation.accepted_at,
        rejected_at=invitation.rejected_at
    )


@router.post("/invitations/{token}/accept", response_model=InvitationResponse)
async def accept_invitation(
    token: str,
    accept_data: InvitationAccept,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept invitation and join organization.
    Creates OrganizationMember record with wrapped org key from request body.

    E2EE Flow:
    1. Invitation contains org key encrypted with RSA public key
    2. Frontend decrypts with RSA private key
    3. Frontend re-wraps with user's master key (PBKDF2-derived)
    4. Frontend sends re-wrapped key in accept_data.wrapped_org_key
    5. Backend stores re-wrapped key in organization_members table
    """
    invitation = verify_invitation_token(db, token)

    if invitation.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is for a different email address"
        )

    existing_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == invitation.organization_id,
        OrganizationMember.user_id == current_user.id
    ).first()

    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this organization"
        )

    new_member = OrganizationMember(
        organization_id=invitation.organization_id,
        user_id=current_user.id,
        role=invitation.role,
        wrapped_org_key=accept_data.wrapped_org_key,  # Use re-wrapped key from request
        invited_by=invitation.invited_by,
        invited_at=invitation.created_at,
        joined_at=datetime.utcnow()
    )

    db.add(new_member)

    invitation.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(invitation)

    org = db.query(Organization).filter(
        Organization.id == invitation.organization_id
    ).first()

    inviter = db.query(User).filter(
        User.id == invitation.invited_by
    ).first()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(invitation.organization_id),
        action="member_joined",
        resource_type="organization_member",
        resource_id=str(new_member.id),
        details={
            "email": current_user.email,
            "role": invitation.role
        },
        request=request
    )

    return InvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        organization_name=org.name,
        email=invitation.email,
        role=RoleEnum(invitation.role),
        invited_by_email=inviter.email,
        message=invitation.message,
        token=invitation.token,
        wrapped_org_key=invitation.wrapped_org_key,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        accepted_at=invitation.accepted_at,
        rejected_at=invitation.rejected_at
    )


@router.post("/invitations/{token}/reject", response_model=InvitationResponse)
async def reject_invitation(
    token: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject invitation.
    Marks invitation as rejected without creating membership.
    """
    invitation = verify_invitation_token(db, token)

    if invitation.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is for a different email address"
        )

    invitation.rejected_at = datetime.utcnow()
    db.commit()
    db.refresh(invitation)

    org = db.query(Organization).filter(
        Organization.id == invitation.organization_id
    ).first()

    inviter = db.query(User).filter(
        User.id == invitation.invited_by
    ).first()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(invitation.organization_id),
        action="invitation_rejected",
        resource_type="organization_invitation",
        resource_id=str(invitation.id),
        details={
            "email": current_user.email,
            "role": invitation.role
        },
        request=request
    )

    return InvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        organization_name=org.name,
        email=invitation.email,
        role=RoleEnum(invitation.role),
        invited_by_email=inviter.email,
        message=invitation.message,
        token=invitation.token,
        wrapped_org_key=invitation.wrapped_org_key,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        accepted_at=invitation.accepted_at,
        rejected_at=invitation.rejected_at
    )


@router.delete("/organizations/{org_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    org_id: UUID,
    invitation_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel pending invitation.
    Only admins and owners can cancel invitations.
    """
    member = check_org_admin(db, current_user, str(org_id))

    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.id == invitation_id,
        OrganizationInvitation.organization_id == org_id
    ).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel accepted invitation"
        )

    invitee_email = invitation.email

    db.delete(invitation)
    db.commit()

    log_audit(
        db=db,
        user_id=str(current_user.id),
        organization_id=str(org_id),
        action="invitation_cancelled",
        resource_type="organization_invitation",
        details={
            "invitee_email": invitee_email,
            "role": invitation.role
        },
        request=request
    )

    return None


@router.get("/organizations/{org_id}/invitations", response_model=List[InvitationResponse])
async def list_organization_invitations(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all invitations for an organization.
    Shows pending, accepted, and rejected invitations.
    Only admins and owners can view organization invitations.
    """
    member = check_org_admin(db, current_user, str(org_id))

    invitations = db.query(
        OrganizationInvitation,
        User
    ).join(
        User,
        User.id == OrganizationInvitation.invited_by
    ).filter(
        OrganizationInvitation.organization_id == org_id
    ).order_by(
        OrganizationInvitation.created_at.desc()
    ).all()

    org = db.query(Organization).filter(
        Organization.id == org_id
    ).first()

    result = []
    for invitation, inviter in invitations:
        result.append(InvitationResponse(
            id=invitation.id,
            organization_id=org_id,
            organization_name=org.name,
            email=invitation.email,
            role=RoleEnum(invitation.role),
            invited_by_email=inviter.email,
            message=invitation.message,
            token=invitation.token,
            wrapped_org_key=invitation.wrapped_org_key,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
            rejected_at=invitation.rejected_at
        ))

    return result
