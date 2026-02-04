#!/usr/bin/env python3
"""Check the latest invitation and owner's public key"""
from app.database import get_db
from app.models import OrganizationInvitation, Organization, User
import base64

def main():
    db = next(get_db())
    try:
        # Find the latest invitation for jhanglaniyash@yahoo.com
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == 'jhanglaniyash@yahoo.com'
        ).order_by(OrganizationInvitation.created_at.desc()).first()

        if not invitation:
            print("No invitations found for jhanglaniyash@yahoo.com")
            return

        print(f"Latest Invitation:")
        print(f"  ID: {invitation.id}")
        print(f"  Email: {invitation.email}")
        print(f"  Organization ID: {invitation.organization_id}")
        print(f"  Created: {invitation.created_at}")
        print(f"  Accepted: {invitation.accepted_at}")
        print(f"  Rejected: {invitation.rejected_at}")
        print()

        # Check wrapped_org_key
        if invitation.wrapped_org_key:
            wrapped_key = invitation.wrapped_org_key
            print(f"  Has wrapped_org_key: YES")
            print(f"  Length: {len(wrapped_key)}")
            print(f"  First 100 chars: {wrapped_key[:100]}")

            # Try to validate base64
            try:
                decoded = base64.b64decode(wrapped_key)
                print(f"  [OK] Valid base64 encoding")
                print(f"  Decoded length: {len(decoded)} bytes")
            except Exception as e:
                print(f"  [ERROR] Invalid base64: {e}")
        else:
            print(f"  Has wrapped_org_key: NO")

        print()

        # Check the recipient's public key
        recipient = db.query(User).filter(User.email == 'jhanglaniyash@yahoo.com').first()
        if recipient:
            print(f"Recipient (jhanglaniyash@yahoo.com):")
            print(f"  Has public_key: {recipient.public_key is not None}")
            if recipient.public_key:
                print(f"  Public key length: {len(recipient.public_key)}")
                print(f"  Public key first 100 chars: {recipient.public_key[:100]}")

        print()

        # Check the organization
        org = db.query(Organization).filter(
            Organization.id == invitation.organization_id
        ).first()

        if org:
            print(f"Organization:")
            print(f"  Name: {org.name}")
            print(f"  ID: {org.id}")
            print(f"  Created by: {org.created_by}")
            print()

            # Check the owner's public key
            owner = db.query(User).filter(User.id == org.created_by).first()
            if owner:
                print(f"Organization Owner:")
                print(f"  Email: {owner.email}")
                print(f"  Has salt: {owner.salt is not None}")
                print(f"  Has public_key: {owner.public_key is not None}")
                if owner.public_key:
                    print(f"  Public key length: {len(owner.public_key)}")
                    print(f"  Public key first 100 chars: {owner.public_key[:100]}")

                    # Try to validate owner's public key base64
                    try:
                        decoded_pk = base64.b64decode(owner.public_key)
                        print(f"  [OK] Owner's public key is valid base64")
                        print(f"  Decoded length: {len(decoded_pk)} bytes")
                    except Exception as e:
                        print(f"  [ERROR] Owner's public key invalid base64: {e}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
