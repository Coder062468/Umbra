"""
E2EE Backend Integration Tests
Tests the complete end-to-end encryption flow through the API endpoints

Fixtures (db_session, client) are provided by conftest.py
"""

from app.models import User, Account, Transaction


def test_complete_e2ee_flow(client):
    """Test the complete E2EE flow: register, login, create account, create/update transaction"""

    # 1. Register user with salt
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "salt": "dGVzdHNhbHQxMjM0NTY3OA=="  # base64-encoded "testsalt12345678"
    })
    assert response.status_code == 201
    assert "salt" not in response.json()  # salt not returned on register

    # 2. Login and get salt back
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["salt"] == "dGVzdHNhbHQxMjM0NTY3OA=="
    token = data["access_token"]

    # 3. Create encrypted account
    response = client.post("/api/accounts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "encrypted_data": "fake_encrypted_account_blob",
            "encrypted_dek": "fake_wrapped_dek",
            "currency": "INR",
            "encryption_version": 1
        }
    )
    assert response.status_code == 201
    account = response.json()
    assert account["encrypted_data"] == "fake_encrypted_account_blob"
    assert account["encryption_version"] == 1
    assert "name" not in account  # plaintext field NOT in response
    assert "opening_balance" not in account
    account_id = account["id"]

    # 4. Create encrypted transaction
    response = client.post("/api/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "account_id": account_id,
            "date": "2026-02-02",
            "encrypted_data": "fake_encrypted_transaction_blob",
            "encryption_version": 1
        }
    )
    assert response.status_code == 201
    txn = response.json()
    assert txn["encrypted_data"] == "fake_encrypted_transaction_blob"
    assert "amount" not in txn  # plaintext field NOT returned
    assert "paid_to_from" not in txn
    assert "balance_after" not in txn

    # 5. Fetch transactions - verify they come back encrypted
    response = client.get(f"/api/transactions?account_id={account_id}",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["transactions"]) == 1
    assert data["transactions"][0]["encrypted_data"] == "fake_encrypted_transaction_blob"

    # 6. Update transaction - verify encrypted payload accepted
    txn_id = txn["id"]
    response = client.put(f"/api/transactions/{txn_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "encrypted_data": "fake_updated_encrypted_blob"
        }
    )
    assert response.status_code == 200
    updated_txn = response.json()
    assert updated_txn["encrypted_data"] == "fake_updated_encrypted_blob"
    assert "amount" not in updated_txn


def test_database_contains_encrypted_data(client, db_session):
    """Verify that the database actually contains encrypted blobs, not plaintext"""

    # Create user with E2EE data
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "salt": "dGVzdHNhbHQxMjM0NTY3OA=="
    })
    assert response.status_code == 201

    # Login
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    token = response.json()["access_token"]

    # Create encrypted account
    response = client.post("/api/accounts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "encrypted_data": "account_blob_xyz",
            "encrypted_dek": "wrapped_dek_abc",
            "currency": "USD",
            "encryption_version": 1
        }
    )
    account_id = response.json()["id"]

    # Create encrypted transaction
    client.post("/api/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "account_id": account_id,
            "date": "2026-02-02",
            "encrypted_data": "transaction_blob_123",
            "encryption_version": 1
        }
    )

    # Query DB directly to verify encryption
    user = db_session.query(User).filter_by(email="test@example.com").first()
    assert user.salt is not None  # PBKDF2 salt stored
    assert user.salt == "dGVzdHNhbHQxMjM0NTY3OA=="

    account = db_session.query(Account).filter_by(user_id=user.id).first()
    assert account.encrypted_data is not None
    assert account.encrypted_data == "account_blob_xyz"
    assert account.encrypted_dek is not None
    assert account.encrypted_dek == "wrapped_dek_abc"
    assert account.encryption_version == 1
    # Legacy plaintext columns should be null for E2EE rows
    assert account.name is None
    assert account.opening_balance is None

    txn = db_session.query(Transaction).filter_by(account_id=account.id).first()
    assert txn.encrypted_data is not None
    assert txn.encrypted_data == "transaction_blob_123"
    assert txn.encryption_version == 1
    assert txn.amount is None  # plaintext field null
    assert txn.paid_to_from is None
    assert txn.balance_after is None


def test_registration_requires_salt(client):
    """Verify that registration requires a salt for E2EE"""
    response = client.post("/api/auth/register", json={
        "email": "nosalt@example.com",
        "password": "testpass123"
        # Missing salt field
    })
    # E2EE requires salt - registration should fail without it
    assert response.status_code == 422  # Validation error


def test_login_returns_salt(client):
    """Verify that login endpoint returns the user's salt"""
    # Register with salt
    client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "salt": "c2FsdHlzYWx0MTIzNDU2Nzg="
    })

    # Login should return salt
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "salt" in data
    assert data["salt"] == "c2FsdHlzYWx0MTIzNDU2Nzg="
    assert "access_token" in data


def test_encrypted_transaction_list_response(client):
    """Verify transaction list responses don't leak plaintext"""
    # Setup
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "salt": "dGVzdHNhbHQ="
    })

    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    token = response.json()["access_token"]

    response = client.post("/api/accounts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "encrypted_data": "blob",
            "encrypted_dek": "dek",
            "currency": "EUR",
            "encryption_version": 1
        }
    )
    account_id = response.json()["id"]

    # Create 3 encrypted transactions
    for i in range(3):
        client.post("/api/transactions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "account_id": account_id,
                "date": f"2026-02-0{i+1}",
                "encrypted_data": f"txn_blob_{i}",
                "encryption_version": 1
            }
        )

    # Fetch list
    response = client.get(f"/api/transactions?account_id={account_id}",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    data = response.json()
    assert len(data["transactions"]) == 3

    # Verify none of the transactions contain plaintext
    for txn in data["transactions"]:
        assert "encrypted_data" in txn
        assert "amount" not in txn
        assert "paid_to_from" not in txn
        assert "narration" not in txn
        assert "balance_after" not in txn
