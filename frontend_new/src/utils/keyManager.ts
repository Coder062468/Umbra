/**
 * Key Manager
 * ===========
 * Single source of truth for all encryption keys during a browser session.
 *
 * Lifecycle:
 *   REGISTER  →  initOnRegister(password)       → generates salt, derives master key
 *   LOGIN     →  initOnLogin(password, salt)     → re-derives master key from stored salt
 *   LOGOUT    →  clearKeys()                     → wipes everything from memory
 *
 * DEK Cache:
 *   Each account has its own DEK.  The first time an account is accessed the
 *   encrypted DEK is fetched from the server, unwrapped with the master key,
 *   and cached here.  Subsequent accesses hit the cache.
 *
 * Security:
 *   - Master key and DEKs live in memory (both in-memory store and sessionStorage).
 *   - sessionStorage is used to persist the master key during an active tab session,
 *     allowing the app to survive page reloads and HMR during development.
 *   - sessionStorage is automatically cleared when the browser tab is closed.
 *   - Nothing is written to localStorage or IndexedDB (no persistent storage).
 *   - The master key is NEVER sent over the network.
 */

import {
  deriveMasterKey,
  generateSalt,
  generateDEK,
  wrapDEK,
  unwrapDEK
} from './encryption'

// ──────────────────────────────────────────────────────────
// Internal state  (module-level singleton)
// ──────────────────────────────────────────────────────────

interface KeyStore {
  masterKey: ArrayBuffer | null
  salt:      string | null            // base64 — mirror of what the server holds
  deks:      Map<string, ArrayBuffer> // accountId → raw 256-bit DEK
  orgKeys:   Map<string, ArrayBuffer> // organizationId → raw 256-bit org master key
}

const store: KeyStore = {
  masterKey: null,
  salt:      null,
  deks:      new Map(),
  orgKeys:   new Map()
}

// Session persistence (session storage, cleared on tab close)
// Restore master key from sessionStorage if available (survives HMR/reloads during active session)
const savedSalt = sessionStorage.getItem('__e2ee_salt')
const savedMasterKey = sessionStorage.getItem('__e2ee_masterkey')

console.log('[E2EE] Module loaded, checking sessionStorage:', {
  hasSalt: !!savedSalt,
  hasMasterKey: !!savedMasterKey
})

if (savedSalt && savedMasterKey) {
  try {
    store.salt = savedSalt
    // Restore masterKey from base64
    const binaryString = atob(savedMasterKey)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    store.masterKey = bytes.buffer
    console.log('[E2EE] ✓ Restored master key from sessionStorage')
  } catch (err) {
    console.error('[E2EE] Failed to restore master key:', err)
    // Clear corrupted data
    sessionStorage.removeItem('__e2ee_salt')
    sessionStorage.removeItem('__e2ee_masterkey')
  }
} else {
  console.log('[E2EE] No sessionStorage data to restore (user not logged in yet)')
}

// ──────────────────────────────────────────────────────────
// Registration flow
// ──────────────────────────────────────────────────────────

/**
 * Call during registration BEFORE the API request.
 * Generates a random salt and derives the master key.
 * Returns the salt so the caller can include it in the register payload.
 *
 * Example:
 *   const { salt } = await initOnRegister(password)
 *   await authAPI.register({ email, password, salt })
 */
export async function initOnRegister(password: string): Promise<{ salt: string }> {
  const salt      = generateSalt()
  const masterKey = await deriveMasterKey(password, salt)

  store.masterKey = masterKey
  store.salt      = salt

  // Save to sessionStorage for session persistence (cleared on tab close)
  sessionStorage.setItem('__e2ee_salt', salt)
  // Convert ArrayBuffer to base64 for storage
  const bytes = new Uint8Array(masterKey)
  const binaryString = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('')
  sessionStorage.setItem('__e2ee_masterkey', btoa(binaryString))
  console.log('[E2EE] ✓ Saved master key to sessionStorage (registration)')

  return { salt }
}

// ──────────────────────────────────────────────────────────
// Login flow
// ──────────────────────────────────────────────────────────

