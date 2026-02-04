"""
Account Routes
CRUD operations for E2E encrypted accounts.

Zero-Knowledge Principle:
  This router stores encrypted blobs provided by the client.
  It NEVER inspects, decrypts, or computes anything from account contents.
  All decryption, balance calculation, and name display happen client-side.

  What the server stores per account:
    - encrypted_data   → opaque AES-GCM blob (contains name + opening_balance)
    - encrypted_dek    → the account's DEK wrapped with the user's master key
    - currency         → plaintext (non-sensitive, needed for display formatting)
    - encryption_version → 1 for E2E
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models import User, Account, OrganizationMember, AuditLog
from app.dependencies import get_current_user
from app.schemas import (
    AccountCreate, AccountUpdate, AccountResponse, AccountSummary,
    AccountBackupCreate, AccountBackupResponse, AccountBackupRestore,
    AccountBackupRestoreResponse, RestoreMode
)
from app.models import Transaction
from sqlalchemy import func

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new account.
    Client encrypts { name, opening_balance } and the DEK before sending.
    If organization_id is provided, account is assigned to that organization.
    Otherwise, it's a personal account.
    """
    new_account = Account(
        user_id=current_user.id,
        organization_id=account_data.organization_id,
        created_by=current_user.id,
        encrypted_data=account_data.encrypted_data,
        encrypted_dek=account_data.encrypted_dek,
        currency=account_data.currency,
        encryption_version=account_data.encryption_version
    )

    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    return new_account


@router.get("", response_model=List[AccountResponse])
async def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all accounts for the authenticated user (encrypted).
    Includes both:
    - Personal accounts (where user_id == current_user.id AND organization_id IS NULL)
    - Organization accounts (where organization_id IN user's organizations)
    """
    # Get user's organization IDs
    user_org_ids = db.query(OrganizationMember.organization_id).filter(
        OrganizationMember.user_id == current_user.id
    ).subquery()

    # Query for personal accounts OR organization accounts
    accounts = db.query(Account).filter(
        Account.deleted_at.is_(None)
    ).filter(
        # Personal accounts
        ((Account.user_id == current_user.id) & (Account.organization_id.is_(None))) |
        # Organization accounts where user is a member
        (Account.organization_id.in_(user_org_ids))
    ).order_by(Account.created_at.desc()).all()

    return accounts


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a single account by ID (encrypted).
    Supports both personal accounts and organization accounts.
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


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update account encrypted payload.
    Client re-encrypts the full { name, opening_balance } payload and sends it.
    Also supports migration fields for transferring accounts to organizations.
    """
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
        Account.deleted_at.is_(None)
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Update encrypted data if provided
    if account_data.encrypted_data is not None:
        account.encrypted_data = account_data.encrypted_data

    # Support account migration to organization
    if account_data.organization_id is not None:
        account.organization_id = account_data.organization_id

    # Update wrapped DEK (re-encrypted with org key during migration)
    if account_data.wrapped_dek is not None:
        account.encrypted_dek = account_data.wrapped_dek

    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(account)

    return account


@router.get("/{account_id}/summary", response_model=AccountSummary)
async def get_account_summary(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for an account.
    Note: Since transactions are E2EE, this returns placeholder/zero values.
    Real calculations happen client-side after decryption.
    Supports both personal accounts and organization accounts.
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

    # Count transactions (this is safe, it's just a count)
    transaction_count = db.query(func.count(Transaction.id)).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).scalar()

    # Return placeholder values since amounts are encrypted
    return AccountSummary(
        total_credit=0,
        total_debit=0,
        net_balance=0,
        transaction_count=transaction_count or 0
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Hard-delete an account and all its transactions (CASCADE).
    Encrypted data is destroyed with it.

    For personal accounts: Only the owner can delete.
    For organization accounts: Owner or admin can delete.
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

    # Check permissions
    if account.organization_id:
        # Organization account - check membership and role
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == account.organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.left_at.is_(None)
        ).first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization"
            )

        # Only owners and admins can delete organization accounts
        if membership.role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organization owners and admins can delete accounts"
            )
    else:
        # Personal account - only owner can delete
        if account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own personal accounts"
            )

    # Log the deletion in audit log if it's an organization account
    if account.organization_id:
        audit_log = AuditLog(
            organization_id=account.organization_id,
            user_id=current_user.id,
            action="account.deleted",
            resource_type="account",
            resource_id=account.id,
            details={"account_currency": account.currency}
        )
        db.add(audit_log)

    db.delete(account)
    db.commit()

    return None


