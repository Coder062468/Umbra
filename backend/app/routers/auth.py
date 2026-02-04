"""
Authentication Routes
User registration and login endpoints

E2E Key Derivation Flow:
  REGISTER:
    1. Client generates random 16-byte salt, base64-encodes it
    2. Client sends { email, password, salt } to this endpoint
    3. Server hashes password (bcrypt) and stores salt verbatim
    4. Client derives masterKey = PBKDF2(password, salt) LOCALLY — never sent here

  LOGIN:
    1. Client sends { email, password }
    2. Server verifies bcrypt hash, returns { access_token, salt }
    3. Client re-derives masterKey = PBKDF2(password, salt) LOCALLY
    4. masterKey is held in browser memory for the session
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import User, Organization, OrganizationMember
from app.dependencies import get_current_user
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import get_password_hash, verify_password, create_access_token
from app.utils.permissions import log_audit

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user with automatic default organization creation.

    Workflow:
    1. Validate email uniqueness
    2. Create user account with bcrypt-hashed password
    3. Auto-create default organization (named after user email)
    4. Make user the owner of the organization
    5. Log audit trail

    Security:
    - Password hashed with bcrypt (authentication layer)
    - Salt stored for client-side PBKDF2 master key derivation (E2EE layer)
    - Organization key wrapped with user's master key (E2EE layer)
    - All operations atomic (rollback on failure)
    """
    # Duplicate email check
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    try:
        # Create user account
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=user_data.email,
            password_hash=hashed_password,
            salt=user_data.salt,
            public_key=user_data.public_key
        )
        db.add(new_user)
        db.flush()  # Get user ID without committing transaction

        # Auto-create default organization
        # Use email prefix as organization name (e.g., "john@example.com" -> "john's Organization")
        email_prefix = user_data.email.split('@')[0]
        org_name = f"{email_prefix}'s Organization"

        default_org = Organization(
            name=org_name,
            description="Default organization created on signup",
            created_by=new_user.id
        )
        db.add(default_org)
        db.flush()  # Get organization ID

        # Add user as owner of the organization
        org_member = OrganizationMember(
            organization_id=default_org.id,
            user_id=new_user.id,
            role="owner",
            wrapped_org_key=user_data.wrapped_org_key
        )
        db.add(org_member)

        # Commit transaction
        db.commit()
        db.refresh(new_user)

        # Audit log (non-critical, fire-and-forget)
        try:
            log_audit(
                db=db,
                user_id=str(new_user.id),
                organization_id=str(default_org.id),
                action="user_registered",
                resource_type="user",
                resource_id=str(new_user.id),
                details={
                    "email": new_user.email,
                    "default_org_created": True,
                    "org_name": org_name
                },
                request=request
            )
        except Exception as audit_error:
            # Log audit failure but don't fail registration
            print(f"Warning: Audit log failed for user registration: {audit_error}")

        return new_user

    except Exception as e:
        db.rollback()
        # Re-raise if it's already an HTTPException
        if isinstance(e, HTTPException):
            raise
        # Otherwise wrap in 500 error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate and return JWT + salt.
    Client uses the salt to re-derive the master encryption key locally.

    Also tracks login activity for admin statistics:
    - Updates last_login_at timestamp
    - Increments login_count
    """
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Track login activity for admin statistics
    user.last_login_at = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    db.commit()

    access_token = create_access_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "salt": user.salt                # E2E: client needs this for PBKDF2 derivation
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.get("/public-key/{email}")
async def get_user_public_key(
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a user's public key by email (for E2EE invitation key wrapping).

    This endpoint allows authenticated users to fetch another user's public key,
    which is safe to expose publicly (it can only encrypt, not decrypt).
    Used by organization owners/admins when creating invitations to wrap the
    organization key for the invitee.

    Returns:
        { "email": str, "public_key": str | null }

    Security:
        - Requires authentication (only logged-in users can fetch keys)
        - Public keys are safe to expose (asymmetric encryption property)
        - Returns null if user doesn't exist or hasn't generated a public key yet
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return {
            "email": email,
            "public_key": None
        }

    return {
        "email": email,
        "public_key": user.public_key
    }


@router.post("/update-public-key")
async def update_public_key(
    public_key_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the current user's public key.

    Used when existing users (who registered before RSA keys were implemented)
    log in and need to generate/store their public key.

    Request body:
        { "public_key": str }

    Security:
        - Only updates current user's own public key
        - Requires valid authentication token
    """
    public_key = public_key_data.get("public_key")

    if not public_key or not isinstance(public_key, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="public_key is required and must be a string"
        )

    current_user.public_key = public_key
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": "Public key updated successfully"
    }


@router.post("/store-encrypted-private-key")
async def store_encrypted_private_key(
    key_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Store the user's encrypted RSA private key.

    The private key is encrypted client-side with the user's master key (AES-GCM)
    before being sent to the server. This maintains E2EE while allowing persistent
    RSA key storage across sessions.

    Request body:
        {
            "encrypted_private_key": str,
            "public_key": str
        }

    Security:
        - Private key is encrypted client-side with master key before upload
        - Server stores encrypted blob but cannot decrypt it
        - Only the user with correct password can derive master key and decrypt
        - Atomic update of both public and encrypted private key
        - Requires valid authentication token

    Workflow:
        1. Client generates RSA key pair (first time or key rotation)
        2. Client encrypts private key with master key (AES-GCM)
        3. Client sends encrypted_private_key + public_key to this endpoint
        4. Server stores both atomically
        5. On future logins, client retrieves and decrypts private key
    """
    encrypted_private_key = key_data.get("encrypted_private_key")
    public_key = key_data.get("public_key")

    if not encrypted_private_key or not isinstance(encrypted_private_key, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="encrypted_private_key is required and must be a string"
        )

    if not public_key or not isinstance(public_key, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="public_key is required and must be a string"
        )

    try:
        current_user.encrypted_private_key = encrypted_private_key
        current_user.public_key = public_key
        db.commit()
        db.refresh(current_user)

        return {
            "status": "success",
            "message": "Encrypted private key stored successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store encrypted private key: {str(e)}"
        )


@router.get("/encrypted-private-key")
async def get_encrypted_private_key(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve the user's encrypted RSA private key.

    Returns the encrypted private key blob that was previously stored.
    The client decrypts it with their master key (derived from password + salt).

    Returns:
        {
            "encrypted_private_key": str | null,
            "public_key": str | null
        }

    Security:
        - Only returns current user's own encrypted private key
        - Requires valid authentication token
        - Server cannot decrypt the private key (encrypted with master key)
        - Returns null if user hasn't stored encrypted private key yet

    Workflow:
        1. Client logs in and derives master key from password + salt
        2. Client calls this endpoint to fetch encrypted_private_key
        3. Client decrypts private key with master key
        4. Client uses decrypted private key for session (RSA operations)
    """
    return {
        "encrypted_private_key": current_user.encrypted_private_key,
        "public_key": current_user.public_key
    }
