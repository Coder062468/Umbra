"""
System Administration Routes

Provides system-level monitoring and management capabilities.
Only accessible to users with is_system_admin=True.

Security Model:
  - System admin cannot decrypt user data (respects E2EE)
  - All operations logged to system_logs
  - Separate from organization-level admin
  - Statistics and monitoring only

Endpoints:
  - GET  /stats              - System statistics
  - GET  /users              - List all users
  - PUT  /users/{id}/admin   - Toggle system admin
  - GET  /organizations      - List all organizations
  - GET  /logs               - System logs
  - DELETE /logs/cleanup     - Cleanup old logs
  - GET  /settings           - System settings
  - PUT  /settings/{key}     - Update setting
  - POST /backup             - Create backup
  - GET  /backups            - List backups
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from datetime import datetime, timedelta
import os
import subprocess

from app.database import get_db
from app.models import (
    User, Organization, OrganizationMember, Account, Transaction,
    SystemLog, SystemSettings, BackupMetadata, UserActivity
)
from app.dependencies import get_system_admin
from app.schemas import (
    SystemStatsResponse, UserStatsResponse, OrganizationStatsResponse,
    SystemLogResponse, SystemLogListResponse, SystemSettingResponse,
    SystemSettingUpdate, BackupMetadataResponse, BackupCreateResponse
)

router = APIRouter(prefix="/api/admin", tags=["System Administration"])


# System Logging Utility


def log_system_event(
    db: Session,
    level: str,
    category: str,
    message: str,
    details: dict = None
) -> SystemLog:
    """
    Create a system log entry.

    Args:
        db: Database session
        level: Log level (INFO, WARNING, ERROR, CRITICAL)
        category: Log category (auth, database, backup, system, admin)
        message: Log message
        details: Additional details as JSON

    Returns:
        Created SystemLog instance
    """
    log = SystemLog(
        level=level.upper(),
        category=category,
        message=message,
        details=details or {}
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# Dashboard & Statistics


@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Get system-wide statistics.

    Returns aggregate counts and metrics without exposing encrypted data.
    Safe for system monitoring and capacity planning.

    Requires: System admin privileges

    Returns:
        SystemStatsResponse: System statistics including user counts,
                            active users, database size, and averages
    """
    total_users = db.query(func.count(User.id)).scalar() or 0

    total_orgs = db.query(func.count(Organization.id)).filter(
        Organization.deleted_at.is_(None)
    ).scalar() or 0

    total_accounts = db.query(func.count(Account.id)).filter(
        Account.deleted_at.is_(None)
    ).scalar() or 0

    total_transactions = db.query(func.count(Transaction.id)).filter(
        Transaction.deleted_at.is_(None)
    ).scalar() or 0

    # Active users calculations
    now = datetime.utcnow()
    today = now - timedelta(days=1)
    week = now - timedelta(days=7)
    month = now - timedelta(days=30)

    active_today = db.query(func.count(User.id)).filter(
        User.last_login_at >= today
    ).scalar() or 0

    active_week = db.query(func.count(User.id)).filter(
        User.last_login_at >= week
    ).scalar() or 0

    active_month = db.query(func.count(User.id)).filter(
        User.last_login_at >= month
    ).scalar() or 0

    # Database size (PostgreSQL specific)
    try:
        db_size_result = db.execute(
            "SELECT pg_database_size(current_database()) / (1024.0 * 1024.0) as size_mb"
        )
        database_size_mb = float(db_size_result.scalar() or 0)
    except Exception:
        database_size_mb = 0.0

    # Calculate averages
    avg_transactions = float(total_transactions) / max(total_users, 1)
    avg_accounts = float(total_accounts) / max(total_orgs, 1)

    return SystemStatsResponse(
        total_users=total_users,
        total_organizations=total_orgs,
        total_accounts=total_accounts,
        total_transactions=total_transactions,
        active_users_today=active_today,
        active_users_week=active_week,
        active_users_month=active_month,
        database_size_mb=round(database_size_mb, 2),
        avg_transactions_per_user=round(avg_transactions, 2),
        avg_accounts_per_org=round(avg_accounts, 2)
    )


