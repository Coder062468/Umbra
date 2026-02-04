#!/usr/bin/env python3
"""
Temporary script to cancel pending invitation
"""
from app.database import get_db
from app.models import OrganizationInvitation

def main():
    db = next(get_db())
    try:
        # Find and delete pending invitations
        pending = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com',
            OrganizationInvitation.accepted_at == None,
            OrganizationInvitation.rejected_at == None
        ).all()

        print(f"Found {len(pending)} pending invitation(s)")

        for inv in pending:
            print(f"Deleting invitation: {inv.id} for org {inv.organization_id}")
            db.delete(inv)

        db.commit()
        print("✓ Pending invitations cancelled successfully")

        # Verify
        remaining = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com'
        ).all()
        print(f"Remaining invitations: {len(remaining)}")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
