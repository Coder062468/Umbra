#!/usr/bin/env python3
"""Check owner's E2EE setup"""
from app.database import get_db
from app.models import User, Organization, OrganizationMember

def main():
    db = next(get_db())
    try:
        # Find the owner
        owner = db.query(User).filter(User.email == 'jyash0090@gmail.com').first()
        if not owner:
            print("Owner not found")
            return

        print(f"Owner: {owner.email}")
        print(f"Owner ID: {owner.id}")
        print(f"Has salt: {owner.salt is not None}")
        print(f"Has public_key: {owner.public_key is not None}")
        print()

        # Find their organizations
        orgs = db.query(Organization).filter(
            Organization.created_by == owner.id
        ).all()

        print(f"Owner has created {len(orgs)} organization(s):")
        for org in orgs:
            print(f"\nOrganization: {org.name}")
            print(f"  ID: {org.id}")
            print(f"  Created: {org.created_at}")

            # Check membership
            membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == owner.id
            ).first()

            if membership:
                print(f"  Owner is a member: Yes")
                print(f"  Role: {membership.role}")
                print(f"  Has wrapped_org_key: {membership.wrapped_org_key is not None}")
                if membership.wrapped_org_key:
                    print(f"  Wrapped key preview: {membership.wrapped_org_key[:50]}...")
            else:
                print(f"  Owner is a member: NO (ERROR!)")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
