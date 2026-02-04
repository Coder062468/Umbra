/**
 * Create Organization Account Modal
 * Creates accounts directly in an organization with proper E2EE key wrapping
 * Fixed to use standard encryption functions
 */

import React, { useState } from 'react'
import {
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CAlert,
  CSpinner,
} from '@coreui/react-pro'
import { accountsAPI } from '../../../services/api'
import { getOrganizationKey } from '../../../utils/keyManager'
import { useAccounts } from '../../../contexts/AccountsContext'
import { generateDEK, wrapDEK, encryptAccount } from '../../../utils/encryption'

interface CreateOrgAccountModalProps {
  visible: boolean
  organizationId: string
  organizationName: string
  onClose: () => void
  onSuccess: () => void
}

const CreateOrgAccountModal: React.FC<CreateOrgAccountModalProps> = ({
  visible,
  organizationId,
  organizationName,
  onClose,
  onSuccess,
}) => {
  const { invalidateCache } = useAccounts()
  const [accountName, setAccountName] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [currency, setCurrency] = useState('INR')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!accountName.trim()) {
      setError('Account name is required')
      return
    }

    try {
      setCreating(true)
      setError(null)

      // Get organization key
      const orgKey = getOrganizationKey(organizationId)
      if (!orgKey) {
        throw new Error('Organization key not loaded. Please reload the page.')
      }

      // Generate DEK for this account
      const dek = generateDEK()

      // Encrypt account data with DEK
      const encryptedData = await encryptAccount(
        dek,
        accountName.trim(),
        parseFloat(openingBalance) || 0
      )

      // Wrap DEK with organization key
      const wrappedDEK = await wrapDEK(orgKey, dek)

      // Create account via API
      await accountsAPI.create({
        encrypted_data: encryptedData,
        encrypted_dek: wrappedDEK,
        currency,
        encryption_version: 1,
        organization_id: organizationId,
      })

      // Invalidate accounts cache to trigger refresh
      invalidateCache()

      // Reset form
      setAccountName('')
      setOpeningBalance('0')
      setCurrency('INR')

      onSuccess()
    } catch (err: any) {
      console.error('Failed to create organization account:', err)
      setError(err.response?.data?.detail || 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating) {
      setAccountName('')
      setOpeningBalance('0')
      setCurrency('INR')
      setError(null)
      onClose()
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Create Organization Account</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <CAlert color="info" className="mb-3">
          <strong>Organization:</strong> {organizationName}
          <p className="mb-0 small mt-1">
            This account will be encrypted with the organization key and accessible to all organization members.
          </p>
        </CAlert>

        <CForm onSubmit={handleSubmit}>
          <div className="mb-3">
            <CFormLabel htmlFor="accountName">
              Account Name <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              type="text"
              id="accountName"
              placeholder="e.g., Marketing Budget 2024"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={creating}
              required
            />
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="openingBalance">Opening Balance</CFormLabel>
            <CFormInput
              type="number"
              id="openingBalance"
              step="0.01"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              disabled={creating}
            />
            <div className="form-text">
              The starting balance for this account
            </div>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="currency">Currency</CFormLabel>
            <CFormSelect
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={creating}
            >
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="JPY">JPY - Japanese Yen</option>
            </CFormSelect>
          </div>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={handleClose} disabled={creating}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={creating}>
          {creating ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Creating...
            </>
          ) : (
            'Create Account'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default CreateOrgAccountModal
