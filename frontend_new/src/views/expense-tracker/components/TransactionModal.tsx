/**
 * TransactionModal Component
 * Modal for creating and editing transactions
 */

import React, { useState, useEffect } from 'react'
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
  CFormTextarea,
  CAlert,
  CSpinner,
} from '@coreui/react-pro'
import { transactionsAPI } from '../../../services/api'
import type { Transaction, TransactionCreate, TransactionUpdate } from '../../../types/api'
import { encryptForCreate, encryptForUpdate, type DecryptedTransaction } from '../../../utils/e2eService'

interface TransactionModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  accountId: string
  transaction?: DecryptedTransaction | null  // E2EE: Accept decrypted transaction
  mode: 'create' | 'edit'
}

const TransactionModal: React.FC<TransactionModalProps> = ({
  visible,
  onClose,
  onSuccess,
  accountId,
  transaction,
  mode,
}) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    paid_to_from: '',
    narration: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'edit' && transaction) {
      setFormData({
        date: transaction.date,
        amount: transaction.amount,
        paid_to_from: transaction.paid_to_from,
        narration: transaction.narration || '',
      })
    } else if (mode === 'create') {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        paid_to_from: '',
        narration: '',
      })
    }
  }, [mode, transaction, visible])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'create') {
        // E2EE: Encrypt transaction data before sending
        const amount = parseFloat(formData.amount)
        const paidToFrom = formData.paid_to_from.trim()
        const narration = formData.narration.trim() || undefined

        const payload = await encryptForCreate(accountId, formData.date, amount, paidToFrom, narration)
        await transactionsAPI.create(payload)
      } else if (mode === 'edit' && transaction) {
        // E2EE: Encrypt transaction data before sending
        const amount = parseFloat(formData.amount)
        const paidToFrom = formData.paid_to_from.trim()
        const narration = formData.narration.trim() || undefined

        const payload = await encryptForUpdate(accountId, formData.date, amount, paidToFrom, narration)
        await transactionsAPI.update(transaction.id, payload)
      }

      onSuccess()
      handleClose()
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail ||
        `Failed to ${mode} transaction. Please try again.`
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        paid_to_from: '',
        narration: '',
      })
      setError('')
      onClose()
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static">
      <CModalHeader>
        <CModalTitle>
          {mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}
        </CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError('')}>
              {error}
            </CAlert>
          )}

          <div className="mb-3">
            <CFormLabel htmlFor="transactionDate">Date *</CFormLabel>
            <CFormInput
              type="date"
              id="transactionDate"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="amount">Amount *</CFormLabel>
            <CFormInput
              type="number"
              id="amount"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              disabled={loading}
            />
            <small className="text-muted">
              Negative for expenses, positive for income
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="paidToFrom">Paid To/From *</CFormLabel>
            <CFormInput
              type="text"
              id="paidToFrom"
              placeholder="Person or category name"
              value={formData.paid_to_from}
              onChange={(e) => setFormData({ ...formData, paid_to_from: e.target.value })}
              required
              disabled={loading}
            />
            <small className="text-muted">
              Person or category name (used for auto-tracking)
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="narration">Narration (Optional)</CFormLabel>
            <CFormTextarea
              id="narration"
              rows={3}
              placeholder="Additional details about this transaction..."
              value={formData.narration}
              onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
              disabled={loading}
            />
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
                {mode === 'create' ? 'Adding...' : 'Updating...'}
              </>
            ) : mode === 'create' ? (
              'Add Transaction'
            ) : (
              'Update Transaction'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default TransactionModal
