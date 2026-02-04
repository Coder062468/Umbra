"""
Background task scheduler for automated backups and maintenance.

This module provides automatic backup scheduling using APScheduler.
The scheduler runs as a background task within the FastAPI application.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import logging
import os
import subprocess

from app.database import SessionLocal
from app.models import SystemSettings, BackupMetadata, User
import uuid

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def create_backup_internal(db, notes: str = None):
    """
    Internal function to create a backup.
    Used by both API endpoint and scheduler.
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = f"expense_tracker_backup_{timestamp}.sql"
    backup_dir = "backups"

    os.makedirs(backup_dir, exist_ok=True)

    backup_path = os.path.join(backup_dir, backup_file)

    db_host = os.getenv("DB_HOST", "localhost")
    db_user = os.getenv("DB_USER", "expense_user")
    db_name = os.getenv("DB_NAME", "expense_tracker")
    db_password = os.getenv("DB_PASSWORD", "")

    env = os.environ.copy()
    if db_password:
        env["PGPASSWORD"] = db_password

    result = subprocess.run(
        [
            "pg_dump",
            "-h", db_host,
            "-U", db_user,
            "-d", db_name,
            "-f", backup_path,
            "-F", "p",
        ],
        capture_output=True,
        text=True,
        timeout=300,
        env=env
    )

    if result.returncode != 0:
        raise Exception(f"pg_dump failed: {result.stderr}")

    backup_size = os.path.getsize(backup_path)

    backup_metadata = BackupMetadata(
        id=uuid.uuid4(),
        backup_file=backup_file,
        backup_size=backup_size,
        backup_type="full",
        created_by=None,
        notes=notes or "Automatic scheduled backup"
    )

    db.add(backup_metadata)
    db.commit()
    db.refresh(backup_metadata)

    return backup_metadata


def scheduled_backup_task():
    """
    Automated backup task run by scheduler.
    """
    logger.info("Starting scheduled backup")

    db = SessionLocal()
    try:
        backup = create_backup_internal(db, notes="Automatic scheduled backup")
        logger.info(f"Scheduled backup completed: {backup.backup_file}")

        from app.models import SystemLog
        log = SystemLog(
            id=uuid.uuid4(),
            level="INFO",
            category="backup",
            message=f"Scheduled backup completed: {backup.backup_file}",
            details={
                "backup_id": str(backup.id),
                "backup_file": backup.backup_file,
                "size_bytes": backup.backup_size
            }
        )
        db.add(log)
        db.commit()

    except Exception as e:
        logger.error(f"Scheduled backup failed: {str(e)}")

        from app.models import SystemLog
        log = SystemLog(
            id=uuid.uuid4(),
            level="ERROR",
            category="backup",
            message=f"Scheduled backup failed: {str(e)}",
            details={"error": str(e)}
        )
        db.add(log)
        db.commit()

    finally:
        db.close()


def start_scheduler():
    """
    Start the background scheduler.
    Called from main.py on app startup.
    """
    if scheduler.running:
        logger.info("Scheduler already running")
        return

    db = SessionLocal()
    try:
        schedule_setting = db.query(SystemSettings).filter(
            SystemSettings.key == "backup_schedule"
        ).first()

        enabled_setting = db.query(SystemSettings).filter(
            SystemSettings.key == "backup_schedule_enabled"
        ).first()

        enabled = enabled_setting.value == "true" if enabled_setting else False

        if not enabled:
            logger.info("Backup scheduler is disabled")
            return

        if schedule_setting and schedule_setting.value:
            cron_expr = schedule_setting.value
        else:
            cron_expr = "0 2 * * *"

        parts = cron_expr.split()
        if len(parts) != 5:
            logger.error(f"Invalid cron expression: {cron_expr}")
            return

        trigger = CronTrigger(
            minute=parts[0],
            hour=parts[1],
            day=parts[2],
            month=parts[3],
            day_of_week=parts[4]
        )

        scheduler.add_job(
            scheduled_backup_task,
            trigger=trigger,
            id="scheduled_backup",
            replace_existing=True
        )

        scheduler.start()
        logger.info(f"Backup scheduler started with schedule: {cron_expr}")

    except Exception as e:
        logger.error(f"Failed to start scheduler: {str(e)}")
    finally:
        db.close()


def stop_scheduler():
    """
    Stop the scheduler.
    Called from main.py on app shutdown.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Backup scheduler stopped")


def restart_scheduler():
    """
    Restart the scheduler with updated configuration.
    Called when schedule settings are changed.
    """
    if scheduler.running:
        stop_scheduler()
    start_scheduler()
