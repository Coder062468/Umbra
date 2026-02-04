#!/usr/bin/env python3
"""Delete invitation by ID"""
from app.database import get_db
from app.models import OrganizationInvitation
import sys

def main():
    invitation_id = '5ffe2677-9bdb-4874-9af9-5df92d7f0c52'

    db = next(get_db())
    try:
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.id == invitation_id
        ).first()

        if not invitation:
            print(f"Invitation {invitation_id} not found")
            return

        print(f"Found invitation:")
        print(f"  Email: {invitation.email}")
        print(f"  Organization ID: {invitation.organization_id}")
        print(f"  Created: {invitation.created_at}")

        db.delete(invitation)
        db.commit()

        print(f"\n[OK] Successfully deleted invitation {invitation_id}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
