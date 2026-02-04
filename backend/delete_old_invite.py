#!/usr/bin/env python3
"""Delete accepted invitation record"""
from app.database import get_db
from app.models import OrganizationInvitation

def main():
    db = next(get_db())
    try:
        # Delete the accepted invitation
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com',
            OrganizationInvitation.organization_id == '8e40e538-e3a9-4385-a5e5-2bd14da75379'
        ).first()

        if invitation:
            print(f"Deleting invitation: {invitation.id}")
            print(f"  Status: {'ACCEPTED' if invitation.accepted_at else 'REJECTED' if invitation.rejected_at else 'PENDING'}")
            db.delete(invitation)
            db.commit()
            print("OK - Invitation deleted successfully")
        else:
            print("No invitation found")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
