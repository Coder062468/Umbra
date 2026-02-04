#!/usr/bin/env python3
"""Check if user is a member of organization"""
from app.database import get_db
from app.models import OrganizationMember

def main():
    db = next(get_db())
    try:
        # Check if user is a member
        member = db.query(OrganizationMember).join(
            OrganizationMember.user
        ).filter(
            OrganizationMember.organization_id == '8e40e538-e3a9-4385-a5e5-2bd14da75379'
        ).all()

        print(f"Found {len(member)} member(s) in organization:")
        for m in member:
            print(f"  - User ID: {m.user_id}, Email: {m.user.email}, Role: {m.role}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    main()
