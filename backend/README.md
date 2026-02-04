# Expense Tracker Backend

Enterprise-grade FastAPI backend for expense tracking with Excel import/export capabilities.

## Features

- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Account Management**: Create and manage multiple expense accounts
- **Transaction Tracking**: Full CRUD operations with filtering and search
- **Person-wise Summaries**: Automatic grouping and aggregation by person/category
- **Excel Import/Export**: Compatible with your existing Excel format
- **Analytics**: Daily/monthly summaries, top expenses, comprehensive reports
- **Database**: PostgreSQL with SQLAlchemy ORM
- **API Documentation**: Auto-generated Swagger/OpenAPI docs

## Project Structure

```
backend/
├── alembic/                # Database migrations
│   ├── versions/          # Migration files
│   ├── env.py            # Migration environment
│   └── script.py.mako    # Migration template
├── app/
│   ├── routers/          # API endpoints
│   │   ├── auth.py       # Authentication routes
│   │   ├── accounts.py   # Account CRUD
│   │   ├── transactions.py   # Transaction CRUD
│   │   ├── analytics.py  # Analytics endpoints
│   │   └── import_export.py  # Excel import/export
│   ├── utils/            # Utility functions
│   │   ├── auth.py       # JWT & password hashing
│   │   ├── calculations.py  # Balance calculations
│   │   └── excel.py      # Excel processing
│   ├── config.py         # Application configuration
│   ├── database.py       # Database setup
│   ├── dependencies.py   # FastAPI dependencies
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   └── main.py          # FastAPI application
├── .env                 # Environment variables (create from .env.example)
├── .env.example         # Example environment file
├── .gitignore          # Git ignore rules
├── alembic.ini         # Alembic configuration
├── requirements.txt    # Python dependencies
├── setup.py           # Quick setup script
└── README.md          # This file
```

## Quick Start

### 1. Set Up Environment

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run setup script
python setup.py
```

### 2. Configure Database

Edit `.env` file:

```env
DATABASE_URL=postgresql://expense_user:password@localhost:5432/expense_tracker
SECRET_KEY=<generated-by-setup-script>
```

### 3. Initialize Database

```bash
# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### 4. Run Server

```bash
# Development mode
python -m uvicorn app.main:app --reload --port 8000

# Production mode
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 5. Access API Documentation

Open: http://localhost:8000/api/docs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/summaries` - List accounts with summaries
- `GET /api/accounts/{id}` - Get account details
- `GET /api/accounts/{id}/summary` - Get account with summary
- `PUT /api/accounts/{id}` - Update account
- `DELETE /api/accounts/{id}` - Delete account

### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions (with filters)
- `GET /api/transactions/persons` - Get person-wise summary
- `GET /api/transactions/{id}` - Get transaction details
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction

### Analytics
- `GET /api/analytics/daily` - Daily income/expense summary
- `GET /api/analytics/monthly` - Monthly summary
- `GET /api/analytics/top-expenses` - Top expenses by person
- `GET /api/analytics/overview` - Comprehensive analytics

### Import/Export
- `POST /api/import-export/import/preview` - Preview Excel import
- `POST /api/import-export/import/execute` - Execute Excel import
- `GET /api/import-export/export` - Export to Excel

## Database Models

### User
- id (UUID, primary key)
- email (unique)
- password_hash
- created_at
- updated_at

### Account
- id (UUID, primary key)
- user_id (foreign key)
- name
- opening_balance
- currency
- created_at
- updated_at

### Transaction
- id (UUID, primary key)
- account_id (foreign key)
- date
- amount (negative for expenses, positive for income)
- paid_to_from (person/category name)
- narration (optional description)
- balance_after (running balance)
- created_at
- updated_at

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| SECRET_KEY | JWT signing secret | Required |
| ALGORITHM | JWT algorithm | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Token expiration | 1440 (24h) |
| APP_NAME | Application name | Expense Tracker API |
| DEBUG | Debug mode | False |
| ALLOWED_ORIGINS | CORS allowed origins | localhost:3000 |
| RATE_LIMIT_PER_MINUTE | API rate limit | 60 |

## Excel Import/Export Format

### Import Format
The system can import Excel files with the following structure:

```
Row 1: Account Name (e.g., "BHARAT AUTO HUB TRACKER")
Row 2: Opening Balance value

Row 5: Headers
  - Date (DD.MM.YY format)
  - Amount (negative for expenses)
  - Paid To/From
  - Narration (optional)

Row 6+: Transaction data
```

### Export Format
Exports generate Excel files matching your original format:
- Multiple sheets (one per account)
- Transaction list with running balance
- Person-wise summary sidebar
- Summary statistics at bottom
- Formatted headers and styling

## Security Features

- **Password Hashing**: bcrypt with cost factor 12
- **JWT Authentication**: Secure token-based auth
- **SQL Injection Prevention**: SQLAlchemy ORM
- **Input Validation**: Pydantic schemas
- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: Configurable per-minute limits

## Development

### Running Tests

```bash
pytest
```

### Creating Migrations

```bash
# Auto-generate migration
alembic revision --autogenerate -m "Description"

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Code Quality

The codebase follows enterprise-grade standards:
- Type hints throughout
- Comprehensive docstrings
- Error handling and logging
- RESTful API design
- Clean architecture (routers, services, models)

## Deployment

### Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Use strong `SECRET_KEY`
- [ ] Configure production DATABASE_URL
- [ ] Set up HTTPS (via Cloudflare Tunnel)
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Enable logging
- [ ] Configure firewall rules

### Running in Production

```bash
# With gunicorn (recommended)
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# Or with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
# Verify DATABASE_URL credentials
# Test connection: psql -U expense_user -d expense_tracker
```

### Migration Issues

```bash
# Reset migrations (WARNING: deletes data)
alembic downgrade base
alembic upgrade head
```

### Import Errors

```bash
# Ensure Excel file format matches expected structure
# Check date format is DD.MM.YY
# Verify column headers exist
```

## Performance

- Connection pooling: 10 connections, 20 max overflow
- Database indexes on frequently queried columns
- Efficient queries with SQLAlchemy ORM
- Pagination for large result sets
- Optimized Excel processing with pandas

## License

Proprietary - Internal use only

## Support

For setup assistance, check `SETUP_GUIDE.md` in the project root.
