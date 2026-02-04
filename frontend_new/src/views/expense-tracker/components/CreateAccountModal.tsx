/**
 * CreateAccountModal Component
 * Modal for creating new expense accounts
 */

import React, { useState } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CAlert,
  CSpinner,
} from '@coreui/react-pro'
import { accountsAPI } from '../../../services/api'
import type { AccountCreate } from '../../../types/api'
import { prepareNewAccount, finaliseNewAccountDEK } from '../../../utils/e2eService'
import { useAccounts } from '../../../contexts/AccountsContext'

interface CreateAccountModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { invalidateCache } = useAccounts()
  const [formData, setFormData] = useState<AccountCreate>({
    name: '',
    opening_balance: '0',
    currency: 'INR',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Step 1: Encrypt account data client-side
      const { payload, tempId } = await prepareNewAccount(
        formData.name,
        parseFloat(formData.opening_balance),
        formData.currency || 'INR'
      )

      // Step 2: Send encrypted payload to server
      const response = await accountsAPI.create(payload)

      // Step 3: Move DEK from temp ID to real ID
      finaliseNewAccountDEK(tempId, response.data.id)

      // Step 4: Invalidate accounts cache to trigger refresh
      invalidateCache()

      // Step 5: Success - reset form and close modal
      setFormData({ name: '', opening_balance: '0', currency: 'INR' })
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || 'Failed to create account. Please try again.'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', opening_balance: '0', currency: 'INR' })
      setError('')
      onClose()
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static">
      <CModalHeader>
        <CModalTitle>Create New Account</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError('')}>
              {error}
            </CAlert>
          )}

          <div className="mb-3">
            <CFormLabel htmlFor="accountName">Account Name *</CFormLabel>
            <CFormInput
              type="text"
              id="accountName"
              placeholder="e.g., Cash, Bank Account, Credit Card"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
            <small className="text-muted">
              Give your account a descriptive name (like different Excel sheets)
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="openingBalance">Opening Balance</CFormLabel>
            <CFormInput
              type="number"
              id="openingBalance"
              step="0.01"
              placeholder="0.00"
              value={formData.opening_balance}
              onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
              disabled={loading}
            />
            <small className="text-muted">
              Starting balance for this account (can be negative)
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="currency">Currency</CFormLabel>
            <CFormSelect
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              disabled={loading}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </CFormSelect>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default CreateAccountModal
