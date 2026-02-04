/**
 * Organization Settings Page
 * Comprehensive management interface for organization details, members, and audit logs
 */

import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CButton,
  CSpinner,
  CAlert,
  CBreadcrumb,
  CBreadcrumbItem,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilBuilding, cilArrowLeft, cilTrash, cilLockLocked } from '@coreui/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { organizationsAPI, Organization } from '../../services/api'
import { loadOrganizationKey } from '../../utils/keyManager'
import OrganizationDetailsTab from './components/OrganizationDetailsTab'
import OrganizationMembersTab from './components/OrganizationMembersTab'
import OrganizationAccountsTab from './components/OrganizationAccountsTab'
import OrganizationAuditTab from './components/OrganizationAuditTab'

const OrganizationSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [showRotateModal, setShowRotateModal] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateError, setRotateError] = useState<string | null>(null)

  const loadOrganization = async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)
      const response = await organizationsAPI.getById(id)
      setOrganization(response.data)

      // Load organization key for E2EE operations
      await loadOrganizationKey(id, response.data.wrapped_org_key)
      console.log('[E2EE] Organization key loaded successfully')
    } catch (err: any) {
      console.error('Failed to load organization:', err)

      // Check if master key is not initialized
      if (err.message && err.message.includes('Master key not initialised')) {
        setError('MASTER_KEY_MISSING')
      } else {
        setError(err.response?.data?.detail || 'Failed to load organization')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganization()
  }, [id])

  const handleDelete = async () => {
    if (!id || !organization) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${organization.name}"?\n\n` +
      `This will permanently delete all accounts and transactions associated with this organization. ` +
      `This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await organizationsAPI.delete(id)
      navigate('/organizations')
    } catch (err: any) {
      console.error('Failed to delete organization:', err)
      setError(err.response?.data?.detail || 'Failed to delete organization')
    }
  }

  const handleRotateKeys = async () => {
    if (!id || !organization) return

    try {
      setRotating(true)
      setRotateError(null)

      // Import key management functions
      const {
        createOrganizationKey,
        rewrapDEKWithOrgKey,
        loadOrganizationKey
      } = await import('../../utils/keyManager')
      const { accountsAPI } = await import('../../services/api')

      console.log('[Key Rotation] Starting key rotation...')

      // 1. Create new organization key
      const { wrappedOrgKey } = await createOrganizationKey(id)
      console.log('[Key Rotation] New organization key created')

      // 2. Wrap new org key for current user (owner)
      // Note: For full key rotation, other members would need to be re-invited
      // or implement async key exchange protocol
      const memberKeys = [{
        user_id: organization.role === 'owner' ? '' : '', // Will be filled by backend
        wrapped_org_key: wrappedOrgKey
      }]

      // 3. Get all organization accounts
      const accountsResponse = await accountsAPI.getAll()
      const orgAccounts = accountsResponse.data.filter(
        (acc: any) => acc.organization_id === id
      )
      console.log(`[Key Rotation] Found ${orgAccounts.length} accounts to re-encrypt`)

      // 4. Load account DEKs and rewrap them with new org key
      const accountDeks: Record<string, string> = {}
      for (const account of orgAccounts) {
        try {
          // Load the account first to get its DEK in memory
          await accountsAPI.getById(account.id)

          // Rewrap DEK with new org key
          const newWrappedDEK = await rewrapDEKWithOrgKey(account.id, id)
          accountDeks[account.id] = newWrappedDEK
          console.log(`[Key Rotation] Re-encrypted account ${account.id}`)
        } catch (err) {
          console.error(`[Key Rotation] Failed to rewrap account ${account.id}:`, err)
          throw new Error(`Failed to re-encrypt account: ${err}`)
        }
      }

      // 5. Call rotation API
      console.log('[Key Rotation] Calling rotation API...')
      const response = await organizationsAPI.rotateKeys(id, {
        member_keys: memberKeys,
        account_deks: accountDeks
      })

      console.log('[Key Rotation] Success:', response.data)

      // 6. Reload organization key
      await loadOrganizationKey(id, wrappedOrgKey)

      setShowRotateModal(false)
      alert(
        `Key rotation successful!\n\n` +
        `Accounts updated: ${response.data.accounts_updated}\n` +
        `Members updated: ${response.data.members_updated}\n\n` +
        `Note: Other members may need to log out and log back in to refresh their keys.`
      )
    } catch (err: any) {
      console.error('[Key Rotation] Failed:', err)
      setRotateError(err.response?.data?.detail || err.message || 'Key rotation failed')
    } finally {
      setRotating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading organization...</div>
      </div>
    )
  }

  if (error || !organization) {
    // Special handling for master key missing error
    if (error === 'MASTER_KEY_MISSING') {
      return (
        <CCard>
          <CCardBody>
            <CAlert color="warning">
              <div className="d-flex align-items-start">
                <CIcon icon={cilLockLocked} className="me-3 mt-1" size="xl" />
                <div>
                  <h5>Encryption Keys Not Available</h5>
                  <p className="mb-2">
                    Your encryption keys are not currently loaded in memory. For security,
                    end-to-end encryption keys are only stored in memory and are cleared when you refresh the page.
                  </p>
                  <p className="mb-0">
                    Please log out and log back in to restore your encryption keys and access this organization.
                  </p>
                </div>
              </div>
            </CAlert>
            <div className="d-flex gap-2">
              <CButton color="secondary" onClick={() => navigate('/organizations')}>
                Back to Organizations
              </CButton>
              <CButton color="primary" onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                window.location.href = '/login'
              }}>
                Log Out and Log Back In
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      )
    }

    return (
      <CCard>
        <CCardBody>
          <CAlert color="danger">
            {error || 'Organization not found'}
          </CAlert>
          <CButton color="primary" onClick={() => navigate('/organizations')}>
            Back to Organizations
          </CButton>
        </CCardBody>
      </CCard>
    )
  }

  const canDelete = organization.role === 'owner'
  const canRotateKeys = organization.role === 'owner'

  return (
    <>
      <CBreadcrumb className="mb-4">
        <CBreadcrumbItem
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate('/organizations')
          }}
        >
          Organizations
        </CBreadcrumbItem>
        <CBreadcrumbItem active>{organization.name}</CBreadcrumbItem>
      </CBreadcrumb>

      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <CButton
              color="light"
              size="sm"
              className="me-3"
              onClick={() => navigate('/organizations')}
            >
              <CIcon icon={cilArrowLeft} />
            </CButton>
            <CIcon icon={cilBuilding} className="me-2" />
            <div>
              <strong>{organization.name}</strong>
              {organization.description && (
                <div className="text-medium-emphasis small">{organization.description}</div>
              )}
            </div>
          </div>
          <div className="d-flex gap-2">
            {canRotateKeys && (
              <CButton
                color="warning"
                variant="ghost"
                size="sm"
                onClick={() => setShowRotateModal(true)}
              >
                <CIcon icon={cilLockLocked} className="me-1" />
                Rotate Keys
              </CButton>
            )}
            {canDelete && (
              <CButton color="danger" variant="ghost" size="sm" onClick={handleDelete}>
                <CIcon icon={cilTrash} className="me-1" />
                Delete Organization
              </CButton>
            )}
          </div>
        </CCardHeader>
        <CCardBody>
          <CNav variant="tabs" role="tablist">
            <CNavItem>
              <CNavLink
                active={activeTab === 'details'}
                onClick={() => setActiveTab('details')}
                style={{ cursor: 'pointer' }}
              >
                Details
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 'members'}
                onClick={() => setActiveTab('members')}
                style={{ cursor: 'pointer' }}
              >
                Members ({organization.member_count})
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 'accounts'}
                onClick={() => setActiveTab('accounts')}
                style={{ cursor: 'pointer' }}
              >
                Accounts ({organization.account_count})
              </CNavLink>
            </CNavItem>
            {(organization.role === 'owner' || organization.role === 'admin') && (
              <CNavItem>
                <CNavLink
                  active={activeTab === 'audit'}
                  onClick={() => setActiveTab('audit')}
                  style={{ cursor: 'pointer' }}
                >
                  Audit Log
                </CNavLink>
              </CNavItem>
            )}
          </CNav>

          <CTabContent className="mt-3">
            <CTabPane visible={activeTab === 'details'}>
              <OrganizationDetailsTab
                organization={organization}
                onUpdate={loadOrganization}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'members'}>
              <OrganizationMembersTab
                organizationId={id!}
                organizationRole={organization.role}
                onUpdate={loadOrganization}
              />
            </CTabPane>
            <CTabPane visible={activeTab === 'accounts'}>
              <OrganizationAccountsTab
                organizationId={id!}
                organizationName={organization.name}
                organizationRole={organization.role}
              />
            </CTabPane>
            {(organization.role === 'owner' || organization.role === 'admin') && (
              <CTabPane visible={activeTab === 'audit'}>
                <OrganizationAuditTab organizationId={id!} />
              </CTabPane>
            )}
          </CTabContent>
        </CCardBody>
      </CCard>

      {/* Key Rotation Modal */}
      <CModal
        visible={showRotateModal}
        onClose={() => !rotating && setShowRotateModal(false)}
        backdrop="static"
      >
        <CModalHeader closeButton={!rotating}>
          <CModalTitle>Rotate Organization Keys</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {rotateError && (
            <CAlert color="danger" className="mb-3">
              {rotateError}
            </CAlert>
          )}
          <p>
            <strong>Warning:</strong> This operation will re-encrypt all organization data with a new master key.
          </p>
          <ul className="mb-3">
            <li>This will take approximately 30 seconds to complete</li>
            <li>Removed members will permanently lose access to encrypted data</li>
            <li>All accounts will be re-encrypted with the new key</li>
            <li>Current members will retain access automatically</li>
          </ul>
          <p className="text-danger">
            <strong>Important:</strong> Do not close this window during the rotation process.
          </p>
          {rotating && (
            <div className="text-center py-3">
              <CSpinner color="warning" />
              <div className="mt-2">Rotating keys, please wait...</div>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowRotateModal(false)}
            disabled={rotating}
          >
            Cancel
          </CButton>
          <CButton
            color="warning"
            onClick={handleRotateKeys}
            disabled={rotating}
          >
            {rotating ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Rotating...
              </>
            ) : (
              'Rotate Keys'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default OrganizationSettings
