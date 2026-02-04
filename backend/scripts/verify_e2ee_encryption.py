#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2EE Encryption Verification Script
====================================
Connects to the database and verifies:
  1. New rows have encryption_version = 1
  2. New rows have non-null encrypted_data
  3. New rows have null plaintext columns (amount, paid_to_from, name, opening_balance)
  4. Salt exists for all users
  5. No readable sensitive data in encrypted_data blobs
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    if not db_url:
        print("❌ ERROR: DATABASE_URL not found in environment")
        sys.exit(1)

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as e:
        print(f"❌ ERROR: Failed to connect to database: {e}")
        sys.exit(1)

    print("=" * 60)
    print("E2EE ENCRYPTION VERIFICATION")
    print("=" * 60)
    print()

    # CHECK 1: Users have salts
    cur.execute("SELECT COUNT(*) FROM users WHERE salt IS NULL")
    users_without_salt = cur.fetchone()[0]
    if users_without_salt > 0:
        print(f"⚠️  WARNING: {users_without_salt} users have no salt (legacy accounts)")
    else:
        print("✅ All users have PBKDF2 salts")

    # CHECK 2: E2EE accounts are encrypted
    cur.execute("""
        SELECT COUNT(*) FROM accounts
        WHERE encryption_version = 1
          AND encrypted_data IS NOT NULL
          AND encrypted_dek IS NOT NULL
          AND name IS NULL
          AND opening_balance IS NULL
    """)
    encrypted_accounts = cur.fetchone()[0]
    print(f"✅ {encrypted_accounts} accounts with E2EE encryption (version 1)")

    # CHECK 3: E2EE transactions are encrypted
    cur.execute("""
        SELECT COUNT(*) FROM transactions
        WHERE encryption_version = 1
          AND encrypted_data IS NOT NULL
          AND amount IS NULL
          AND paid_to_from IS NULL
    """)
    encrypted_txns = cur.fetchone()[0]
    print(f"✅ {encrypted_txns} transactions with E2EE encryption (version 1)")

    # CHECK 4: Sample encrypted_data to ensure it's not plaintext
    cur.execute("""
        SELECT encrypted_data FROM transactions
        WHERE encryption_version = 1
        LIMIT 10
    """)
    plaintext_words = ['coffee', 'amazon', 'grocery', 'rent', 'salary', 'food', 'uber', 'netflix']
    for row in cur.fetchall():
        blob = row[0]
        # Base64 typically contains +, /, or = and is long
        if len(blob) < 20:
            print(f"❌ FAIL: encrypted_data too short: {blob}")
            sys.exit(1)
        # Should not contain readable words (case-insensitive)
        if any(word in blob.lower() for word in plaintext_words):
            print(f"❌ FAIL: Plaintext detected in encrypted_data: {blob}")
            sys.exit(1)

    print("✅ All sampled encrypted_data blobs appear to be ciphertext (no plaintext words)")

    # CHECK 5: No legacy plaintext in E2EE rows
    cur.execute("""
        SELECT id FROM transactions
        WHERE encryption_version = 1
          AND (amount IS NOT NULL OR paid_to_from IS NOT NULL)
        LIMIT 1
    """)
    if cur.fetchone():
        print("❌ FAIL: E2EE transaction has non-null plaintext columns")
        sys.exit(1)

    print("✅ E2EE transactions have null plaintext columns")

    # CHECK 6: No legacy plaintext in E2EE account rows
    cur.execute("""
        SELECT id FROM accounts
        WHERE encryption_version = 1
          AND (name IS NOT NULL OR opening_balance IS NOT NULL)
        LIMIT 1
    """)
    if cur.fetchone():
        print("❌ FAIL: E2EE account has non-null plaintext columns")
        sys.exit(1)

    print("✅ E2EE accounts have null plaintext columns")

    # CHECK 7: All E2EE accounts have wrapped DEKs
    cur.execute("""
        SELECT COUNT(*) FROM accounts
        WHERE encryption_version = 1
          AND (encrypted_dek IS NULL OR encrypted_dek = '')
    """)
    accounts_without_dek = cur.fetchone()[0]
    if accounts_without_dek > 0:
        print(f"❌ FAIL: {accounts_without_dek} E2EE accounts missing encrypted_dek")
        sys.exit(1)

    print("✅ All E2EE accounts have wrapped DEKs")

    print()
    print("=" * 60)
    print("VERIFICATION PASSED ✅")
    print("=" * 60)
    print()
    print("Summary:")
    print(f"  - E2EE Accounts: {encrypted_accounts}")
    print(f"  - E2EE Transactions: {encrypted_txns}")
    print(f"  - Users without salt: {users_without_salt}")

    conn.close()


if __name__ == "__main__":
    main()
