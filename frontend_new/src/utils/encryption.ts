/**
 * E2E Encryption Utilities
 * ========================
 * All cryptographic operations for the expense tracker.
 * Uses the browser's native Web Crypto API — no third-party crypto libraries.
 *
 * Key Hierarchy:
 *   User Password + Salt
 *         │
 *         ▼  PBKDF2 (600 000 iterations, SHA-256)
 *   Master Key  (256-bit AES key — lives in memory only, NEVER sent to server)
 *         │
 *         ▼  AES-256-GCM wraps
 *   DEK per account  (256-bit random key — encrypted copy stored on server)
 *         │
 *         ▼  AES-256-GCM encrypts
 *   Transaction / Account payloads  (stored as base64 blobs on server)
 *
 * Ciphertext wire format (base64-encoded):
 *   [ IV — 12 bytes ][ Ciphertext + GCM Auth Tag — variable ]
 */

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000;
const IV_BYTE_LENGTH   = 12;   // Standard IV size for AES-GCM
const SALT_BYTE_LENGTH = 16;   // 128-bit random salt

// ──────────────────────────────────────────────────────────
// Base64 helpers
// ──────────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ──────────────────────────────────────────────────────────
// Salt generation
// ──────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 16-byte salt, returned as base64.
 * Call once at registration time; store the result on the server.
 */
export function generateSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH)))
}

// ──────────────────────────────────────────────────────────
// Master Key derivation (PBKDF2)
// ──────────────────────────────────────────────────────────

/**
 * Derive a 256-bit master key from the user's password and their stored salt.
 * Returns raw key bytes (ArrayBuffer).  These stay in memory and are NEVER
 * transmitted to the server.
 *
 * Cost: ~300 ms on modern hardware at 600 000 iterations.
 */
export async function deriveMasterKey(password: string, saltBase64: string): Promise<ArrayBuffer> {
  const enc  = new TextEncoder()
  const salt = base64ToBytes(saltBase64)

  // Import password as raw PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,                        // not extractable
    ['deriveBits']                // only used to derive bits
  )

  // Derive 256 bits
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256   // output length in bits
  )
}

// ──────────────────────────────────────────────────────────
// DEK (Data Encryption Key) generation
// ──────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 256-bit DEK.
 * One DEK is created per account and used to encrypt all of that account's data.
 */
export function generateDEK(): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(32)).buffer
}

// ──────────────────────────────────────────────────────────
// AES-256-GCM encrypt / decrypt
// ──────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64 string: [ 12-byte IV ][ ciphertext + 16-byte auth tag ]
 */
export async function encrypt(keyBuffer: ArrayBuffer, plaintext: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, 'AES-GCM', false, ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))
  const enc = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    enc.encode(plaintext)
  )

  // Concatenate IV + ciphertext into one buffer
  const combined = new Uint8Array(IV_BYTE_LENGTH + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), IV_BYTE_LENGTH)

  return bytesToBase64(combined)
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext back to a plaintext string.
 * Throws on authentication failure (tampered or wrong key).
 */
export async function decrypt(keyBuffer: ArrayBuffer, ciphertextBase64: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, 'AES-GCM', false, ['decrypt']
  )

  const combined  = base64ToBytes(ciphertextBase64)
  const iv        = combined.slice(0, IV_BYTE_LENGTH)
  const ciphertext = combined.slice(IV_BYTE_LENGTH)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  )

  return new TextDecoder().decode(decrypted)
}

// ──────────────────────────────────────────────────────────
// DEK wrapping / unwrapping
// ──────────────────────────────────────────────────────────

/**
 * Wrap (encrypt) a DEK with the master key for server storage.
 * The server stores this base64 string; only the user's master key can unwrap it.
 */
export async function wrapDEK(masterKey: ArrayBuffer, dek: ArrayBuffer): Promise<string> {
  // Serialize DEK as base64, then encrypt that string
  const dekBase64 = bytesToBase64(new Uint8Array(dek))
  return encrypt(masterKey, dekBase64)
}

/**
 * Unwrap (decrypt) a DEK that was wrapped with the master key.
 * Returns the raw 32-byte DEK as an ArrayBuffer.
 */
export async function unwrapDEK(masterKey: ArrayBuffer, wrappedDEK: string): Promise<ArrayBuffer> {
  const dekBase64 = await decrypt(masterKey, wrappedDEK)
  return base64ToBytes(dekBase64).buffer
}

// ──────────────────────────────────────────────────────────
// RSA Key Pair Generation (for invitation key wrapping)
// ──────────────────────────────────────────────────────────

/**
 * Generate an RSA key pair for E2EE invitation key wrapping.
 * Returns both public and private keys.
 *
 * Public key: Safe to store on server, used by inviters to wrap organization keys
 * Private key: Kept client-side only, used to unwrap organization keys from invitations
 */
export async function generateRSAKeyPair(): Promise<{
  publicKey: CryptoKey
  privateKey: CryptoKey
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),  // 65537
      hash: 'SHA-256'
    },
    true,  // extractable (we need to export public key to server)
    ['encrypt', 'decrypt']
  )

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  }
}

