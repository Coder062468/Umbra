#!/usr/bin/env python3
"""Delete accepted invitation (and optionally the membership)"""
from app.database import get_db
from app.models import OrganizationInvitation, OrganizationMember

def main():
    db = next(get_db())
    try:
        # Find the accepted invitation
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com',
            OrganizationInvitation.id == 'e8764702-77e4-4183-b785-816c21b52112'
        ).first()

        if not invitation:
            print("Invitation not found")
            return

        print(f"Found accepted invitation:")
        print(f"  Organization ID: {invitation.organization_id}")
        print(f"  Email: {invitation.email}")
        print(f"  Accepted at: {invitation.accepted_at}")

        # Check for membership
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == invitation.organization_id,
            OrganizationMember.user_id == db.query(OrganizationMember.user_id).join(
                OrganizationMember.user
            ).filter(
                OrganizationMember.organization_id == invitation.organization_id
            ).filter(
                OrganizationMember.user.has(email='jhanglaniyash@yahoo.com')
            ).scalar_subquery()
        ).first()

        if membership:
            print(f"\nFound membership record:")
            print(f"  Member ID: {membership.id}")
            print(f"  User ID: {membership.user_id}")
            print(f"  Role: {membership.role}")

            # Delete membership
            db.delete(membership)
            print(f"[OK] Deleted membership")

        # Delete invitation
        db.delete(invitation)
        print(f"[OK] Deleted invitation")

        db.commit()
        print("\n[OK] Successfully deleted invitation and membership (if exists)")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
