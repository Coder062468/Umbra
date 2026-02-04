/**
 * Accounts Context
 * Centralized state management for accounts with E2EE decryption
 * Provides realtime sync across all account-related components
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { accountsAPI } from '../services/api'
import { loadAccountDEK, loadOrgAccountDEK } from '../utils/keyManager'
import { decryptAccountData } from '../utils/e2eService'
import { useAuth } from './AuthContext'
import { useOrganization } from './OrganizationContext'

export interface DecryptedAccount {
  id: string
  name: string
  opening_balance: number
  currency: string
  organization_id: string | null
  created_at: string
  updated_at: string
}

interface AccountsContextState {
  accounts: DecryptedAccount[]
  loading: boolean
  error: string | null
  refreshAccounts: () => Promise<void>
  getAccountById: (id: string) => DecryptedAccount | undefined
  invalidateCache: () => void
}

const AccountsContext = createContext<AccountsContextState | undefined>(undefined)

interface AccountsProviderProps {
  children: React.ReactNode
}

export const AccountsProvider: React.FC<AccountsProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { keysReady } = useOrganization()
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState<boolean>(false)

  /**
   * Decrypt a single account with proper key loading
   */
  const decryptAccount = async (encryptedAccount: any): Promise<DecryptedAccount | null> => {
    try {
      console.log(`[AccountsContext] Decrypting account ${encryptedAccount.id}...`)

      // Load account DEK (either from user's master key or organization key)
      if (encryptedAccount.encrypted_dek) {
        if (encryptedAccount.organization_id) {
          // Organization account - load with org key
          console.log(`[AccountsContext] Loading org account DEK for ${encryptedAccount.id}`)
          await loadOrgAccountDEK(
            encryptedAccount.id,
            encryptedAccount.organization_id,
            encryptedAccount.encrypted_dek
          )
        } else {
          // Personal account - load with user's master key
          console.log(`[AccountsContext] Loading personal account DEK for ${encryptedAccount.id}`)
          await loadAccountDEK(encryptedAccount.id, encryptedAccount.encrypted_dek)
        }
      }

      // Decrypt account data
      if (encryptedAccount.encrypted_data) {
        // Pass the whole account object, not individual fields
        const decrypted = await decryptAccountData(encryptedAccount)

        console.log(`[AccountsContext] Successfully decrypted account: ${decrypted.name}`)

        return {
          id: decrypted.id,
          name: decrypted.name,
          opening_balance: decrypted.opening_balance || 0,
          currency: decrypted.currency,
          organization_id: encryptedAccount.organization_id,
          created_at: decrypted.created_at,
          updated_at: decrypted.updated_at
        }
      }

      console.warn(`[AccountsContext] Account ${encryptedAccount.id} has no encrypted_data`)
      return null
    } catch (err) {
      console.error(`[AccountsContext] Failed to decrypt account ${encryptedAccount.id}:`, err)
      return null
    }
  }

  /**
   * Load and decrypt all accounts from the API
   */
  const refreshAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[AccountsContext] Loading accounts...')
      const response = await accountsAPI.getAll()
      const encryptedAccounts = response.data

      console.log(`[AccountsContext] Received ${encryptedAccounts.length} encrypted accounts from API`)
      console.log('[AccountsContext] First account sample:', encryptedAccounts[0] || 'No accounts')
      console.log(`[AccountsContext] Decrypting ${encryptedAccounts.length} accounts...`)

      // Decrypt all accounts in parallel for better performance
      const decryptionPromises = encryptedAccounts.map(decryptAccount)
      const decryptedResults = await Promise.all(decryptionPromises)

      // Filter out failed decryptions
      const validAccounts = decryptedResults.filter(
        (account): account is DecryptedAccount => account !== null
      )

      console.log(`[AccountsContext] Successfully decrypted ${validAccounts.length} accounts`)
      setAccounts(validAccounts)
      setInitialized(true)
    } catch (err: any) {
      console.error('[AccountsContext] Failed to load accounts:', err)
      const errorMessage = err.response?.data?.detail || 'Failed to load accounts'
      setError(errorMessage)

      // Don't clear accounts on error to maintain last known good state
      if (!initialized) {
        setAccounts([])
      }
    } finally {
      setLoading(false)
    }
  }, [initialized])

  /**
   * Get a specific account by ID
   */
  const getAccountById = useCallback(
    (id: string): DecryptedAccount | undefined => {
      return accounts.find(account => account.id === id)
    },
    [accounts]
  )

  /**
   * Force cache invalidation and refresh
   */
  const invalidateCache = useCallback(() => {
    console.log('[AccountsContext] Cache invalidated, refreshing...')
    refreshAccounts()
  }, [refreshAccounts])

  /**
   * Initialize accounts when user is authenticated
   */
  useEffect(() => {
    // Only load accounts when user is authenticated and organization keys are ready
    if (isAuthenticated && !authLoading && keysReady && !initialized) {
      console.log('[AccountsContext] User authenticated and org keys ready, loading accounts...')
      refreshAccounts()
    }

    // Clear accounts when user logs out
    if (!isAuthenticated && !authLoading && initialized) {
      console.log('[AccountsContext] User logged out, clearing accounts...')
      setAccounts([])
      setInitialized(false)
    }
  }, [isAuthenticated, authLoading, keysReady, initialized, refreshAccounts])

  const value: AccountsContextState = {
    accounts,
    loading,
    error,
    refreshAccounts,
    getAccountById,
    invalidateCache
  }

  return (
    <AccountsContext.Provider value={value}>
      {children}
    </AccountsContext.Provider>
  )
}

/**
 * Custom hook to use the AccountsContext
 * Throws error if used outside of AccountsProvider
 */
export const useAccounts = (): AccountsContextState => {
  const context = useContext(AccountsContext)

  if (context === undefined) {
    throw new Error('useAccounts must be used within an AccountsProvider')
  }

  return context
}

/**
 * HOC to wrap a component with AccountsProvider
 */
export const withAccountsProvider = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <AccountsProvider>
      <Component {...props} />
    </AccountsProvider>
  )
}
