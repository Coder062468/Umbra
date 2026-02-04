"""
Analytics Routes
Endpoints for charts and analytics data

╔════════════════════════════════════════════════════════════════════════════════════╗
║                              ⚠️  DEPRECATED - E2EE MIGRATION                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║ This router is DISABLED and DEPRECATED as of the True E2EE migration.             ║
║                                                                                     ║
║ REASON:                                                                             ║
║   Analytics endpoints rely on deleted schemas (DailySummary, MonthlySummary,       ║
║   PersonSummary, AnalyticsResponse) and server-side aggregation of encrypted data. ║
║   Future E2EE-compatible analytics must be computed client-side after decryption.  ║
║                                                                                     ║
║ DISABLED IN: backend/app/main.py (lines 130-132)                                   ║
║                                                                                     ║
║ DO NOT ENABLE OR USE THIS ROUTER.                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from app.database import get_db
from app.models import User, Account, Transaction
from app.dependencies import get_current_user
from app.schemas import DailySummary, MonthlySummary, PersonSummary, AnalyticsResponse

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/daily", response_model=List[DailySummary])
async def get_daily_summary(
    account_id: UUID = Query(..., description="Account ID"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get daily income/expense summary

    Args:
        account_id: Account UUID
        start_date: Optional start date (default: 30 days ago)
        end_date: Optional end date (default: today)
        current_user: Authenticated user
        db: Database session

    Returns:
        List of daily summaries

    Raises:
        HTTPException: If account not found or unauthorized
    """
    # Verify account ownership
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Default date range: last 30 days
    if not end_date:
        end_date = date.today()

    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Query daily summaries
    daily_data = db.query(
        Transaction.date,
        func.sum(
            func.case((Transaction.amount > 0, Transaction.amount), else_=0)
        ).label("income"),
        func.sum(
            func.case((Transaction.amount < 0, Transaction.amount), else_=0)
        ).label("expense")
    ).filter(
        Transaction.account_id == account_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(
        Transaction.date
    ).order_by(
        Transaction.date.asc()
    ).all()

    summaries = []
    for data in daily_data:
        income = data.income or Decimal("0")
        expense = data.expense or Decimal("0")
        summaries.append({
            "date": data.date,
            "income": income,
            "expense": expense,
            "net": income + expense
        })

    return summaries


@router.get("/monthly", response_model=List[MonthlySummary])
async def get_monthly_summary(
    account_id: UUID = Query(..., description="Account ID"),
    year: Optional[int] = Query(None, description="Year (default: current year)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get monthly income/expense summary

    Args:
        account_id: Account UUID
        year: Optional year filter
        current_user: Authenticated user
        db: Database session

    Returns:
        List of monthly summaries

    Raises:
        HTTPException: If account not found or unauthorized
    """
    # Verify account ownership
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Default year: current year
    if not year:
        year = date.today().year

    # Query monthly summaries
    monthly_data = db.query(
        extract("month", Transaction.date).label("month"),
        extract("year", Transaction.date).label("year"),
        func.sum(
            func.case((Transaction.amount > 0, Transaction.amount), else_=0)
        ).label("income"),
        func.sum(
            func.case((Transaction.amount < 0, Transaction.amount), else_=0)
        ).label("expense")
    ).filter(
        Transaction.account_id == account_id,
        extract("year", Transaction.date) == year
    ).group_by(
        extract("month", Transaction.date),
        extract("year", Transaction.date)
    ).order_by(
        extract("month", Transaction.date).asc()
    ).all()

    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    summaries = []
    for data in monthly_data:
        income = data.income or Decimal("0")
        expense = data.expense or Decimal("0")
        summaries.append({
            "month": month_names[int(data.month) - 1],
            "year": int(data.year),
            "income": income,
            "expense": expense,
            "net": income + expense
        })

    return summaries


@router.get("/top-expenses", response_model=List[PersonSummary])
async def get_top_expenses(
    account_id: UUID = Query(..., description="Account ID"),
    limit: int = Query(10, ge=1, le=50, description="Number of top expenses to return"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get top expenses by person/category

    Args:
        account_id: Account UUID
        limit: Number of results
        start_date: Optional start date filter
        end_date: Optional end date filter
        current_user: Authenticated user
        db: Database session

    Returns:
        List of top expense persons

    Raises:
        HTTPException: If account not found or unauthorized
    """
    # Verify account ownership
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Build query
    query = db.query(
        Transaction.paid_to_from,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("transaction_count")
    ).filter(
        Transaction.account_id == account_id,
        Transaction.amount < 0  # Only expenses
    )

    # Apply date filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)

    if end_date:
        query = query.filter(Transaction.date <= end_date)

    # Group and order
    top_expenses = query.group_by(
        Transaction.paid_to_from
    ).order_by(
        func.sum(Transaction.amount).asc()
    ).limit(limit).all()

    return [
        {
            "person": e.paid_to_from,
            "total_amount": e.total_amount,
            "transaction_count": e.transaction_count
        }
        for e in top_expenses
    ]


@router.get("/overview", response_model=AnalyticsResponse)
async def get_analytics_overview(
    account_id: UUID = Query(..., description="Account ID"),
    start_date: Optional[date] = Query(None, description="Start date (default: 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date (default: today)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive analytics overview

    Args:
        account_id: Account UUID
        start_date: Optional start date
        end_date: Optional end date
        current_user: Authenticated user
        db: Database session

    Returns:
        Analytics overview data

    Raises:
        HTTPException: If account not found or unauthorized
    """
    # Verify account ownership
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Default date range: last 30 days
    if not end_date:
        end_date = date.today()

    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Get daily summaries
    daily_summaries = await get_daily_summary(account_id, start_date, end_date, current_user, db)

    # Get top 10 expenses
    top_expenses = await get_top_expenses(account_id, 10, start_date, end_date, current_user, db)

    # Calculate totals
    totals = db.query(
        func.sum(
            func.case((Transaction.amount > 0, Transaction.amount), else_=0)
        ).label("total_income"),
        func.sum(
            func.case((Transaction.amount < 0, Transaction.amount), else_=0)
        ).label("total_expense")
    ).filter(
        Transaction.account_id == account_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).first()

    total_income = totals.total_income or Decimal("0")
    total_expense = totals.total_expense or Decimal("0")

    return {
        "daily_summaries": daily_summaries,
        "top_expenses": top_expenses,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_total": total_income + total_expense
    }
