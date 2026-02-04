#!/usr/bin/env python3
"""Check all invitations for a user"""
from app.database import get_db
from app.models import OrganizationInvitation

def main():
    db = next(get_db())
    try:
        all_invites = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com'
        ).all()

        print(f"Found {len(all_invites)} total invitation(s) for jhanglaniyash@yahoo.com:")
        for inv in all_invites:
            status = "PENDING"
            if inv.accepted_at:
                status = f"ACCEPTED at {inv.accepted_at}"
            elif inv.rejected_at:
                status = f"REJECTED at {inv.rejected_at}"

            print(f"  - ID: {inv.id}")
            print(f"    Org: {inv.organization_id}")
            print(f"    Status: {status}")
            print(f"    Created: {inv.created_at}")
            print(f"    Expires: {inv.expires_at}")
            print()

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    main()
