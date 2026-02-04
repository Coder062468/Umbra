#!/usr/bin/env python3
"""Cancel pending invitation"""
from app.database import get_db
from app.models import OrganizationInvitation, Organization
from datetime import datetime

def main():
    db = next(get_db())
    try:
        # Find pending invitations
        pending = db.query(OrganizationInvitation, Organization).join(
            Organization,
            Organization.id == OrganizationInvitation.organization_id
        ).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com',
            OrganizationInvitation.accepted_at.is_(None),
            OrganizationInvitation.rejected_at.is_(None),
            OrganizationInvitation.expires_at > datetime.utcnow()
        ).all()

        if not pending:
            print("No pending invitations found for jhanglaniyash@yahoo.com")
            return

        print(f"Found {len(pending)} pending invitation(s):")
        for invitation, org in pending:
            print(f"\nOrganization: {org.name}")
            print(f"Invitation ID: {invitation.id}")
            print(f"Email: {invitation.email}")
            print(f"Role: {invitation.role}")
            print(f"Created: {invitation.created_at}")
            print(f"Expires: {invitation.expires_at}")

            # Delete the invitation
            db.delete(invitation)
            print(f"✓ Deleted invitation {invitation.id}")

        db.commit()
        print("\n✓ All pending invitations cancelled successfully")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
