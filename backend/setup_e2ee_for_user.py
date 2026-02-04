#!/usr/bin/env python3
"""
Set up E2EE for an existing user account that doesn't have a salt.
This generates a random salt and stores it in the database.

IMPORTANT: The user MUST log in again after running this script to derive
their master key from their password + the new salt.
"""
import secrets
import base64
from app.database import get_db
from app.models import User

def generate_salt() -> str:
    """Generate a cryptographically random 32-byte salt, base64-encoded."""
    return base64.b64encode(secrets.token_bytes(32)).decode('utf-8')

def main():
    db = next(get_db())
    try:
        # Find the user
        user = db.query(User).filter(User.email == 'jhanglaniyash@yahoo.com').first()

        if not user:
            print("User not found")
            return

        print(f"User found: {user.email}")
        print(f"Current salt: {user.salt}")

        if user.salt:
            print("\n[WARNING] User already has a salt. Stopping.")
            print("If you want to regenerate the salt, manually delete it first.")
            return

        # Generate and set salt
        new_salt = generate_salt()
        user.salt = new_salt

        print(f"\nGenerated new salt: {new_salt[:20]}...")
        print("Saving to database...")

        db.commit()

        print("\n[OK] Successfully set up E2EE for user")
        print("\nIMPORTANT NEXT STEPS:")
        print("1. User must log out completely")
        print("2. User must log back in with their password")
        print("3. The frontend will derive the master key from password + salt")
        print("4. A fresh RSA key pair will be generated")
        print("5. User can then accept invitations")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
