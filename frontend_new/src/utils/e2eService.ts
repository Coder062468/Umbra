/**
 * E2E Service
 * ===========
 * Application-level orchestration layer that ExcelGridView (and other
 * components) call directly.  Bridges between the raw crypto primitives
 * in encryption.ts / keyManager.ts and the shapes the grid expects.
 *
 * Every public function here is async because AES operations go through
 * the Web Crypto API (which is promise-based even for in-memory keys).
 */

import {
  encryptTransaction,
  decryptTransaction,
  encryptAccount,
  decryptAccount,
  TransactionPayload,
  AccountPayload
} from './encryption'

import { loadAccountDEK, getDEK, createAccountDEK } from './keyManager'


// ──────────────────────────────────────────────────────────
// Shared types (used by the grid and account lists)
// ──────────────────────────────────────────────────────────

/** Raw shape returned by GET /api/transactions */
export interface RawTransaction {
  id:                string
  account_id:        string
  date:              string
  encrypted_data:    string
  encryption_version: number
  created_at:        string
  updated_at:        string
}

/** Raw shape returned by GET /api/accounts */
export interface RawAccount {
  id:                string
  user_id:           string
  encrypted_data:    string
  encrypted_dek:     string
  currency:          string
  encryption_version: number
  created_at:        string
  updated_at:        string
}

/** What the grid actually displays — all fields decrypted + balance calculated */
export interface DecryptedTransaction {
  id:            string
  account_id:    string
  date:          string
  amount:        number
  paid_to_from:  string
  narration:     string | null
  balance_after: number          // Calculated client-side
  created_at:    string
  updated_at:    string
  serialNumber:  number          // 1-based, assigned by creation order
}

/** Decrypted account ready for the UI */
export interface DecryptedAccount {
  id:              string
  user_id:         string
  name:            string
  opening_balance: number
  currency:        string
  encrypted_dek:   string        // kept so we can pass it around if needed
  created_at:      string
  updated_at:      string
}


// ──────────────────────────────────────────────────────────
// Account operations
// ──────────────────────────────────────────────────────────

/**
 * Prepare a NEW account for creation.
 * Generates a DEK, encrypts { name, opening_balance }, wraps the DEK.
 * Returns the payload ready to POST to /api/accounts.
 */
export async function prepareNewAccount(
  name: string,
  openingBalance: number,
  currency: string = 'INR'
): Promise<{
  payload: { encrypted_data: string; encrypted_dek: string; currency: string; encryption_version: number };
  tempId: string
}> {
  // We don't have an accountId yet — use a temporary placeholder.
  // The real ID comes back from the server; we re-cache the DEK under it after creation.
  const tempId = `pending_${Date.now()}`
  const { rawDEK, wrappedDEK } = await createAccountDEK(tempId)

  const encrypted_data = await encryptAccount(rawDEK, name, openingBalance)

  return {
    payload: {
      encrypted_data,
      encrypted_dek: wrappedDEK,
      currency,
      encryption_version: 1
    },
    tempId
  }
}

/**
 * After the server returns the real account ID, move the DEK from the
 * temp key to the real one.  Call this immediately after a successful
 * POST /api/accounts.
 */
export function finaliseNewAccountDEK(tempId: string, realAccountId: string): void {
  const dek = getDEK(tempId)
  if (dek) {
    // Manually set in the keyManager's map via loadAccountDEK won't work
    // because it expects a wrappedDEK.  We use a small workaround:
    // the DEK is already in memory; just register it under the real ID.
    // We import the internal map setter through a tiny helper exposed by keyManager.
    _registerDEK(realAccountId, dek)
  }
}

// Tiny helper — keyManager exposes this so e2eService can move DEKs around.
// (See the addendum at the bottom of keyManager.ts)
import { registerDEK as _registerDEK } from './keyManager'


/**
 * Load and decrypt an account fetched from the server.
 * Unwraps the DEK (or uses cached copy) then decrypts the blob.
 */
export async function decryptAccountData(raw: RawAccount): Promise<DecryptedAccount> {
  const dek = await loadAccountDEK(raw.id, raw.encrypted_dek)
  const payload: AccountPayload = await decryptAccount(dek, raw.encrypted_data)

  return {
    id:              raw.id,
    user_id:         raw.user_id,
    name:            payload.name,
    opening_balance: payload.opening_balance,
    currency:        raw.currency,
    encrypted_dek:   raw.encrypted_dek,
    created_at:      raw.created_at,
    updated_at:      raw.updated_at
  }
}

/**
 * Decrypt a list of accounts from the server.
 */
export async function decryptAccounts(raws: RawAccount[]): Promise<DecryptedAccount[]> {
  const results: DecryptedAccount[] = []
  for (const raw of raws) {
    results.push(await decryptAccountData(raw))
  }
  return results
}

/**
 * Re-encrypt an account after the user changes its name or opening balance.
 * Returns the new encrypted_data blob (PUT payload).
 */
