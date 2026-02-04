"""
Email Service for Organization Invitations
Handles sending invitation emails to new members
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime
import os

from app.config import settings


class EmailService:
    """Email service for sending notifications"""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_user)
        self.from_name = os.getenv("FROM_NAME", "Expense Tracker")
        self.enabled = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """Send an email via SMTP"""
        if not self.enabled:
            print(f"Email disabled. Would send to {to_email}: {subject}")
            return False

        if not self.smtp_user or not self.smtp_password:
            print("SMTP credentials not configured")
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            if text_body:
                part1 = MIMEText(text_body, 'plain')
                msg.attach(part1)

            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            return True

        except Exception as e:
            print(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def send_invitation(
        self,
        to_email: str,
        inviter_name: str,
        organization_name: str,
        role: str,
        token: str,
        message: Optional[str] = None,
        expires_at: datetime = None
    ) -> bool:
        """Send organization invitation email"""

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        invitation_url = f"{base_url}/invitations/{token}/accept"

        subject = f"You've been invited to join {organization_name}"

        text_body = f"""
Hello,

{inviter_name} has invited you to join the organization "{organization_name}" as a {role}.

{f'Personal message: {message}' if message else ''}

To accept this invitation, please click the link below or copy it to your browser:
{invitation_url}

This invitation will expire on {expires_at.strftime('%B %d, %Y at %I:%M %p') if expires_at else 'unknown date'}.

If you don't have an account yet, you'll be prompted to create one.

Best regards,
Expense Tracker Team
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 40px;
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #2c3e50;
            margin: 0;
            font-size: 24px;
        }}
        .content {{
            margin-bottom: 30px;
        }}
        .invitation-details {{
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
        }}
        .invitation-details p {{
            margin: 5px 0;
        }}
        .message-box {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: 600;
        }}
        .button:hover {{
            background-color: #0056b3;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 12px;
        }}
        .expiry {{
            color: #dc3545;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Organization Invitation</h1>
        </div>

        <div class="content">
            <p>Hello,</p>

            <p><strong>{inviter_name}</strong> has invited you to join their organization.</p>

            <div class="invitation-details">
                <p><strong>Organization:</strong> {organization_name}</p>
                <p><strong>Role:</strong> {role.capitalize()}</p>
            </div>

            {f'<div class="message-box"><p><strong>Personal message:</strong></p><p>{message}</p></div>' if message else ''}

            <p>Click the button below to accept this invitation:</p>

            <div style="text-align: center;">
                <a href="{invitation_url}" class="button">Accept Invitation</a>
            </div>

            <p style="font-size: 12px; color: #6c757d;">
                Or copy this link to your browser:<br>
                <a href="{invitation_url}">{invitation_url}</a>
            </p>

            {f'<p class="expiry">This invitation will expire on {expires_at.strftime("%B %d, %Y at %I:%M %p")}.</p>' if expires_at else ''}

            <p style="margin-top: 20px;">If you don't have an account yet, you'll be prompted to create one.</p>
        </div>

        <div class="footer">
            <p>This is an automated email from Expense Tracker.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
"""

        return self._send_email(to_email, subject, html_body, text_body)


email_service = EmailService()


def send_invitation_email(
    to_email: str,
    inviter_name: str,
    organization_name: str,
    role: str,
    token: str,
    message: Optional[str] = None,
    expires_at: datetime = None
) -> bool:
    """
    Send an invitation email to a new organization member.

    Args:
        to_email: Recipient email address
        inviter_name: Name of person sending invitation
        organization_name: Name of organization
        role: Role being granted (owner, admin, member, viewer)
        token: Invitation token for acceptance link
        message: Optional personal message
        expires_at: Invitation expiration datetime

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    return email_service.send_invitation(
        to_email=to_email,
        inviter_name=inviter_name,
        organization_name=organization_name,
        role=role,
        token=token,
        message=message,
        expires_at=expires_at
    )
