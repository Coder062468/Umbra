"""
Create database tables directly
Run this if alembic migrations fail
"""

from app.database import Base, engine
from app import models

print("Creating database tables...")

try:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("SUCCESS: All tables created successfully!")
    print("\nTables created:")
    for table in Base.metadata.sorted_tables:
        print(f"  - {table.name}")
except Exception as e:
    print(f"ERROR: Failed to create tables: {e}")
    import traceback
    traceback.print_exc()
