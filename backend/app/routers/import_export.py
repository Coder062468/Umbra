"""
Import/Export Routes
Excel file import and export endpoints

╔════════════════════════════════════════════════════════════════════════════════════╗
║                              ⚠️  DEPRECATED - E2EE MIGRATION                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║ This router is DISABLED and DEPRECATED as of the True E2EE migration.             ║
║                                                                                     ║
║ REASON:                                                                             ║
║   Import/export features are currently incompatible with E2EE because they rely    ║
║   on deleted schemas (TransactionListResponse) and server-side balance calculation.║
║   Future E2EE-compatible import/export would require client-side encryption.       ║
║                                                                                     ║
║ DISABLED IN: backend/app/main.py (lines 130-132)                                   ║
║                                                                                     ║
║ DO NOT ENABLE OR USE THIS ROUTER.                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
import io
from datetime import date

from app.database import get_db
from app.models import User, Account, Transaction
from app.dependencies import get_current_user
from app.schemas import ImportPreview
from app.utils.excel import import_excel_file, export_to_excel
from app.utils.calculations import get_person_summary, calculate_running_balance, get_account_summary

router = APIRouter(prefix="/api/import-export", tags=["Import/Export"])

# File size limit: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB in bytes


@router.post("/import/preview", response_model=ImportPreview)
async def preview_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None, description="Sheet name to import"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Preview Excel file import without saving to database

    Args:
        file: Uploaded Excel file
        sheet_name: Optional sheet name
        current_user: Authenticated user
        db: Database session

    Returns:
        Preview of imported data

    Raises:
        HTTPException: If file format is invalid or too large
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )

    try:
        # Read file content
        content = await file.read()

        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f} MB. Your file is {len(content) / 1024 / 1024:.2f} MB."
            )

        # Parse Excel file
        parsed_data = import_excel_file(content, sheet_name)

        return {
            "account_name": parsed_data["account_name"],
            "opening_balance": parsed_data["opening_balance"],
            "transactions": parsed_data["transactions"],
            "total_transactions": len(parsed_data["transactions"])
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing Excel file: {str(e)}"
        )


@router.post("/import/execute")
async def execute_import(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None, description="Sheet name to import"),
    account_id: Optional[UUID] = Query(None, description="Existing account ID to import into"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import Excel file and save transactions to database

    Args:
        file: Uploaded Excel file
        sheet_name: Optional sheet name
        account_id: Optional existing account ID (creates new if not provided)
        current_user: Authenticated user
        db: Database session

    Returns:
        Import summary

    Raises:
        HTTPException: If file format is invalid, too large, or account not found
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)"
        )

    try:
        # Read file content
        content = await file.read()

        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.0f} MB. Your file is {len(content) / 1024 / 1024:.2f} MB."
            )

        # Parse Excel file
        parsed_data = import_excel_file(content, sheet_name)

        # Get or create account
        if account_id:
            account = db.query(Account).filter(
                Account.id == account_id,
                Account.user_id == current_user.id
            ).first()

            if not account:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Account not found"
                )
        else:
            # Create new account
            account = Account(
                user_id=current_user.id,
                name=parsed_data["account_name"],
                opening_balance=parsed_data["opening_balance"],
                currency="INR"
            )
            db.add(account)
            db.commit()
            db.refresh(account)

        # Import transactions
        imported_count = 0
        for trans_data in parsed_data["transactions"]:
            transaction = Transaction(
                account_id=account.id,
                date=trans_data["date"],
                amount=trans_data["amount"],
                paid_to_from=trans_data["paid_to_from"],
                narration=trans_data["narration"],
                balance_after=0  # Will be recalculated
            )
            db.add(transaction)
            imported_count += 1

        db.commit()

        # Recalculate balances
        calculate_running_balance(str(account.id), account.opening_balance, db)

        return {
            "status": "success",
            "account_id": str(account.id),
            "account_name": account.name,
            "transactions_imported": imported_count
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error importing Excel file: {str(e)}"
        )


@router.get("/export")
async def export_accounts(
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs (all if not provided)"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export accounts and transactions to Excel file

    Args:
        account_ids: Optional comma-separated account IDs
        start_date: Optional start date filter
        end_date: Optional end date filter
        current_user: Authenticated user
        db: Database session

    Returns:
        Excel file download
    """
    # Parse account IDs
    if account_ids:
        try:
            account_id_list = [UUID(aid.strip()) for aid in account_ids.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid account ID format"
            )

        accounts = db.query(Account).filter(
            Account.id.in_(account_id_list),
            Account.user_id == current_user.id
        ).all()
    else:
        # Export all accounts
        accounts = db.query(Account).filter(
            Account.user_id == current_user.id
        ).all()

    if not accounts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No accounts found"
        )

    # Prepare data for export
    accounts_data = []

    for account in accounts:
        # Get transactions
        query = db.query(Transaction).filter(Transaction.account_id == account.id)

        if start_date:
            query = query.filter(Transaction.date >= start_date)

        if end_date:
            query = query.filter(Transaction.date <= end_date)

        transactions = query.order_by(Transaction.date.asc(), Transaction.created_at.asc()).all()

        # Get person summary
        person_summary = get_person_summary(str(account.id), db)

        # Get account summary
        summary = get_account_summary(str(account.id), db)

        accounts_data.append({
            "name": account.name,
            "opening_balance": account.opening_balance,
            "current_balance": summary["current_balance"],
            "total_income": summary["total_income"],
            "total_expense": summary["total_expense"],
            "unique_persons": summary["unique_persons"],
            "transactions": [
                {
                    "date": t.date,
                    "amount": t.amount,
                    "paid_to_from": t.paid_to_from,
                    "narration": t.narration,
                    "balance_after": t.balance_after
                }
                for t in transactions
            ],
            "person_summary": person_summary
        })

    # Generate Excel file
    output = io.BytesIO()
    export_to_excel(accounts_data, output)

    # Return as download
    filename = f"expense_tracker_export_{date.today().strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