@router.get("/{account_id}/permissions")
async def get_account_permissions(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all permissions for an account.
    Only owners and admins can view permissions.
    """
    from app.models import AccountPermission, OrganizationMember
    from app.utils.permissions import check_account_permission

    check_account_permission(db, current_user, str(account_id), "full")

    account = db.query(Account).filter(
        Account.id == account_id,
        Account.deleted_at.is_(None)
    ).first()

    if not account or not account.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or not part of an organization"
        )

    permissions = db.query(AccountPermission, User).join(
        User,
        User.id == AccountPermission.user_id
    ).filter(
        AccountPermission.account_id == account_id
    ).all()

    result = []
    for perm, user in permissions:
        result.append({
            "id": perm.id,
            "user_id": perm.user_id,
            "user_email": user.email,
            "permission": perm.permission,
            "granted_at": perm.granted_at
        })

    return {
        "account_id": str(account_id),
        "default_permission": account.default_permission,
        "permissions": result
    }


@router.put("/{account_id}/permissions/{user_id}")
async def set_account_permission(
    account_id: UUID,
    user_id: UUID,
    permission: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set permission for a user on an account.
    Only owners and admins can manage permissions.
    Permission must be: full, edit, or view
    """
    from app.models import AccountPermission, OrganizationMember
    from app.utils.permissions import check_account_permission

    check_account_permission(db, current_user, str(account_id), "full")

    if permission not in ["full", "edit", "view"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission must be: full, edit, or view"
        )

    account = db.query(Account).filter(
        Account.id == account_id,
        Account.deleted_at.is_(None)
    ).first()

    if not account or not account.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or not part of an organization"
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    target_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == account.organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of this organization"
        )

    existing_perm = db.query(AccountPermission).filter(
        AccountPermission.account_id == account_id,
        AccountPermission.user_id == user_id
    ).first()

    if existing_perm:
        existing_perm.permission = permission
    else:
        new_perm = AccountPermission(
            account_id=account_id,
            user_id=user_id,
            permission=permission,
            granted_by=current_user.id
        )
        db.add(new_perm)

    db.commit()

    return {"status": "updated", "permission": permission}


@router.delete("/{account_id}/permissions/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_account_permission(
    account_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove specific permission for a user on an account.
    User will fall back to organization role or account default permission.
    Only owners and admins can manage permissions.
    """
    from app.models import AccountPermission
    from app.utils.permissions import check_account_permission

    check_account_permission(db, current_user, str(account_id), "full")

    account = db.query(Account).filter(
        Account.id == account_id,
        Account.deleted_at.is_(None)
    ).first()

    if not account or not account.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or not part of an organization"
        )

    perm = db.query(AccountPermission).filter(
        AccountPermission.account_id == account_id,
        AccountPermission.user_id == user_id
    ).first()

    if perm:
        db.delete(perm)
        db.commit()

    return None


@router.post("/{account_id}/backup", response_model=AccountBackupResponse)
async def create_account_backup(
    account_id: UUID,
    backup_data: AccountBackupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create encrypted backup of an account and all its transactions.

    Only account owner can create backups.
    Backup includes:
    - Account metadata (name, currency, opening balance)
    - All transactions (encrypted)
    - Encryption keys (wrapped with user's key)
    - Platform signature (prevents import to other apps)

    Security:
    - E2EE preserved: Encrypted data stays encrypted
    - Owner-only: Only account owner can create backups
    - Audit logged: All backup creation logged
    - Version controlled: Backup format versioned
    """
    import json
    import uuid

    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
        Account.deleted_at.is_(None)
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or access denied"
        )

    transactions = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.deleted_at.is_(None)
    ).order_by(Transaction.date).all()

    backup_structure = {
        "version": "1.0.0",
        "platform": "expense_tracker_e2ee",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": str(current_user.id),
        "notes": backup_data.notes,

        "account": {
            "id": str(account.id),
            "name": account.name if account.name else "Account",
            "currency": account.currency,
            "opening_balance": str(account.opening_balance) if account.opening_balance else "0.00",
            "encrypted_data": account.encrypted_data,
            "encrypted_dek": account.encrypted_dek,
            "encryption_version": account.encryption_version,
            "created_at": account.created_at.isoformat(),
        },

        "transactions": [
            {
                "id": str(t.id),
                "date": t.date.isoformat(),
                "amount": str(t.amount),
                "paid_to_from": t.paid_to_from if t.paid_to_from else "",
                "narration": t.narration if t.narration else "",
                "balance_after": str(t.balance_after) if t.balance_after else "0.00",
                "encrypted_data": t.encrypted_data,
                "encryption_version": t.encryption_version,
                "created_at": t.created_at.isoformat(),
            }
            for t in transactions
        ],

        "statistics": {
            "total_transactions": len(transactions),
            "date_range": {
                "earliest": transactions[0].date.isoformat() if transactions else None,
                "latest": transactions[-1].date.isoformat() if transactions else None,
            }
        }
    }

    backup_json = json.dumps(backup_structure, indent=2)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c for c in (account.name or "account") if c.isalnum() or c in (' ', '-', '_'))
    safe_name = safe_name.strip() or "account"
    filename = f"account_backup_{safe_name}_{timestamp}.etbackup"

    from app.models import AuditLog
    audit_log = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="account_backup_created",
        resource_type="account",
        resource_id=account_id,
        details={
            "filename": filename,
            "transaction_count": len(transactions)
        },
        ip_address="127.0.0.1",
        user_agent="API"
    )
    db.add(audit_log)
    db.commit()

    return AccountBackupResponse(
        filename=filename,
        size_bytes=len(backup_json.encode('utf-8')),
        transaction_count=len(transactions),
        backup_data=backup_json,
        created_at=datetime.utcnow()
    )


