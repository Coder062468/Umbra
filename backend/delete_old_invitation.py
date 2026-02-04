#!/usr/bin/env python3
"""Delete the old invitation that was encrypted with invalid public key"""
from app.database import get_db
from app.models import OrganizationInvitation

def main():
    db = next(get_db())
    try:
        # Find the old invitation
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.id == '7e599b7a-1eb3-4779-85dd-8c0cd3341ec0'
        ).first()

        if not invitation:
            print("Invitation not found")
            return

        print(f"Found invitation:")
        print(f"  Organization: {invitation.organization_id}")
        print(f"  Email: {invitation.email}")
        print(f"  Role: {invitation.role}")
        print(f"  Created: {invitation.created_at}")

        # Delete it
        db.delete(invitation)
        db.commit()

        print("\n[OK] Successfully deleted old invitation")
        print("\nNext steps:")
        print("1. Have the organization owner send a NEW invitation")
        print("2. The new invitation will be encrypted with your current public key")
        print("3. You'll be able to decrypt it with your current RSA private key")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
