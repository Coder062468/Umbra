#!/usr/bin/env python3
"""Add encrypted_private_key column to users table"""
from app.database import get_db, engine
from sqlalchemy import text

def main():
    with engine.connect() as conn:
        # Add the column
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT
        """))
        conn.commit()
        print("[OK] Added encrypted_private_key column to users table")

if __name__ == '__main__':
    main()