/**
 * Call after a successful login, using the salt returned by the server.
 * Re-derives the same master key the user had at registration time.
 *
 * Example:
 *   const { salt } = await authAPI.login({ email, password })
 *   await initOnLogin(password, salt)
 */
export async function initOnLogin(password: string, salt: string): Promise<void> {
  if (!salt) {
    throw new Error(
      'No PBKDF2 salt on this account. E2E encryption was not set up at registration.'
    )
  }

  const masterKey = await deriveMasterKey(password, salt)
  store.masterKey = masterKey
  store.salt      = salt

  // Save to sessionStorage for session persistence (cleared on tab close)
  sessionStorage.setItem('__e2ee_salt', salt)
  // Convert ArrayBuffer to base64 for storage
  const bytes = new Uint8Array(masterKey)
  const binaryString = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('')
  sessionStorage.setItem('__e2ee_masterkey', btoa(binaryString))
  console.log('[E2EE] ✓ Saved master key to sessionStorage (login)')
}

// ──────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────

/** Wipe all keys from memory. Call on logout. */
export function clearKeys(): void {
  store.masterKey = null
  store.salt      = null
  store.deks.clear()
  store.orgKeys.clear()

  // Clear sessionStorage
  sessionStorage.removeItem('__e2ee_salt')
  sessionStorage.removeItem('__e2ee_masterkey')
}

// ──────────────────────────────────────────────────────────
// DEK lifecycle
// ──────────────────────────────────────────────────────────

/**
 * Create a brand-new DEK for a freshly created account.
 * Returns both the raw DEK (cached immediately) and its server-safe
 * wrapped (encrypted) form to include in the create-account payload.
 */
export async function createAccountDEK(
  accountId: string
): Promise<{ rawDEK: ArrayBuffer; wrappedDEK: string }> {
  if (!store.masterKey) throw new Error('Master key not initialised')

  const rawDEK     = generateDEK()
  const wrappedDEK = await wrapDEK(store.masterKey, rawDEK)

  store.deks.set(accountId, rawDEK)

  return { rawDEK, wrappedDEK }
}

/**
 * Unwrap and cache a DEK retrieved from the server.
 * Idempotent — returns the cached copy on subsequent calls.
 *
 * @param accountId   The account whose DEK we need
 * @param wrappedDEK  The base64 wrapped DEK from the server (accounts.encrypted_dek)
 */
export async function loadAccountDEK(
  accountId: string,
  wrappedDEK: string
): Promise<ArrayBuffer> {
  // Return cached copy if already unwrapped this session
  const cached = store.deks.get(accountId)
  if (cached) return cached

  if (!store.masterKey) throw new Error('Master key not initialised')

  const rawDEK = await unwrapDEK(store.masterKey, wrappedDEK)
  store.deks.set(accountId, rawDEK)

  return rawDEK
}

/**
 * Get a cached DEK by account ID.  Returns null if not yet loaded.
 */
export function getDEK(accountId: string): ArrayBuffer | null {
  return store.deks.get(accountId) ?? null
}

// ──────────────────────────────────────────────────────────
// Status checks
// ──────────────────────────────────────────────────────────

/** True if master key has been derived (user is logged in with E2E ready). */
export function isEncryptionReady(): boolean {
  return store.masterKey !== null
}

/**
 * Get the current master key.
 * Returns null if encryption is not initialized (user not logged in).
 *
 * The master key is used for:
 * - Encrypting/decrypting account DEKs
 * - Encrypting/decrypting organization keys
 * - Encrypting RSA private keys for server storage
 */
export function getMasterKey(): ArrayBuffer | null {
  return store.masterKey
}

/**
 * Manually place a raw DEK into the cache under a given account ID.
 * Used by e2eService to move a DEK from a temporary placeholder ID
 * (assigned during account creation before the server returns a UUID)
 * to the real account ID the server assigned.
 */
export function registerDEK(accountId: string, dek: ArrayBuffer): void {
  store.deks.set(accountId, dek)
}

// ──────────────────────────────────────────────────────────
// Organization Key Management (Multi-User E2EE)
// ──────────────────────────────────────────────────────────

