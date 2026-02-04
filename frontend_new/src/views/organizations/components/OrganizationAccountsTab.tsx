/**
 * Organization Accounts Tab
 * Display and manage accounts belonging to this organization
 */

import React, { useState, useEffect } from 'react'
import {
  CAlert,
  CButton,
  CButtonGroup,
  CSpinner,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilSwapHorizontal } from '@coreui/icons'
import { useNavigate } from 'react-router-dom'
import { organizationsAPI, accountsAPI, RoleEnum, Account } from '../../../services/api'
import { loadOrgAccountDEK } from '../../../utils/keyManager'
import { decryptAccountData } from '../../../utils/e2eService'
import MigrateAccountsWizard from './MigrateAccountsWizard'
import CreateOrgAccountModal from './CreateOrgAccountModal'
import { useAccounts } from '../../../contexts/AccountsContext'

interface OrganizationAccountsTabProps {
  organizationId: string
  organizationName: string
  organizationRole: RoleEnum
}

interface DecryptedAccount {
  id: string
  name: string
  opening_balance: number
  currency: string
  created_at: string
}

const OrganizationAccountsTab: React.FC<OrganizationAccountsTabProps> = ({
  organizationId,
  organizationName,
  organizationRole
}) => {
  const navigate = useNavigate()
  const { accounts: allAccounts, loading, error: contextError, invalidateCache } = useAccounts()
  const [showMigrationWizard, setShowMigrationWizard] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Filter accounts for this organization
  const accounts = allAccounts.filter(account => account.organization_id === organizationId)

  const canCreateAccounts = organizationRole === 'owner' || organizationRole === 'admin'
  const canDeleteAccounts = organizationRole === 'owner' || organizationRole === 'admin'

  const handleMigrationSuccess = () => {
    setShowMigrationWizard(false)
    // No need to reload - context will auto-refresh
  }

  const handleAccountClick = (accountId: string) => {
    navigate(`/expense-tracker/${accountId}`)
  }

  const handleDelete = async (accountId: string, accountName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${accountName}"?\n\n` +
      `This will permanently delete all transactions associated with this account. ` +
      `This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await accountsAPI.delete(accountId)
      // Invalidate cache to refresh all components
      invalidateCache()
    } catch (err: any) {
      console.error('Failed to delete account:', err)
      alert(err.response?.data?.detail || 'Failed to delete account')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading accounts...</div>
      </div>
    )
  }

  if (contextError) {
    return (
      <CAlert color="danger">
        <strong>Error:</strong> {contextError}
      </CAlert>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Organization Accounts</h5>
          <p className="text-medium-emphasis small mb-0">
            Shared expense accounts accessible by organization members
          </p>
        </div>
        {canCreateAccounts && (
          <CButtonGroup size="sm">
            <CButton
              color="primary"
              onClick={() => setShowCreateModal(true)}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Create Account
            </CButton>
            <CButton
              color="info"
              variant="outline"
              onClick={() => setShowMigrationWizard(true)}
            >
              <CIcon icon={cilSwapHorizontal} className="me-1" />
              Migrate Existing
            </CButton>
          </CButtonGroup>
        )}
      </div>

      {accounts.length === 0 ? (
        <CAlert color="info">
          <strong>No accounts yet</strong>
          <p className="mb-0 small mt-2">
            {canCreateAccounts
              ? 'Create your first account or migrate existing accounts to get started.'
              : 'No accounts have been created in this organization yet.'}
          </p>
        </CAlert>
      ) : (
        <CTable align="middle" className="mb-0" hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Account Name</CTableHeaderCell>
              <CTableHeaderCell>Opening Balance</CTableHeaderCell>
              <CTableHeaderCell>Currency</CTableHeaderCell>
              <CTableHeaderCell>Created</CTableHeaderCell>
              {canDeleteAccounts && <CTableHeaderCell style={{ width: '100px' }}>Actions</CTableHeaderCell>}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {accounts.map((account) => (
              <CTableRow
                key={account.id}
                onClick={() => handleAccountClick(account.id)}
                style={{ cursor: 'pointer' }}
              >
                <CTableDataCell>
                  <strong>{account.name}</strong>
                </CTableDataCell>
                <CTableDataCell>
                  {account.opening_balance.toFixed(2)}
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge color="secondary">{account.currency}</CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  {new Date(account.created_at).toLocaleDateString()}
                </CTableDataCell>
                {canDeleteAccounts && (
                  <CTableDataCell>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(account.id, account.name)
                      }}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                )}
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      )}

      <CAlert color="success" className="d-flex align-items-start mt-3">
        <div>
          <strong>End-to-End Encryption</strong>
          <p className="mb-0 small">
            All account data is encrypted with the organization master key. Only members with
            the decrypted key can access account names, balances, and transactions.
          </p>
        </div>
      </CAlert>

      <CreateOrgAccountModal
        visible={showCreateModal}
        organizationId={organizationId}
        organizationName={organizationName}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          // No need to reload - context will auto-refresh
        }}
      />

      <MigrateAccountsWizard
        visible={showMigrationWizard}
        organizationId={organizationId}
        organizationName={organizationName}
        onClose={() => setShowMigrationWizard(false)}
        onSuccess={handleMigrationSuccess}
      />
    </div>
  )
}

export default OrganizationAccountsTab