# User Management


@router.get("/users", response_model=List[UserStatsResponse])
async def list_all_users(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """
    List all users with statistics.

    Does not expose encrypted data, only aggregate counts and metadata.
    Useful for user management and support.

    Requires: System admin privileges

    Args:
        page: Page number (1-indexed)
        page_size: Number of users per page (max 100)

    Returns:
        List[UserStatsResponse]: List of users with statistics
    """
    offset = (page - 1) * page_size

    users = db.query(User).order_by(
        desc(User.created_at)
    ).offset(offset).limit(page_size).all()

    result = []
    for user in users:
        # Count organizations
        org_count = db.query(func.count(OrganizationMember.id)).filter(
            OrganizationMember.user_id == user.id
        ).scalar() or 0

        # Count accounts
        account_count = db.query(func.count(Account.id)).filter(
            Account.user_id == user.id,
            Account.deleted_at.is_(None)
        ).scalar() or 0

        # Count transactions
        transaction_count = db.query(func.count(Transaction.id)).join(
            Account, Account.id == Transaction.account_id
        ).filter(
            Account.user_id == user.id,
            Transaction.deleted_at.is_(None)
        ).scalar() or 0

        result.append(UserStatsResponse(
            id=user.id,
            email=user.email,
            is_system_admin=user.is_system_admin,
            organization_count=org_count,
            account_count=account_count,
            transaction_count=transaction_count,
            last_login_at=user.last_login_at,
            login_count=user.login_count,
            created_at=user.created_at
        ))

    return result


@router.put("/users/{user_id}/admin")
async def toggle_system_admin(
    user_id: str,
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Toggle system administrator status for a user.

    Grants or revokes system admin privileges. This action is logged.

    Requires: System admin privileges

    Args:
        user_id: User ID to modify

    Returns:
        dict: User ID and new admin status

    Raises:
        HTTPException: 404 if user not found
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Toggle admin status
    user.is_system_admin = not user.is_system_admin

    # Log the action
    log_system_event(
        db=db,
        level="INFO",
        category="admin",
        message=f"System admin status {'granted to' if user.is_system_admin else 'revoked from'} user {user.email}",
        details={
            "user_id": str(user.id),
            "is_admin": user.is_system_admin,
            "changed_by": str(current_admin.id),
            "changed_by_email": current_admin.email
        }
    )

    db.commit()

    return {
        "user_id": str(user.id),
        "is_system_admin": user.is_system_admin
    }


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Permanently delete a user and all associated data.

    This will CASCADE delete:
    - All user's accounts (personal and organization-owned)
    - All transactions in those accounts
    - Organization memberships
    - User activity logs
    - All encrypted data

    WARNING: This operation is irreversible and respects E2EE
    (admin cannot recover encrypted data).

    Requires: System admin privileges

    Args:
        user_id: User ID to delete

    Raises:
        HTTPException: 404 if user not found
        HTTPException: 403 if trying to delete yourself
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from deleting themselves
    if str(user.id) == str(current_admin.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete your own account"
        )

    user_email = user.email
    user_uuid = str(user.id)

    # Count data before deletion for logging
    account_count = db.query(func.count(Account.id)).filter(
        Account.user_id == user.id
    ).scalar() or 0

    org_count = db.query(func.count(OrganizationMember.id)).filter(
        OrganizationMember.user_id == user.id
    ).scalar() or 0

    # Log the deletion BEFORE deleting the user
    log_system_event(
        db=db,
        level="WARNING",
        category="admin",
        message=f"User {user_email} deleted by system admin",
        details={
            "deleted_user_id": user_uuid,
            "deleted_user_email": user_email,
            "accounts_deleted": account_count,
            "org_memberships_deleted": org_count,
            "deleted_by": str(current_admin.id),
            "deleted_by_email": current_admin.email
        }
    )

    # Delete the user (CASCADE will handle related data)
    db.delete(user)
    db.commit()

    return None


# Organization Management


@router.get("/organizations", response_model=List[OrganizationStatsResponse])
async def list_all_organizations(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """
    List all organizations with statistics.

    Does not expose encrypted organization data, only counts and metadata.
    Useful for monitoring organization activity and storage usage.

    Requires: System admin privileges

    Args:
        page: Page number (1-indexed)
        page_size: Number of organizations per page (max 100)

    Returns:
        List[OrganizationStatsResponse]: List of organizations with statistics
    """
    offset = (page - 1) * page_size

    orgs = db.query(Organization).filter(
        Organization.deleted_at.is_(None)
    ).order_by(
        desc(Organization.created_at)
    ).offset(offset).limit(page_size).all()

    result = []
    for org in orgs:
        # Count members
        member_count = db.query(func.count(OrganizationMember.id)).filter(
            OrganizationMember.organization_id == org.id
        ).scalar() or 0

        # Count accounts
        account_count = db.query(func.count(Account.id)).filter(
            Account.organization_id == org.id,
            Account.deleted_at.is_(None)
        ).scalar() or 0

        # Count transactions
        transaction_count = db.query(func.count(Transaction.id)).join(
            Account, Account.id == Transaction.account_id
        ).filter(
            Account.organization_id == org.id,
            Transaction.deleted_at.is_(None)
        ).scalar() or 0

        # Estimate storage (rough calculation)
        storage_mb = (
            (account_count * 1.0) +  # ~1KB per account
            (transaction_count * 0.5)  # ~0.5KB per transaction
        ) / 1024.0

        # Get last activity
        last_activity = db.query(func.max(UserActivity.created_at)).filter(
            UserActivity.organization_id == org.id
        ).scalar()

        result.append(OrganizationStatsResponse(
            id=org.id,
            name=org.name,
            member_count=member_count,
            account_count=account_count,
            transaction_count=transaction_count,
            storage_used_mb=round(storage_mb, 2),
            created_at=org.created_at,
            last_activity=last_activity
        ))

    return result


# System Logs


@router.get("/logs", response_model=SystemLogListResponse)
async def get_system_logs(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db),
    level: Optional[str] = Query(None, description="Filter by log level"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500)
):
    """
    Get system logs with optional filtering.

    Allows monitoring system events, errors, and admin actions.

    Requires: System admin privileges

    Args:
        level: Filter by log level (INFO, WARNING, ERROR, CRITICAL)
        category: Filter by category (auth, database, backup, system, admin)
        page: Page number (1-indexed)
        page_size: Number of logs per page (max 500)

    Returns:
        SystemLogListResponse: Paginated list of system logs
    """
    query = db.query(SystemLog)

    # Apply filters
    if level:
        query = query.filter(SystemLog.level == level.upper())

    if category:
        query = query.filter(SystemLog.category == category)

    # Get total count
    total = query.count()

    # Get paginated results
    offset = (page - 1) * page_size
    logs = query.order_by(
        desc(SystemLog.created_at)
    ).offset(offset).limit(page_size).all()

    return SystemLogListResponse(
        logs=[SystemLogResponse.from_orm(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/logs/cleanup")
async def cleanup_old_logs(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db),
    days_old: int = Query(90, ge=1, le=365, description="Delete logs older than this many days")
):
    """
    Delete system logs older than specified days.

    Useful for managing database size and complying with data retention policies.

    Requires: System admin privileges

    Args:
        days_old: Delete logs older than this many days (1-365)

    Returns:
        dict: Number of deleted log entries
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_old)

    deleted_count = db.query(SystemLog).filter(
        SystemLog.created_at < cutoff_date
    ).delete()

    db.commit()

    # Log the cleanup action
    log_system_event(
        db=db,
        level="INFO",
        category="system",
        message=f"Cleaned up {deleted_count} system log entries older than {days_old} days",
        details={
            "days_old": days_old,
            "deleted_count": deleted_count,
            "performed_by": str(current_admin.id)
        }
    )

    return {"deleted_count": deleted_count}


# System Settings


@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_system_settings(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Get all system settings.

    Returns configurable system parameters.

    Requires: System admin privileges

    Returns:
        List[SystemSettingResponse]: List of all system settings
    """
    settings = db.query(SystemSettings).all()
    return [SystemSettingResponse.from_orm(s) for s in settings]


@router.put("/settings/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    data: SystemSettingUpdate,
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Update or create a system setting.

    Allows configuration of system parameters. This action is logged.

    Requires: System admin privileges

    Args:
        key: Setting key
        data: Setting value and description

    Returns:
        SystemSettingResponse: Updated setting
    """
    setting = db.query(SystemSettings).filter(
        SystemSettings.key == key
    ).first()

    if setting:
        # Update existing setting
        setting.value = data.value
        if data.description is not None:
            setting.description = data.description
        setting.updated_by = current_admin.id
        setting.updated_at = datetime.utcnow()
    else:
        # Create new setting
        setting = SystemSettings(
            key=key,
            value=data.value,
            description=data.description,
            updated_by=current_admin.id
        )
        db.add(setting)

    db.commit()
    db.refresh(setting)

    # Log the action
    log_system_event(
        db=db,
        level="INFO",
        category="settings",
        message=f"System setting updated: {key}",
        details={
            "key": key,
            "updated_by": str(current_admin.id)
        }
    )

    return SystemSettingResponse.from_orm(setting)


# Backup Management


@router.post("/backup", response_model=BackupCreateResponse)
async def create_backup(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Create a database backup.

    Creates a PostgreSQL dump of the entire database and stores metadata.
    Backup files are stored in the 'backups' directory.

    Note: This implementation assumes PostgreSQL and requires pg_dump to be available.
    For production, consider using managed backup solutions.

    Requires: System admin privileges

    Returns:
        BackupCreateResponse: Backup details

    Raises:
        HTTPException: 500 if backup fails
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = f"expense_tracker_backup_{timestamp}.sql"
    backup_path = os.path.join("backups", backup_file)

    try:
        # Create backups directory if not exists
        os.makedirs("backups", exist_ok=True)

        # Read database connection details from environment or config
        db_host = os.getenv("DB_HOST", "localhost")
        db_user = os.getenv("DB_USER", "expense_user")
        db_name = os.getenv("DB_NAME", "expense_tracker")

        # Run pg_dump
        result = subprocess.run(
            [
                "pg_dump",
                "-h", db_host,
                "-U", db_user,
                "-d", db_name,
                "-f", backup_path,
                "--no-password"
            ],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")

        # Get file size
        backup_size = os.path.getsize(backup_path)

        # Create metadata record
        backup_meta = BackupMetadata(
            backup_file=backup_file,
            backup_size=backup_size,
            backup_type="full",
            created_by=current_admin.id,
            notes="Manual backup via admin panel"
        )
        db.add(backup_meta)

        # Log the action
        log_system_event(
            db=db,
            level="INFO",
            category="backup",
            message=f"Database backup created: {backup_file}",
            details={
                "backup_file": backup_file,
                "size_bytes": backup_size,
                "created_by": str(current_admin.id)
            }
        )

        db.commit()

        return BackupCreateResponse(
            backup_file=backup_file,
            backup_size=backup_size,
            status="success",
            message=f"Backup created successfully: {backup_file}"
        )

    except subprocess.TimeoutExpired:
        log_system_event(
            db=db,
            level="ERROR",
            category="backup",
            message="Backup failed: Operation timed out",
            details={"error": "timeout"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Backup operation timed out"
        )

    except Exception as e:
        log_system_event(
            db=db,
            level="ERROR",
            category="backup",
            message=f"Backup failed: {str(e)}",
            details={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup failed: {str(e)}"
        )


@router.get("/backups", response_model=List[BackupMetadataResponse])
async def list_backups(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    List all database backups.

    Returns metadata for all backups created through the admin panel.

    Requires: System admin privileges

    Returns:
        List[BackupMetadataResponse]: List of backup metadata
    """
    backups = db.query(BackupMetadata).order_by(
        desc(BackupMetadata.created_at)
    ).all()

    return [BackupMetadataResponse.from_orm(b) for b in backups]


@router.post("/backup/restore/{backup_id}")
async def restore_backup(
    backup_id: str,
    confirmation: str = Body(..., embed=True),
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Restore database from backup.

    DANGER: This will DROP and RECREATE all tables!
    Requires explicit confirmation string.

    Args:
        backup_id: ID of the backup to restore
        confirmation: Must be exactly "RESTORE" to confirm

    Requires: System admin privileges

    Returns:
        dict: Restore status and timestamp
    """
    if confirmation != "RESTORE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation string must be 'RESTORE'"
        )

    backup = db.query(BackupMetadata).filter(
        BackupMetadata.id == backup_id
    ).first()

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found"
        )

    backup_path = os.path.join("backups", backup.backup_file)

    if not os.path.exists(backup_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found on disk"
        )

    log_system_event(
        db=db,
        level="WARNING",
        category="backup",
        message=f"Restore initiated by {current_admin.email}",
        details={
            "backup_id": str(backup_id),
            "backup_file": backup.backup_file,
            "admin": str(current_admin.id)
        }
    )

    try:
        db_host = os.getenv("DB_HOST", "localhost")
        db_user = os.getenv("DB_USER", "expense_user")
        db_name = os.getenv("DB_NAME", "expense_tracker")
        db_password = os.getenv("DB_PASSWORD", "")

        env = os.environ.copy()
        if db_password:
            env["PGPASSWORD"] = db_password

        db.close()

        result = subprocess.run(
            [
                "psql",
                "-h", db_host,
                "-U", db_user,
                "-d", "postgres",
                "-c", f"DROP DATABASE IF EXISTS {db_name}",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            env=env
        )

        if result.returncode != 0:
            raise Exception(f"Failed to drop database: {result.stderr}")

        result = subprocess.run(
            [
                "psql",
                "-h", db_host,
                "-U", db_user,
                "-d", "postgres",
                "-c", f"CREATE DATABASE {db_name}",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            env=env
        )

        if result.returncode != 0:
            raise Exception(f"Failed to create database: {result.stderr}")

        result = subprocess.run(
            [
                "psql",
                "-h", db_host,
                "-U", db_user,
                "-d", db_name,
                "-f", backup_path,
            ],
            capture_output=True,
            text=True,
            timeout=600,
            env=env
        )

        if result.returncode != 0:
            raise Exception(f"Restore failed: {result.stderr}")

        backup.restored_at = datetime.utcnow()
        db.commit()

        log_system_event(
            db=db,
            level="INFO",
            category="backup",
            message=f"Database successfully restored from {backup.backup_file}",
            details={
                "backup_id": str(backup_id),
                "backup_file": backup.backup_file,
                "restored_by": str(current_admin.id)
            }
        )

        return {
            "status": "success",
            "message": f"Database restored from {backup.backup_file}",
            "restored_at": backup.restored_at
        }

    except Exception as e:
        log_system_event(
            db=db,
            level="ERROR",
            category="backup",
            message=f"Restore failed: {str(e)}",
            details={"error": str(e), "backup_id": str(backup_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restore failed: {str(e)}"
        )


@router.get("/backup/download/{backup_id}")
async def download_backup(
    backup_id: str,
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Download a backup file.

    Returns the backup file as a downloadable attachment.
    Large files may take time to download.

    Args:
        backup_id: ID of the backup to download

    Requires: System admin privileges

    Returns:
        FileResponse: The backup file
    """
    backup = db.query(BackupMetadata).filter(
        BackupMetadata.id == backup_id
    ).first()

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found"
        )

    backup_path = os.path.join("backups", backup.backup_file)

    if not os.path.exists(backup_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found on disk"
        )

    log_system_event(
        db=db,
        level="INFO",
        category="backup",
        message=f"Backup downloaded by {current_admin.email}",
        details={
            "backup_id": str(backup_id),
            "backup_file": backup.backup_file,
            "admin": str(current_admin.id)
        }
    )

    return FileResponse(
        backup_path,
        media_type='application/sql',
        filename=backup.backup_file,
        headers={
            "Content-Disposition": f"attachment; filename={backup.backup_file}"
        }
    )


@router.get("/backup/schedule")
async def get_backup_schedule(
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Get current backup schedule.

    Returns the cron expression for automatic backups.

    Requires: System admin privileges

    Returns:
        dict: Schedule configuration and description
    """
    setting = db.query(SystemSettings).filter(
        SystemSettings.key == "backup_schedule"
    ).first()

    enabled_setting = db.query(SystemSettings).filter(
        SystemSettings.key == "backup_schedule_enabled"
    ).first()

    return {
        "schedule": setting.value if setting else "0 2 * * *",
        "enabled": enabled_setting.value == "true" if enabled_setting else False,
        "description": "Cron expression (minute hour day month day_of_week)"
    }


@router.put("/backup/schedule")
async def update_backup_schedule(
    schedule: str = Body(..., embed=True),
    enabled: bool = Body(True, embed=True),
    current_admin: User = Depends(get_system_admin),
    db: Session = Depends(get_db)
):
    """
    Update backup schedule.

    Updates the cron expression for automatic backups.

    Args:
        schedule: Cron expression (5 parts separated by spaces)
        enabled: Whether automatic backups are enabled

    Requires: System admin privileges

    Returns:
        dict: Updated schedule status
    """
    try:
        parts = schedule.split()
        if len(parts) != 5:
            raise ValueError("Cron expression must have 5 parts")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cron expression. Must be 5 parts: minute hour day month day_of_week"
        )

    schedule_setting = db.query(SystemSettings).filter(
        SystemSettings.key == "backup_schedule"
    ).first()

    if schedule_setting:
        schedule_setting.value = schedule
        schedule_setting.updated_by = current_admin.id
        schedule_setting.updated_at = datetime.utcnow()
    else:
        schedule_setting = SystemSettings(
            key="backup_schedule",
            value=schedule,
            description="Backup schedule (cron expression)",
            category="backup",
            updated_by=current_admin.id
        )
        db.add(schedule_setting)

    enabled_setting = db.query(SystemSettings).filter(
        SystemSettings.key == "backup_schedule_enabled"
    ).first()

    if enabled_setting:
        enabled_setting.value = "true" if enabled else "false"
        enabled_setting.updated_by = current_admin.id
        enabled_setting.updated_at = datetime.utcnow()
    else:
        enabled_setting = SystemSettings(
            key="backup_schedule_enabled",
            value="true" if enabled else "false",
            description="Whether automatic backups are enabled",
            category="backup",
            updated_by=current_admin.id
        )
        db.add(enabled_setting)

    db.commit()

    log_system_event(
        db=db,
        level="INFO",
        category="backup",
        message=f"Backup schedule updated by {current_admin.email}",
        details={
            "schedule": schedule,
            "enabled": enabled,
            "admin": str(current_admin.id)
        }
    )

    from app.scheduler import restart_scheduler
    restart_scheduler()

    return {
        "status": "success",
        "schedule": schedule,
        "enabled": enabled
    }
