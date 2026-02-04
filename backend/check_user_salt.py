#!/usr/bin/env python3
"""Check if user has a salt in the database"""
from app.database import get_db
from app.models import User

def main():
    db = next(get_db())
    try:
        # Find the user by email
        user = db.query(User).filter(User.email == 'jhanglaniyash@yahoo.com').first()

        if not user:
            print("User not found")
            return

        print(f"User found:")
        print(f"  Email: {user.email}")
        print(f"  ID: {user.id}")
        print(f"  Has salt: {user.salt is not None}")
        print(f"  Salt value: {user.salt}")
        print(f"  Has wrapped_org_key: {user.wrapped_org_key is not None}")
        print(f"  Has public_key: {user.public_key is not None}")

        if user.salt is None:
            print("\n[ISSUE] User has no salt - E2EE is not set up for this account")
            print("This user account was created before E2EE was implemented.")
            print("\nOptions:")
            print("1. Re-register with a new account (will lose existing data)")
            print("2. Run a migration script to set up E2EE for this account")
        else:
            print("\n[OK] User has a salt - E2EE should work")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
