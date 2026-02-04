-- Create database user
CREATE USER expense_user WITH PASSWORD 'expense_tracker_2026';

-- Create database
CREATE DATABASE expense_tracker OWNER expense_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE expense_tracker TO expense_user;

-- Connect to the database and grant schema privileges
\c expense_tracker
GRANT ALL ON SCHEMA public TO expense_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO expense_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO expense_user;
