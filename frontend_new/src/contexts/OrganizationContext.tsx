/**
 * Organization Context
 * Manages current organization state and provides organization switching
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { organizationsAPI, Organization } from '../services/api'
import { loadOrganizationKey } from '../utils/keyManager'
import { useAuth } from './AuthContext'

interface OrganizationContextType {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  keysReady: boolean  // Indicates organization encryption keys are loaded and ready
  error: string | null
  switchOrganization: (organizationId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
  clearCurrentOrganization: () => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

interface OrganizationProviderProps {
  children: ReactNode
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [keysReady, setKeysReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([])
      setCurrentOrganization(null)
      setIsLoading(false)
      setKeysReady(false)
      return
    }

    try {
      setIsLoading(true)
      setKeysReady(false)
      setError(null)

      const response = await organizationsAPI.getAll()
      const orgs = response.data

      setOrganizations(orgs)

      // Load keys for ALL organizations upfront so AccountsContext can decrypt accounts from any org
      console.log(`[OrganizationContext] Loading keys for ${orgs.length} organizations...`)
      console.log(`[OrganizationContext] Organizations:`, orgs.map(o => ({ id: o.id, name: o.name, hasKey: !!o.wrapped_org_key })))

      const keyLoadPromises = orgs.map(async (org) => {
        try {
          if (org.wrapped_org_key) {
            console.log(`[OrganizationContext] Loading key for org ${org.id} (${org.name})...`)
            await loadOrganizationKey(org.id, org.wrapped_org_key)
            console.log(`[OrganizationContext] ✓ Loaded key for organization ${org.id} (${org.name})`)
          } else {
            console.warn(`[OrganizationContext] ⚠️ Org ${org.id} (${org.name}) has no wrapped_org_key!`)
          }
        } catch (keyError) {
          console.error(`[OrganizationContext] ✗ Failed to load key for org ${org.id} (${org.name}):`, keyError)
          // Don't throw - continue loading other keys
        }
      })

      await Promise.all(keyLoadPromises)
      console.log('[OrganizationContext] All organization keys loaded')
      setKeysReady(true)

      // Set current organization
      const storedOrgId = localStorage.getItem('current_organization_id')

      if (storedOrgId) {
        const org = orgs.find(o => o.id === storedOrgId)
        if (org) {
          setCurrentOrganization(org)
        } else {
          localStorage.removeItem('current_organization_id')
          if (orgs.length > 0) {
            setCurrentOrganization(orgs[0])
            localStorage.setItem('current_organization_id', orgs[0].id)
          }
        }
      } else if (orgs.length > 0) {
        setCurrentOrganization(orgs[0])
        localStorage.setItem('current_organization_id', orgs[0].id)
      }

    } catch (err: any) {
      console.error('[OrganizationContext] Failed to load organizations:', err)
      setError(err.response?.data?.detail || 'Failed to load organizations')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!authLoading) {
      loadOrganizations()
    }
  }, [authLoading, loadOrganizations])

  const switchOrganization = async (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId)

    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    try {
      setError(null)

      // Organization key is already loaded during loadOrganizations()
      // Just verify it's there, but don't reload
      console.log(`[OrganizationContext] Switching to organization ${org.id}`)

      setCurrentOrganization(org)
      localStorage.setItem('current_organization_id', org.id)

    } catch (err: any) {
      console.error('[OrganizationContext] Failed to switch organization:', err)
      const errorMessage = err.message || 'Failed to switch organization'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const refreshOrganizations = async () => {
    await loadOrganizations()
  }

  const clearCurrentOrganization = () => {
    setCurrentOrganization(null)
    localStorage.removeItem('current_organization_id')
  }

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    isLoading,
    keysReady,
    error,
    switchOrganization,
    refreshOrganizations,
    clearCurrentOrganization,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

export default OrganizationContext