/**
 * Create a brand-new organization master key.
 * This key will be used to wrap account DEKs for shared organization accounts.
 * Returns both the raw org key (cached immediately) and its wrapped form
 * encrypted with the creator's master key.
 *
 * Flow:
 *   1. User creates organization
 *   2. Generate random 256-bit org key
 *   3. Wrap it with creator's master key
 *   4. Send wrapped org key to server
 *   5. Cache raw org key locally
 */
export async function createOrganizationKey(
  organizationId: string
): Promise<{ rawOrgKey: ArrayBuffer; wrappedOrgKey: string }> {
  if (!store.masterKey) throw new Error('Master key not initialised')

  const rawOrgKey     = generateDEK() // Same generation as DEK (256-bit random key)
  const wrappedOrgKey = await wrapDEK(store.masterKey, rawOrgKey)

  store.orgKeys.set(organizationId, rawOrgKey)

  return { rawOrgKey, wrappedOrgKey }
}

/**
 * Unwrap and cache an organization key retrieved from the server.
 * Idempotent — returns the cached copy on subsequent calls.
 *
 * @param organizationId  The organization whose key we need
 * @param wrappedOrgKey   The base64 wrapped org key from server (organization_members.wrapped_org_key)
 */
export async function loadOrganizationKey(
  organizationId: string,
  wrappedOrgKey: string
): Promise<ArrayBuffer> {
  // Return cached copy if already unwrapped this session
  const cached = store.orgKeys.get(organizationId)
  if (cached) return cached

  if (!store.masterKey) throw new Error('Master key not initialised')

  const rawOrgKey = await unwrapDEK(store.masterKey, wrappedOrgKey)
  store.orgKeys.set(organizationId, rawOrgKey)

  return rawOrgKey
}

/**
 * Get a cached organization key by organization ID.
 * Returns null if not yet loaded.
 */
export function getOrganizationKey(organizationId: string): ArrayBuffer | null {
  return store.orgKeys.get(organizationId) ?? null
}

/**
 * Wrap the organization key for a new member invitation.
 *
 * IMPORTANT: This requires the invitee's public key or master key.
 * For password-based E2EE (PBKDF2), we have two options:
 *
 * Option A: Server-side wrapping (RECOMMENDED)
 *   - Inviter sends plaintext org key to server (over TLS)
 *   - Server wraps it with invitee's master key (derived from their password)
 *   - More complex but doesn't expose keys client-side
 *
 * Option B: Client-side wrapping (CURRENT IMPLEMENTATION)
 *   - Invitee must be an existing user
 *   - Fetch invitee's salt from server (public, no auth needed)
 *   - Ask inviter for invitee's password (awkward UX)
 *   - Derive invitee's master key client-side
 *   - Wrap org key with it
 *
 * For now, we implement a placeholder that returns the org key wrapped
 * with the CURRENT user's master key. The real implementation should:
 * 1. Fetch invitee's salt from server
 * 2. Prompt inviter to have invitee share their password securely
 * 3. Derive invitee's master key
 * 4. Wrap org key with it
 *
 * Alternative: Use asymmetric crypto (RSA/ECC) where each user has public/private keypair.
 */
