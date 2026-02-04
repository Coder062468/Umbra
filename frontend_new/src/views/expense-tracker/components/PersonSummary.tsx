/**
 * PersonSummary Component
 * Displays person-wise summary sidebar (auto-tracking up to 150 names)
 */

import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CAlert,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
} from '@coreui/react-pro'
import { transactionsAPI } from '../../../services/api'
import type { PersonSummary as PersonSummaryType } from '../../../types/api'

interface PersonSummaryProps {
  accountId: string
  refreshTrigger?: number
}

const PersonSummary: React.FC<PersonSummaryProps> = ({ accountId, refreshTrigger }) => {
  const [summaries, setSummaries] = useState<PersonSummaryType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (accountId) {
      loadPersonSummary()
    }
  }, [accountId, refreshTrigger])

  const loadPersonSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await transactionsAPI.getPersonSummary(accountId)
      setSummaries(response.data.summaries)
    } catch (err: any) {
      setError('Failed to load person summary')
      console.error('Failed to load person summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTotalAmount = () => {
    return summaries.reduce((sum, person) => sum + parseFloat(person.total_amount), 0)
  }

  const getTotalCount = () => {
    return summaries.reduce((sum, person) => sum + person.transaction_count, 0)
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(num)
  }

  const getAmountColor = (amount: string) => {
    const num = parseFloat(amount)
    return num < 0 ? 'text-danger' : num > 0 ? 'text-success' : 'text-muted'
  }

  return (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Person Summary</strong>
        <CBadge color="info">{summaries.length} / 150</CBadge>
      </CCardHeader>
      <CCardBody className="p-0">
        {loading && (
          <div className="text-center p-4">
            <CSpinner color="primary" />
          </div>
        )}

        {error && (
          <CAlert color="danger" className="m-3">
            {error}
          </CAlert>
        )}

        {!loading && !error && summaries.length >= 145 && summaries.length < 150 && (
          <CAlert color="warning" className="m-3 mb-0">
            <small>
              <strong>Warning:</strong> Approaching person limit ({summaries.length}/150).
              Consider consolidating similar names.
            </small>
          </CAlert>
        )}

        {!loading && !error && summaries.length >= 150 && (
          <CAlert color="danger" className="m-3 mb-0">
            <small>
              <strong>Person Limit Reached!</strong> You have reached the maximum of 150 unique persons.
              New unique names will not be tracked separately.
            </small>
          </CAlert>
        )}

        {!loading && !error && summaries.length === 0 && (
          <div className="text-center text-muted p-4">
            <p>No transactions yet</p>
            <small>Add transactions to see person-wise summary</small>
          </div>
        )}

        {!loading && !error && summaries.length > 0 && (
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            <CTable hover responsive small className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Person/Category</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Total</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Count</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {summaries.map((person, index) => (
                  <CTableRow key={index}>
                    <CTableDataCell>
                      <div className="text-truncate" style={{ maxWidth: '200px' }} title={person.person}>
                        {person.person}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell className={`text-end fw-semibold ${getAmountColor(person.total_amount)}`}>
                      {formatCurrency(person.total_amount)}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CBadge color="secondary">{person.transaction_count}</CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>

            <div className="border-top p-3 bg-light">
              <div className="d-flex justify-content-between mb-2">
                <strong>Total:</strong>
                <strong className={getAmountColor(getTotalAmount().toString())}>
                  {formatCurrency(getTotalAmount())}
                </strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Transactions:</span>
                <CBadge color="primary">{getTotalCount()}</CBadge>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <span className="text-muted">Unique Persons:</span>
                <CBadge color="info">{summaries.length}</CBadge>
              </div>
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default PersonSummary
