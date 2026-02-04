/**
 * AccountSelector Component
 * Dropdown selector for switching between accounts
 */

import React, { useState, useEffect } from 'react'
import {
  CFormSelect,
  CSpinner,
  CAlert,
  CButton,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButtonGroup,
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilReload, cilTrash } from '@coreui/icons'
import { accountsAPI } from '../../../services/api'
import type { Account, AccountSummary } from '../../../types/api'
import { useAccounts } from '../../../contexts/AccountsContext'

interface AccountSelectorProps {
  selectedAccountId: string | null
  onAccountChange: (accountId: string) => void
  onCreateClick: () => void
  refreshTrigger?: number
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  selectedAccountId,
  onAccountChange,
  onCreateClick,
  refreshTrigger,
}) => {
  // Use centralized accounts context
  const { accounts, loading, error: contextError, invalidateCache } = useAccounts()

  const [summaries, setSummaries] = useState<Record<string, AccountSummary>>({})
  const [localError, setLocalError] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<typeof accounts[0] | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Refresh accounts when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      invalidateCache()
    }
  }, [refreshTrigger, invalidateCache])

  // Auto-select first account if none selected
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      onAccountChange(accounts[0].id)
    }
  }, [accounts, selectedAccountId, onAccountChange])

  // Load summary for selected account
  useEffect(() => {
    if (selectedAccountId) {
      loadAccountSummary(selectedAccountId)
    }
  }, [selectedAccountId])

  const loadAccountSummary = async (accountId: string) => {
    try {
      const response = await accountsAPI.getSummary(accountId)
      setSummaries((prev) => ({
        ...prev,
        [accountId]: response.data,
      }))
    } catch (err: any) {
      console.error('Failed to load account summary:', err)
    }
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(num)
  }

  const getBalanceColor = (balance: string | number) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    return num < 0 ? 'danger' : num > 0 ? 'success' : 'secondary'
  }

  const handleDeleteClick = () => {
    if (!selectedAccountId) return

    const account = accounts.find((a) => a.id === selectedAccountId)
    if (account) {
      setAccountToDelete(account)
      setDeleteModalVisible(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return

    setDeleting(true)
    try {
      await accountsAPI.delete(accountToDelete.id)

      setDeleteModalVisible(false)
      setAccountToDelete(null)

      // Refresh accounts from context
      invalidateCache()

      // Handle account selection after deletion
      if (selectedAccountId === accountToDelete.id) {
        // Wait a bit for the context to refresh with updated accounts list
        setTimeout(() => {
          // The accounts array will be updated by the context
          // The useEffect hook at lines 56-60 will auto-select the first account if any remain
          // If no accounts remain, we clear the selection
          const remainingAccounts = accounts.filter(a => a.id !== accountToDelete.id)
          if (remainingAccounts.length > 0) {
            onAccountChange(remainingAccounts[0].id)
          } else {
            onAccountChange('')
          }
        }, 100)
      }
    } catch (err: any) {
      setLocalError('Failed to delete account')
      console.error('Failed to delete account:', err)
    } finally {
      setDeleting(false)
    }
  }

  const selectedSummary = selectedAccountId ? summaries[selectedAccountId] : null
  const displayError = localError || contextError

  return (
    <div>
      {displayError && (
        <CAlert color="danger" dismissible onClose={() => setLocalError('')} style={{
          borderRadius: '8px',
          border: 'none',
          marginBottom: '12px'
        }}>
          {displayError}
        </CAlert>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flexGrow: 1, minWidth: '250px' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '8px',
              border: '1px solid rgba(91, 95, 239, 0.2)'
            }}>
              <CSpinner size="sm" style={{ color: '#5B5FEF' }} />
              <span style={{ color: '#6B7280', fontSize: '14px' }}>Loading accounts...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, rgba(91, 95, 239, 0.05) 0%, rgba(107, 70, 193, 0.05) 100%)',
              borderRadius: '8px',
              border: '1px solid rgba(91, 95, 239, 0.2)',
              color: '#6B7280',
              fontSize: '13px'
            }}>
              💡 No accounts yet. Create your first account!
            </div>
          ) : (
            <select
              value={selectedAccountId || ''}
              onChange={(e) => onAccountChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                background: 'white',
                border: '2px solid rgba(91, 95, 239, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#5B5FEF'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91, 95, 239, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(91, 95, 239, 0.3)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#5B5FEF'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91, 95, 239, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(91, 95, 239, 0.3)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <option value="" disabled>
                🏦 Select an account
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  💼 {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </div>

        <CButtonGroup>
          <CButton
            color="primary"
            onClick={onCreateClick}
            title="Create New Account"
            style={{
              borderRadius: '8px 0 0 8px',
              padding: '10px 14px'
            }}
          >
            <CIcon icon={cilPlus} />
          </CButton>
          <CButton
            color="info"
            onClick={() => invalidateCache()}
            disabled={loading}
            title="Refresh Accounts"
            style={{
              borderRadius: '0',
              padding: '10px 14px'
            }}
          >
            <CIcon icon={cilReload} />
          </CButton>
          <CButton
            color="danger"
            onClick={handleDeleteClick}
            disabled={!selectedAccountId || loading}
            title="Delete Selected Account"
            style={{
              borderRadius: '0 8px 8px 0',
              padding: '10px 14px'
            }}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </CButtonGroup>
      </div>

      {/* Delete Confirmation Modal */}
      <CModal
        visible={deleteModalVisible}
        onClose={() => !deleting && setDeleteModalVisible(false)}
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>Confirm Account Deletion</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {accountToDelete && (
            <div>
              <CAlert color="danger">
                <strong>Warning:</strong> This action cannot be undone!
              </CAlert>
              <p>Are you sure you want to delete this account?</p>
              <div className="bg-light p-3 rounded">
                <div className="mb-2">
                  <strong>Account Name:</strong> {accountToDelete.name}
                </div>
                <div className="mb-2">
                  <strong>Opening Balance:</strong> {formatCurrency(accountToDelete.opening_balance)}
                </div>
                <div>
                  <strong>Currency:</strong> {accountToDelete.currency}
                </div>
              </div>
              {selectedSummary && (
                <CAlert color="warning" className="mt-3 mb-0">
                  <small>
                    <strong>This will permanently delete:</strong>
                    <ul className="mb-0 mt-2">
                      <li>{selectedSummary.transaction_count} transactions</li>
                      <li>{selectedSummary.unique_persons} unique person/category entries</li>
                      <li>All transaction history for this account</li>
                    </ul>
                  </small>
                </CAlert>
              )}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setDeleteModalVisible(false)}
            disabled={deleting}
          >
            Cancel
          </CButton>
          <CButton color="danger" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default AccountSelector
