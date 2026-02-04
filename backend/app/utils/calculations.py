"""
Calculation Utilities
Helper functions for balance and summary calculations

╔════════════════════════════════════════════════════════════════════════════════════╗
║                              ⚠️  DEPRECATED - E2EE MIGRATION                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║ This file is DEPRECATED as of the True End-to-End Encryption migration.           ║
║                                                                                     ║
║ REASON:                                                                             ║
║   Server-side balance calculation is incompatible with E2EE. The server cannot     ║
║   decrypt transaction amounts, so running balances are now calculated client-side  ║
║   after decryption.                                                                 ║
║                                                                                     ║
║ DO NOT USE THIS FILE OR ITS FUNCTIONS.                                             ║
║                                                                                     ║
║ Balances are now computed in:                                                      ║
║   - frontend_new/src/utils/e2eService.ts: decryptAndCalculateBalances()           ║
║   - frontend_new/src/utils/e2eService.ts: recalculateBalances()                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from decimal import Decimal
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import Transaction, Account


def calculate_running_balance(
    account_id: str,
    opening_balance: Decimal,
    db: Session
) -> None:
    """
    Recalculate running balances for all transactions in an account

    Args:
        account_id: UUID of the account
        opening_balance: Opening balance of the account
        db: Database session
    """
    # Get all transactions ordered by date and creation time
    transactions = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).order_by(
        Transaction.date.asc(),
        Transaction.created_at.asc()
    ).all()

    current_balance = opening_balance

    for transaction in transactions:
        current_balance += transaction.amount
        transaction.balance_after = current_balance

    db.commit()


def get_account_balance(account_id: str, db: Session) -> Decimal:
    """
    Get current balance of an account

    Args:
        account_id: UUID of the account
        db: Database session

    Returns:
        Current balance
    """
    last_transaction = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).order_by(
        Transaction.date.desc(),
        Transaction.created_at.desc()
    ).first()

    if last_transaction:
        return last_transaction.balance_after
    else:
        # No transactions, return opening balance
        account = db.query(Account).filter(Account.id == account_id).first()
        return account.opening_balance if account else Decimal("0")


def get_account_summary(account_id: str, db: Session) -> dict:
    """
    Get summary statistics for an account

    Args:
        account_id: UUID of the account
        db: Database session

    Returns:
        Dictionary with summary statistics
    """
    account = db.query(Account).filter(Account.id == account_id).first()

    if not account:
        return None

    # Get transaction statistics
    stats = db.query(
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).first()

    # Get income and expense totals
    income = db.query(
        func.sum(Transaction.amount)
    ).filter(
        and_(
            Transaction.account_id == account_id,
            Transaction.amount > 0,
            Transaction.deleted_at.is_(None)
        )
    ).scalar() or Decimal("0")

    expense = db.query(
        func.sum(Transaction.amount)
    ).filter(
        and_(
            Transaction.account_id == account_id,
            Transaction.amount < 0,
            Transaction.deleted_at.is_(None)
        )
    ).scalar() or Decimal("0")

    # Get unique persons count
    unique_persons = db.query(
        func.count(func.distinct(Transaction.paid_to_from))
    ).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).scalar() or 0

    current_balance = get_account_balance(account_id, db)

    return {
        "current_balance": current_balance,
        "total_income": income,
        "total_expense": expense,
        "transaction_count": stats.count if stats else 0,
        "unique_persons": unique_persons
    }


def get_person_summary(account_id: str, db: Session) -> List[dict]:
    """
    Get person-wise summary for an account

    Args:
        account_id: UUID of the account
        db: Database session

    Returns:
        List of dictionaries with person summaries
    """
    summaries = db.query(
        Transaction.paid_to_from,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("transaction_count")
    ).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).group_by(
        Transaction.paid_to_from
    ).order_by(
        func.sum(Transaction.amount).asc()
    ).all()

    return [
        {
            "person": s.paid_to_from,
            "total_amount": s.total_amount,
            "transaction_count": s.transaction_count
        }
        for s in summaries
    ]
