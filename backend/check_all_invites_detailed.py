#!/usr/bin/env python3
"""Check ALL invitations in the database"""
from app.database import get_db
from app.models import OrganizationInvitation, Organization

def main():
    db = next(get_db())
    try:
        # Find ALL invitations for this email (including accepted/rejected)
        all_invites = db.query(OrganizationInvitation, Organization).join(
            Organization,
            Organization.id == OrganizationInvitation.organization_id
        ).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com'
        ).all()

        if not all_invites:
            print("No invitations found for jhanglaniyash@yahoo.com")
            print("\nChecking if there are ANY invitations in the database...")

            all_invitations_db = db.query(OrganizationInvitation).all()
            print(f"Total invitations in database: {len(all_invitations_db)}")

            if all_invitations_db:
                print("\nAll invitations in database:")
                for inv in all_invitations_db:
                    print(f"  - Email: {inv.email}, ID: {inv.id}, Accepted: {inv.accepted_at}, Rejected: {inv.rejected_at}")
            return

        print(f"Found {len(all_invites)} invitation(s) for jhanglaniyash@yahoo.com:\n")
        for invitation, org in all_invites:
            print(f"Organization: {org.name}")
            print(f"Invitation ID: {invitation.id}")
            print(f"Email: {invitation.email}")
            print(f"Role: {invitation.role}")
            print(f"Created: {invitation.created_at}")
            print(f"Expires: {invitation.expires_at}")
            print(f"Accepted: {invitation.accepted_at}")
            print(f"Rejected: {invitation.rejected_at}")
            print(f"Token: {invitation.token}")
            print(f"Has wrapped_org_key: {invitation.wrapped_org_key is not None}")
            if invitation.wrapped_org_key:
                print(f"Wrapped key preview: {invitation.wrapped_org_key[:50]}...")
            print("-" * 60)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