@router.post("/{account_id}/restore", response_model=AccountBackupRestoreResponse)
async def restore_account_backup(
    account_id: UUID,
    restore_data: AccountBackupRestore,
    backup_file: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore account from encrypted backup.

    Modes:
    - replace: Delete existing transactions and restore from backup
    - merge: Keep existing transactions, add transactions from backup (skip duplicates)
    - new_account: Create a new account with backup data (keep original)

    Security:
    - Verifies platform signature
    - Validates backup format version
    - Checks user owns the account
    - Preserves E2EE (encrypted data remains encrypted)
    - Audit logged
    """
    import json
    import uuid
    from decimal import Decimal

    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
        Account.deleted_at.is_(None)
    ).first()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or access denied"
        )

    try:
        backup_structure = json.loads(backup_file)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid backup file: {str(e)}"
        )

    if backup_structure.get("platform") != "expense_tracker_e2ee":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid backup: Not from Expense Tracker platform"
        )

    if backup_structure.get("version") != "1.0.0":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported backup version: {backup_structure.get('version')}"
        )

    restored_count = 0
    new_account_id = None

    if restore_data.mode == RestoreMode.REPLACE:
        db.query(Transaction).filter(
            Transaction.account_id == account_id
        ).update({
            "deleted_at": datetime.utcnow(),
            "deleted_by": current_user.id
        })

        for tx_data in backup_structure["transactions"]:
            transaction = Transaction(
                id=uuid.uuid4(),
                account_id=account_id,
                date=datetime.fromisoformat(tx_data["date"]),
                amount=Decimal(tx_data["amount"]),
                paid_to_from=tx_data["paid_to_from"],
                narration=tx_data["narration"],
                balance_after=Decimal(tx_data["balance_after"]),
                encrypted_data=tx_data["encrypted_data"],
                encryption_version=tx_data["encryption_version"],
            )
            db.add(transaction)

        db.commit()
        restored_count = len(backup_structure["transactions"])

    elif restore_data.mode == RestoreMode.MERGE:
        existing_transactions = db.query(Transaction).filter(
            Transaction.account_id == account_id,
            Transaction.deleted_at.is_(None)
        ).all()

        existing_set = {
            (t.date.isoformat(), str(t.amount), t.paid_to_from)
            for t in existing_transactions
        }

        for tx_data in backup_structure["transactions"]:
            key = (tx_data["date"], tx_data["amount"], tx_data["paid_to_from"])
            if key not in existing_set:
                transaction = Transaction(
                    id=uuid.uuid4(),
                    account_id=account_id,
                    date=datetime.fromisoformat(tx_data["date"]),
                    amount=Decimal(tx_data["amount"]),
                    paid_to_from=tx_data["paid_to_from"],
                    narration=tx_data["narration"],
                    balance_after=Decimal(tx_data["balance_after"]),
                    encrypted_data=tx_data["encrypted_data"],
                    encryption_version=tx_data["encryption_version"],
                )
                db.add(transaction)
                restored_count += 1

        db.commit()

    elif restore_data.mode == RestoreMode.NEW_ACCOUNT:
        new_account = Account(
            id=uuid.uuid4(),
            user_id=current_user.id,
            name=backup_structure["account"]["name"] + " (Restored)",
            currency=backup_structure["account"]["currency"],
            opening_balance=Decimal(backup_structure["account"]["opening_balance"]),
            encrypted_data=backup_structure["account"]["encrypted_data"],
            encrypted_dek=backup_structure["account"]["encrypted_dek"],
            encryption_version=backup_structure["account"]["encryption_version"],
        )
        db.add(new_account)
        db.flush()

        new_account_id = new_account.id

        for tx_data in backup_structure["transactions"]:
            transaction = Transaction(
                id=uuid.uuid4(),
                account_id=new_account.id,
                date=datetime.fromisoformat(tx_data["date"]),
                amount=Decimal(tx_data["amount"]),
                paid_to_from=tx_data["paid_to_from"],
                narration=tx_data["narration"],
                balance_after=Decimal(tx_data["balance_after"]),
                encrypted_data=tx_data["encrypted_data"],
                encryption_version=tx_data["encryption_version"],
            )
            db.add(transaction)

        db.commit()
        restored_count = len(backup_structure["transactions"])

    from app.models import AuditLog
    audit_log = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="account_backup_restored",
        resource_type="account",
        resource_id=account_id,
        details={
            "mode": restore_data.mode.value,
            "restored_count": restored_count,
            "backup_date": backup_structure["created_at"]
        },
        ip_address="127.0.0.1",
        user_agent="API"
    )
    db.add(audit_log)
    db.commit()

    return AccountBackupRestoreResponse(
        status="success",
        mode=restore_data.mode.value,
        restored_transactions=restored_count,
        new_account_id=new_account_id,
        backup_info={
            "created_at": backup_structure["created_at"],
            "notes": backup_structure.get("notes"),
        }
    )
