#!/usr/bin/env python3
"""Check public keys for both users"""
from app.database import get_db
from app.models import User
import base64

def main():
    db = next(get_db())
    try:
        users = [
            'jyash0090@gmail.com',  # Owner
            'jhanglaniyash@yahoo.com'  # Recipient
        ]

        for email in users:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                print(f"{email}: NOT FOUND")
                continue

            print(f"\n{email}:")
            print(f"  Has public_key: {user.public_key is not None}")

            if user.public_key:
                try:
                    decoded = base64.b64decode(user.public_key)
                    print(f"  Public key is valid base64: YES")
                    print(f"  Public key length: {len(user.public_key)} chars")
                    print(f"  Decoded length: {len(decoded)} bytes")
                    print(f"  First 80 chars: {user.public_key[:80]}")

                    # Check if it looks like a valid RSA public key
                    if user.public_key.startswith('MIIBIjAN'):
                        print(f"  Looks like valid RSA-2048 SPKI public key: YES")
                    else:
                        print(f"  WARNING: Doesn't look like standard RSA public key format")

                except Exception as e:
                    print(f"  ERROR: Invalid base64 - {e}")
            else:
                print(f"  NO PUBLIC KEY - user needs to log out and log back in!")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
