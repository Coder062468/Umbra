#!/usr/bin/env python3
"""Check all invitations (including accepted/rejected)"""
from app.database import get_db
from app.models import OrganizationInvitation, Organization

def main():
    db = next(get_db())
    try:
        # Find all invitations for this email
        all_invites = db.query(OrganizationInvitation, Organization).join(
            Organization,
            Organization.id == OrganizationInvitation.organization_id
        ).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com'
        ).all()

        if not all_invites:
            print("No invitations found for jhanglaniyash@yahoo.com")
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
            print("-" * 60)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    main()