export async function wrapOrganizationKeyForInvitee(
  organizationId: string,
  inviteeEmail: string
): Promise<string> {
  const orgKey = store.orgKeys.get(organizationId)
  if (!orgKey) {
    throw new Error(`Organization key not loaded for org ${organizationId}`)
  }

  console.log(`[E2EE] Wrapping org key for invitee: ${inviteeEmail}`)

  // Fetch invitee's public key from server
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`http://localhost:8000/api/auth/public-key/${encodeURIComponent(inviteeEmail)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch public key: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.public_key) {
    throw new Error(
      `User ${inviteeEmail} does not have a public key yet. ` +
      `They must log in once to generate their encryption keys before they can be invited.`
    )
  }

  console.log(`[E2EE] Fetched public key for ${inviteeEmail}`)

  // Import the invitee's public key
  const { importPublicKey, encryptWithPublicKey } = await import('./encryption')
  const publicKey = await importPublicKey(data.public_key)

  // Wrap the organization key: first convert to base64, then encrypt with RSA
  // Note: RSA can only encrypt small amounts of data, so we wrap the org key directly
  const wrappedKey = await encryptWithPublicKey(publicKey, orgKey)

  console.log(`[E2EE] ✓ Wrapped org key for ${inviteeEmail}`)

  return wrappedKey
}

/**
 * Re-wrap an account DEK with the organization's master key.
 * Used when migrating a personal account to an organization.
 *
 * @param accountId      The account being migrated
 * @param organizationId The target organization
 * @returns Wrapped DEK (encrypted with org key instead of user's master key)
 */
export async function rewrapDEKWithOrgKey(
  accountId: string,
  organizationId: string
): Promise<string> {
  const dek = store.deks.get(accountId)
  if (!dek) {
    throw new Error(`Account DEK not loaded for account ${accountId}`)
  }

  const orgKey = store.orgKeys.get(organizationId)
  if (!orgKey) {
    throw new Error(`Organization key not loaded for org ${organizationId}`)
  }

  return await wrapDEK(orgKey, dek)
}

/**
 * Unwrap an account DEK that was wrapped with an organization key.
 * Used for accessing organization-owned accounts.
 *
 * @param accountId      The account to access
 * @param organizationId The organization that owns the account
 * @param wrappedDEK     The base64 wrapped DEK (encrypted with org key, not user's master key)
 */
export async function loadOrgAccountDEK(
  accountId: string,
  organizationId: string,
  wrappedDEK: string
): Promise<ArrayBuffer> {
  // Return cached copy if already unwrapped this session
  const cached = store.deks.get(accountId)
  if (cached) return cached

  const orgKey = store.orgKeys.get(organizationId)
  if (!orgKey) {
    throw new Error(`Organization key not loaded for org ${organizationId}. Load it first with loadOrganizationKey()`)
  }

  const rawDEK = await unwrapDEK(orgKey, wrappedDEK)
  store.deks.set(accountId, rawDEK)

  return rawDEK
}

/**
 * Unwrap RSA-encrypted org key from invitation and re-wrap with user's master key.
 * Used when accepting an organization invitation.
 *
 * Flow:
 * 1. Invitation contains org key encrypted with invitee's RSA public key
 * 2. Decrypt with RSA private key (from sessionStorage)
 * 3. Re-wrap with user's master key (PBKDF2-derived)
 * 4. Return re-wrapped key to send to backend
 *
 * @param rsaEncryptedOrgKey  Base64 RSA-encrypted org key from invitation
 * @returns Base64 AES-GCM wrapped org key (encrypted with user's master key)
 */
export async function unwrapInvitationOrgKey(
  rsaEncryptedOrgKey: string
): Promise<string> {
  console.log('[E2EE] unwrapInvitationOrgKey called with:', {
    type: typeof rsaEncryptedOrgKey,
    isNull: rsaEncryptedOrgKey === null,
    isUndefined: rsaEncryptedOrgKey === undefined,
    length: rsaEncryptedOrgKey?.length,
    first50: rsaEncryptedOrgKey?.substring(0, 50)
  })

  if (!store.masterKey) {
    throw new Error('Master key not initialised')
  }

  // Get RSA private key from sessionStorage
  const privateKeyBase64 = sessionStorage.getItem('__e2ee_private_key')
  if (!privateKeyBase64) {
    throw new Error('RSA private key not found. Please log in again to generate encryption keys.')
  }

  // Import RSA private key
  const { importPrivateKey, decryptWithPrivateKey } = await import('./encryption')
  const privateKey = await importPrivateKey(privateKeyBase64)

  console.log('[E2EE] About to decrypt with RSA private key, wrapped_org_key length:', rsaEncryptedOrgKey.length)

  // Decrypt org key using RSA private key
  const rawOrgKey = await decryptWithPrivateKey(privateKey, rsaEncryptedOrgKey)

  // Re-wrap org key with user's master key
  const wrappedOrgKey = await wrapDEK(store.masterKey, rawOrgKey)

  console.log('[E2EE] ✓ Unwrapped invitation org key and re-wrapped with master key')

  return wrappedOrgKey
}
