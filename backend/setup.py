"""
Setup Script
Quick setup for the expense tracker backend
"""

import os
import sys
import secrets
from pathlib import Path


def generate_secret_key():
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(32)


def create_env_file():
    """Create .env file with generated secret key"""
    env_path = Path(__file__).parent / ".env"

    if env_path.exists():
        response = input(".env file already exists. Overwrite? (y/n): ")
        if response.lower() != 'y':
            print("Keeping existing .env file")
            return

    secret_key = generate_secret_key()

    env_content = f"""# Database Configuration
DATABASE_URL=postgresql://expense_user:your_password_here@localhost:5432/expense_tracker

# Security
SECRET_KEY={secret_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Application
APP_NAME=Expense Tracker API
APP_VERSION=1.0.0
DEBUG=True

# CORS (for development, adjust for production)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
"""

    with open(env_path, 'w') as f:
        f.write(env_content)

    print(f"Created .env file at: {env_path}")
    print(f"Generated SECRET_KEY: {secret_key}")
    print("\nIMPORTANT: Update DATABASE_URL with your PostgreSQL credentials!")


def check_dependencies():
    """Check if required packages are installed"""
    try:
        import fastapi
        import sqlalchemy
        import pandas
        print("All required packages are installed")
        return True
    except ImportError as e:
        print(f"Missing package: {e.name}")
        print("Run: pip install -r requirements.txt")
        return False


def main():
    """Main setup function"""
    print("="*60)
    print("Expense Tracker Backend Setup")
    print("="*60)
    print()

    # Create .env file
    create_env_file()
    print()

    # Check dependencies
    print("Checking dependencies...")
    if check_dependencies():
        print()
        print("="*60)
        print("Setup complete!")
        print("="*60)
        print()
        print("Next steps:")
        print("1. Update DATABASE_URL in .env file")
        print("2. Create PostgreSQL database: expense_tracker")
        print("3. Run migrations: alembic upgrade head")
        print("4. Start server: python -m uvicorn app.main:app --reload")
        print()
    else:
        print()
        print("Please install dependencies first:")
        print("pip install -r requirements.txt")


if __name__ == "__main__":
    main()