/**
 * Export RSA public key to base64 string format for storage on server.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey)
  return bytesToBase64(new Uint8Array(exported))
}

/**
 * Import RSA public key from base64 string (fetched from server).
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToBytes(publicKeyBase64)
  return crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['encrypt']
  )
}

/**
 * Export RSA private key to base64 string for session storage.
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey)
  return bytesToBase64(new Uint8Array(exported))
}

/**
 * Import RSA private key from base64 string (from session storage).
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToBytes(privateKeyBase64)
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['decrypt']
  )
}

/**
 * Encrypt data with RSA public key (for wrapping organization keys for invitees).
 * Input: Raw key buffer (e.g., organization key)
 * Output: Base64-encoded ciphertext
 */
export async function encryptWithPublicKey(publicKey: CryptoKey, data: ArrayBuffer): Promise<string> {
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data
  )
  return bytesToBase64(new Uint8Array(encrypted))
}

/**
 * Decrypt data with RSA private key (for unwrapping organization keys from invitations).
 * Input: Base64-encoded ciphertext
 * Output: Raw key buffer
 */
export async function decryptWithPrivateKey(privateKey: CryptoKey, ciphertextBase64: string): Promise<ArrayBuffer> {
  const ciphertext = base64ToBytes(ciphertextBase64)
  return crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    ciphertext
  )
}

// ──────────────────────────────────────────────────────────
// RSA Private Key Persistence (Encrypted with Master Key)
// ──────────────────────────────────────────────────────────

/**
 * Encrypt RSA private key with master key for server storage.
 *
 * This enables persistent RSA keys across login sessions while maintaining E2EE:
 * - Private key is encrypted client-side with user's master key (AES-GCM)
 * - Encrypted blob is stored on server
 * - Server cannot decrypt it (only user with correct password can derive master key)
 * - On login, client retrieves and decrypts private key with master key
 *
 * @param masterKey - User's master key (derived from password + salt via PBKDF2)
 * @param privateKeyBase64 - RSA private key in base64 (PKCS8 format)
 * @returns Base64-encoded encrypted private key (IV + ciphertext + auth tag)
 */
export async function encryptPrivateKeyWithMasterKey(
  masterKey: ArrayBuffer,
  privateKeyBase64: string
): Promise<string> {
  return encrypt(masterKey, privateKeyBase64)
}

/**
 * Decrypt RSA private key that was encrypted with master key.
 *
 * Retrieves the user's persistent RSA private key after login:
 * - Fetches encrypted blob from server
 * - Decrypts with master key (derived from password + salt)
 * - Returns private key ready for use in session
 *
 * @param masterKey - User's master key (derived from password + salt via PBKDF2)
 * @param encryptedPrivateKey - Base64-encoded encrypted private key from server
 * @returns RSA private key in base64 (PKCS8 format)
 * @throws {Error} If decryption fails (wrong password/tampered data)
 */
export async function decryptPrivateKeyWithMasterKey(
  masterKey: ArrayBuffer,
  encryptedPrivateKey: string
): Promise<string> {
  return decrypt(masterKey, encryptedPrivateKey)
}

// ──────────────────────────────────────────────────────────
// High-level payload helpers
// ──────────────────────────────────────────────────────────

/** Shape stored inside an encrypted transaction blob */
export interface TransactionPayload {
  amount:       number
  paid_to_from: string
  narration:    string | null
}

/** Shape stored inside an encrypted account blob */
export interface AccountPayload {
  name:            string
  opening_balance: number
}

/**
 * Encrypt a transaction's sensitive fields into a single base64 blob.
 */
export async function encryptTransaction(
  dek: ArrayBuffer,
  amount: number,
  paidToFrom: string,
  narration?: string | null
): Promise<string> {
  const payload: TransactionPayload = {
    amount,
    paid_to_from: paidToFrom,
    narration: narration ?? null
  }
  return encrypt(dek, JSON.stringify(payload))
}

/**
 * Decrypt a transaction blob back into its fields.
 */
export async function decryptTransaction(
  dek: ArrayBuffer,
  encryptedData: string
): Promise<TransactionPayload> {
  const json = await decrypt(dek, encryptedData)
  return JSON.parse(json) as TransactionPayload
}

/**
 * Encrypt an account's sensitive fields into a single base64 blob.
 */
export async function encryptAccount(
  dek: ArrayBuffer,
  name: string,
  openingBalance: number
): Promise<string> {
  const payload: AccountPayload = { name, opening_balance: openingBalance }
  return encrypt(dek, JSON.stringify(payload))
}

/**
 * Decrypt an account blob back into its fields.
 */
export async function decryptAccount(
  dek: ArrayBuffer,
  encryptedData: string
): Promise<AccountPayload> {
  const json = await decrypt(dek, encryptedData)
  return JSON.parse(json) as AccountPayload
}
