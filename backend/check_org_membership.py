#!/usr/bin/env python3
"""Check organization membership and keys"""
from app.database import get_db
from app.models import OrganizationMember, Organization, User

def main():
    db = next(get_db())
    try:
        # Find the user
        user = db.query(User).filter(User.email == 'jhanglaniyash@yahoo.com').first()
        if not user:
            print("User not found")
            return

        print(f"User: {user.email}")
        print(f"User ID: {user.id}")
        print(f"User has salt: {user.salt is not None}")
        print()

        # Find their organizations
        memberships = db.query(OrganizationMember, Organization).join(
            Organization,
            Organization.id == OrganizationMember.organization_id
        ).filter(
            OrganizationMember.user_id == user.id
        ).all()

        if not memberships:
            print("User is not a member of any organizations")
            return

        print(f"Found {len(memberships)} organization membership(s):\n")
        for member, org in memberships:
            print(f"Organization: {org.name}")
            print(f"  Organization ID: {org.id}")
            print(f"  Role: {member.role}")
            print(f"  Has wrapped_org_key in membership: {member.wrapped_org_key is not None}")
            if member.wrapped_org_key:
                print(f"  Wrapped key preview: {member.wrapped_org_key[:50]}...")
            print(f"  Joined at: {member.joined_at}")
            print(f"  Organization created by: {org.created_by}")
            print(f"  Is creator: {org.created_by == user.id}")
            print("-" * 60)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