export async function encryptAccountUpdate(
  accountId: string,
  name: string,
  openingBalance: number
): Promise<string> {
  const dek = getDEK(accountId)
  if (!dek) throw new Error(`DEK not loaded for account ${accountId}`)
  return encryptAccount(dek, name, openingBalance)
}


// ──────────────────────────────────────────────────────────
// Transaction operations
// ──────────────────────────────────────────────────────────

/**
 * Decrypt a batch of raw transactions AND calculate running balances.
 *
 * Algorithm:
 *   1. Sort by (date ASC, created_at ASC) — mirrors the server's ORDER BY.
 *   2. Walk through in order, decrypting each blob.
 *   3. Accumulate running balance starting from the account's opening_balance.
 *   4. Assign serial numbers 1, 2, 3 … based on creation order.
 *
 * This is the primary integration point for ExcelGridView's data-load path.
 */
export async function decryptAndCalculateBalances(
  rawTransactions: RawTransaction[],
  accountId:        string,
  openingBalance:   number
): Promise<DecryptedTransaction[]> {
  const dek = getDEK(accountId)
  if (!dek) throw new Error(`DEK not loaded for account ${accountId}`)

  // Sort by creation order (first in, first out - no auto-reorder by date)
  const sorted = [...rawTransactions].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const result: DecryptedTransaction[] = []
  let balance  = openingBalance
  let serial   = 1

  for (const raw of sorted) {
    const payload: TransactionPayload = await decryptTransaction(dek, raw.encrypted_data)
    balance += payload.amount
    // Round to 2 decimal places to avoid floating-point drift
    balance = Math.round(balance * 100) / 100

    result.push({
      id:            raw.id,
      account_id:    raw.account_id,
      date:          raw.date,
      amount:        payload.amount,
      paid_to_from:  payload.paid_to_from,
      narration:     payload.narration,
      balance_after: balance,
      created_at:    raw.created_at,
      updated_at:    raw.updated_at,
      serialNumber:  serial++
    })
  }

  return result
}

/**
 * Encrypt a new transaction's fields for the POST payload.
 */
export async function encryptForCreate(
  accountId:   string,
  date:        string,
  amount:      number,
  paidToFrom:  string,
  narration?:  string | null
): Promise<{ account_id: string; date: string; encrypted_data: string; encryption_version: number }> {
  const dek = getDEK(accountId)
  if (!dek) throw new Error(`DEK not loaded for account ${accountId}`)

  const encrypted_data = await encryptTransaction(dek, amount, paidToFrom, narration)

  return {
    account_id: accountId,
    date,
    encrypted_data,
    encryption_version: 1
  }
}

/**
 * Encrypt updated transaction fields for a PUT payload.
 * Client always re-encrypts the FULL payload (amount + person + narration)
 * because AES-GCM does not support partial updates.
 */
export async function encryptForUpdate(
  accountId:   string,
  date:        string,
  amount:      number,
  paidToFrom:  string,
  narration?:  string | null
): Promise<{ date: string; encrypted_data: string }> {
  const dek = getDEK(accountId)
  if (!dek) throw new Error(`DEK not loaded for account ${accountId}`)

  const encrypted_data = await encryptTransaction(dek, amount, paidToFrom, narration)

  return { date, encrypted_data }
}

/**
 * After any CRUD mutation (create / update / delete / restore) the running
 * balances in the in-memory grid are stale.  Call this to recalculate them
 * from the current set of decrypted rows WITHOUT hitting the network.
 *
 * Also re-assigns serial numbers (they shift when rows are deleted/restored).
 */
export function recalculateBalances(
  transactions: DecryptedTransaction[],
  openingBalance: number
): DecryptedTransaction[] {
  // Sort by creation order (first in, first out - no auto-reorder by date)
  const sorted = [...transactions].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  let balance = openingBalance
  let serial  = 1

  return sorted.map(txn => {
    balance += txn.amount
    balance = Math.round(balance * 100) / 100
    return {
      ...txn,
      balance_after: balance,
      serialNumber:  serial++
    }
  })
}

/**
 * Client-side duplicate detection.
 * Mirrors the server's old 5-second window check but runs entirely in the browser.
 * Call before sending a create request.
 *
 * Returns true if a duplicate exists (caller should abort the save).
 */
export function isDuplicate(
  existingRows: DecryptedTransaction[],
  date:         string,
  amount:       number,
  paidToFrom:   string,
  narration:    string | null,
  windowMs:     number = 5000
): boolean {
  const now = Date.now()

  return existingRows.some(row => {
    const createdAt = new Date(row.created_at).getTime()
    if (now - createdAt > windowMs) return false   // outside window

    return (
      row.date          === date &&
      row.amount        === amount &&
      row.paid_to_from  === paidToFrom &&
      (row.narration || '') === (narration || '')
    )
  })
}
