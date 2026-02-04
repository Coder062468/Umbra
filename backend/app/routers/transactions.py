"""
Transaction Routes
CRUD operations for E2E encrypted transactions.

Zero-Knowledge Principle:
  This router is a dumb storage layer for encrypted blobs.
  It NEVER decrypts, validates field contents, or computes balances.

  What moved to the client:
    - Balance calculation (running balance from opening_balance + amounts)
    - Duplicate detection (client checks before sending)
    - Filtering by amount, person, narration, search
    - Person-wise aggregation / summaries
    - All analytics

  What stays server-side:
    - Authentication & account ownership enforcement
    - Date-based ordering (date is plaintext)
    - Date-range filtering (optional, for future use)
    - Soft delete / restore lifecycle
    - CRUD storage of opaque encrypted blobs
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date, datetime

from app.database import get_db
from app.models import User, Account, Transaction, OrganizationMember
from app.dependencies import get_current_user
from app.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionList,
)

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def check_account_access(db: Session, account_id: UUID, current_user: User) -> Account:
    """
    Check if user has access to an account (personal or organization).
    Returns the account if access is granted, raises 404 otherwise.
    """
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.deleted_at.is_(None)
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check access permissions
    if account.organization_id:
        # Organization account - check if user is a member
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == account.organization_id,
            OrganizationMember.user_id == current_user.id
        ).first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not a member of this organization"
            )
    else:
        # Personal account - check ownership
        if account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This is not your account"
            )

    return account


# ────────────────────────────────────────────────────────────────────
# CREATE
# ────────────────────────────────────────────────────────────────────

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Store a new encrypted transaction.
    Server receives { account_id, date, encrypted_data } and stores as-is.
    It never sees amount, person name, or narration.
    """
    # Verify account access (personal or organization)
    account = check_account_access(db, transaction_data.account_id, current_user)

    new_transaction = Transaction(
        account_id=transaction_data.account_id,
        date=transaction_data.date,
        encrypted_data=transaction_data.encrypted_data,
        encryption_version=transaction_data.encryption_version
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    return new_transaction


# ────────────────────────────────────────────────────────────────────
# READ (list)
# ────────────────────────────────────────────────────────────────────

@router.get("", response_model=TransactionList)
async def get_transactions(
    account_id: UUID = Query(..., description="Account ID — required"),
    start_date: Optional[date] = Query(None, description="Optional start date filter"),
    end_date: Optional[date] = Query(None, description="Optional end date filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return ALL transactions for an account, ordered chronologically.

    Why no pagination?
      In E2E mode the client must decrypt every row to compute running balances,
      do filtering, and build serial numbers.  Partial fetches would produce
      incorrect balances.  The full dataset is returned and processed client-side.

    Supported server-side filters:
      - account_id (required)
      - start_date / end_date (optional — date is plaintext)

    NOT supported (encrypted fields):
      - person, amount range, search text  →  filter client-side after decryption
    """
    # Verify account access (personal or organization)
    account = check_account_access(db, account_id, current_user)

    # Base query: active transactions for this account
    query = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    )

    # Optional date-range filters (date is plaintext)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    # Chronological order — same sort the client uses for balance calculation
    transactions = query.order_by(
        Transaction.date.asc(),
        Transaction.created_at.asc()
    ).all()

    return {
        "transactions": transactions,
        "total": len(transactions)
    }


# ────────────────────────────────────────────────────────────────────
# READ (single)
# ────────────────────────────────────────────────────────────────────

@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single encrypted transaction by ID."""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.deleted_at.is_(None)
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Verify account access (personal or organization)
    check_account_access(db, transaction.account_id, current_user)

    return transaction


# ────────────────────────────────────────────────────────────────────
# UPDATE
# ────────────────────────────────────────────────────────────────────

@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a transaction.
    Client decrypts the existing row, applies changes, re-encrypts the full
    payload, and sends the new encrypted_data blob.  Server swaps it in.
    """
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.deleted_at.is_(None)
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Verify account access (personal or organization)
    check_account_access(db, transaction.account_id, current_user)

    if transaction_data.date is not None:
        transaction.date = transaction_data.date

    if transaction_data.encrypted_data is not None:
        transaction.encrypted_data = transaction_data.encrypted_data

    transaction.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(transaction)

    return transaction


# ────────────────────────────────────────────────────────────────────
# SOFT DELETE
# ────────────────────────────────────────────────────────────────────

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Soft-delete a transaction.
    The encrypted blob remains in the DB until hard-deleted or restored.
    """
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.deleted_at.is_(None)
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Verify account access (personal or organization)
    check_account_access(db, transaction.account_id, current_user)

    transaction.deleted_at = datetime.utcnow()
    transaction.deleted_by = current_user.id
    db.commit()

    return None


# ────────────────────────────────────────────────────────────────────
# RESTORE
# ────────────────────────────────────────────────────────────────────

@router.post("/{transaction_id}/restore", response_model=TransactionResponse)
async def restore_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore a soft-deleted transaction. Encrypted blob is untouched."""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.deleted_at.is_not(None)   # Only find deleted rows
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not deleted"
        )

    # Verify account access (personal or organization)
    check_account_access(db, transaction.account_id, current_user)

    transaction.deleted_at = None
    transaction.deleted_by = None
    transaction.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(transaction)

    return transaction
