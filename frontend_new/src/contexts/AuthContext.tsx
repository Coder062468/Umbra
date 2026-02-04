/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'
import type { User, UserCreate, UserLogin } from '../types/api'
import { initOnLogin, initOnRegister, clearKeys, createOrganizationKey } from '../utils/keyManager'

// API Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: UserLogin) => Promise<void>
  register: (userData: UserCreate) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      setToken(storedToken)
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error('Failed to parse stored user:', e)
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }

    setIsLoading(false)
  }, [])

  // Initialize RSA keys when app loads with authenticated user
  // This handles page refreshes where user is already logged in
  useEffect(() => {
    const initializeRSAKeys = async () => {
      if (!token || !user) return

      // Check if RSA private key is already in sessionStorage
      const existingPrivateKey = sessionStorage.getItem('__e2ee_private_key')
      if (existingPrivateKey) {
        console.log('[E2EE] RSA private key already in sessionStorage')
        return
      }

      // Check if master key is available
      const { getMasterKey } = await import('../utils/keyManager')
      const masterKey = getMasterKey()
      if (!masterKey) {
        console.log('[E2EE] Master key not available yet, skipping RSA key initialization')
        return
      }

      console.log('[E2EE] Page refresh detected - initializing RSA keys...')

      try {
        const { decryptPrivateKeyWithMasterKey } = await import('../utils/encryption')

        // Fetch encrypted private key from server
        const keyResponse = await fetch(`${API_BASE_URL}/api/auth/encrypted-private-key`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!keyResponse.ok) {
          throw new Error(`Failed to fetch encrypted private key: ${keyResponse.statusText}`)
        }

        const keyData = await keyResponse.json()

        if (keyData.encrypted_private_key) {
          // Decrypt and restore private key
          const privateKeyBase64 = await decryptPrivateKeyWithMasterKey(masterKey, keyData.encrypted_private_key)
          sessionStorage.setItem('__e2ee_private_key', privateKeyBase64)
          console.log('[E2EE] Successfully restored RSA private key from server')
        } else {
          console.log('[E2EE] No encrypted private key on server - user needs to log in again')
        }
      } catch (error) {
        console.error('[E2EE] Failed to initialize RSA keys on page load:', error)
      }
    }

    initializeRSAKeys()
  }, [token, user])

  const login = async (credentials: UserLogin) => {
    try {
      const response = await authAPI.login(credentials)
      const { access_token, salt } = response.data

      console.log('[AuthContext] Login response:', {
        hasAccessToken: !!access_token,
        hasSalt: !!salt,
        saltValue: salt
      })

      // Store token and salt
      setToken(access_token)
      localStorage.setItem('token', access_token)

      // E2EE: Derive master key BEFORE any data fetching
      // This must happen while password is still in scope
      if (salt) {
        console.log('[AuthContext] Initializing encryption with salt:', salt)
        localStorage.setItem('salt', salt)
        await initOnLogin(credentials.password, salt)
        console.log('[AuthContext] ✓ Encryption initialization complete')
      } else {
        console.error('[AuthContext] ❌ No salt in login response - encryption NOT initialized!')
      }

      // Fetch user data
      const userResponse = await authAPI.getCurrentUser()
      const userData = userResponse.data

      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))

      // E2EE: Persistent RSA key pair management
      // - First login: Generate new RSA pair, encrypt private key with master key, store on server
      // - Subsequent logins: Retrieve encrypted private key from server, decrypt with master key
      // - This ensures RSA keys persist across sessions (critical for invitation system)
      try {
        console.log('[E2EE] Initializing persistent RSA key pair...')

        const { generateRSAKeyPair, exportPublicKey, exportPrivateKey, encryptPrivateKeyWithMasterKey, decryptPrivateKeyWithMasterKey } = await import('../utils/encryption')
        const { getMasterKey } = await import('../utils/keyManager')

        const masterKey = getMasterKey()
        if (!masterKey) {
          throw new Error('Master key not available - cannot manage RSA keys')
        }

        // Fetch existing encrypted private key from server
        const keyResponse = await fetch(`${API_BASE_URL}/api/auth/encrypted-private-key`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!keyResponse.ok) {
          throw new Error(`Failed to fetch encrypted private key: ${keyResponse.statusText}`)
        }

        const keyData = await keyResponse.json()
        let privateKeyBase64: string

        if (keyData.encrypted_private_key) {
          // User has existing RSA key pair - decrypt and use it
          console.log('[E2EE] Found existing encrypted RSA private key, decrypting...')
          privateKeyBase64 = await decryptPrivateKeyWithMasterKey(masterKey, keyData.encrypted_private_key)
          console.log('[E2EE] Successfully decrypted existing RSA private key')
        } else {
          // First time login or legacy user - generate new RSA pair
          console.log('[E2EE] No existing RSA key found, generating new pair...')
          const { publicKey, privateKey } = await generateRSAKeyPair()
          const publicKeyBase64 = await exportPublicKey(publicKey)
          privateKeyBase64 = await exportPrivateKey(privateKey)

          // Encrypt private key with master key
          const encryptedPrivateKey = await encryptPrivateKeyWithMasterKey(masterKey, privateKeyBase64)

          // Store encrypted private key and public key on server
          const storeResponse = await fetch(`${API_BASE_URL}/api/auth/store-encrypted-private-key`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              encrypted_private_key: encryptedPrivateKey,
              public_key: publicKeyBase64
            })
          })

          if (!storeResponse.ok) {
            throw new Error(`Failed to store encrypted private key: ${storeResponse.statusText}`)
          }

          console.log('[E2EE] Generated new RSA pair and stored encrypted private key on server')
        }

        // Store decrypted private key in session storage for use during this session
        sessionStorage.setItem('__e2ee_private_key', privateKeyBase64)
        console.log('[E2EE] Persistent RSA key pair ready for use')

      } catch (keyError) {
        // Non-critical error - log but don't fail login
        // User can still use the app, but invitation acceptance will fail
        console.error('[E2EE] Failed to initialize RSA key pair:', keyError)
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const register = async (userData: UserCreate) => {
    try {
      // E2EE: Generate salt and derive master key BEFORE registration
      const { salt } = await initOnRegister(userData.password)

      // E2EE: Generate organization key for default organization
      // Use temporary ID - real org ID will be assigned by backend
      const { wrappedOrgKey } = await createOrganizationKey('temp-registration')
      console.log('[E2EE] Generated organization key for default organization')

      // E2EE: Generate RSA key pair for invitation key wrapping
      const { generateRSAKeyPair, exportPublicKey, exportPrivateKey } = await import('../utils/encryption')
      const { publicKey, privateKey } = await generateRSAKeyPair()
      const publicKeyBase64 = await exportPublicKey(publicKey)
      const privateKeyBase64 = await exportPrivateKey(privateKey)

      // Store private key in session storage (never sent to server)
      sessionStorage.setItem('__e2ee_private_key', privateKeyBase64)
      console.log('[E2EE] Generated RSA key pair for invitation encryption')

      // Register user (include salt, wrapped org key, and public key in payload)
      await authAPI.register({
        ...userData,
        salt,
        wrapped_org_key: wrappedOrgKey,
        public_key: publicKeyBase64,
      })

      // Auto-login after registration
      // Master key already derived, just need to set auth state
      await login({
        email: userData.email,
        password: userData.password,
      })
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const logout = () => {
    // E2EE: Wipe encryption keys from memory
    clearKeys()

    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('salt')
    sessionStorage.removeItem('__e2ee_private_key')  // Clear RSA private key
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
