/**
 * Account Summary Modal
 * Premium dashboard view showing account statistics, charts, and breakdowns
 */

import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CRow,
  CCol,
  CWidgetStatsA,
  CCard,
  CCardBody,
  CCardTitle,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CProgress,
  CProgressBar,
  CSpinner,
  CBadge,
} from '@coreui/react-pro'
import { CChartBar, CChartDoughnut } from '@coreui/react-chartjs'
import CIcon from '@coreui/icons-react'
import {
  cilArrowTop,
  cilArrowBottom,
  cilMoney,
  cilPeople,
  cilWallet,
  cilChart,
  cilChevronRight,
  cilChevronBottom,
} from '@coreui/icons'
import { transactionsAPI } from '../../../services/api'
import { getDEK } from '../../../utils/keyManager'
import { decryptTransaction, TransactionPayload } from '../../../utils/encryption'

interface AccountSummaryModalProps {
  visible: boolean
  onClose: () => void
  accountId: string
  accountName: string
  openingBalance: number
  currency: string
}

interface Transaction {
  date: string
  amount: number
  narration: string
}

interface PersonSummary {
  name: string
  credit: number
  debit: number
  net: number
  count: number
  transactions: Transaction[]
}

interface MonthlySummary {
  month: string
  credit: number
  debit: number
  net: number
}

const AccountSummaryModal: React.FC<AccountSummaryModalProps> = ({
  visible,
  onClose,
  accountId,
  accountName,
  openingBalance,
  currency,
}) => {
  const [loading, setLoading] = useState(true)
  const [totalCredit, setTotalCredit] = useState(0)
  const [totalDebit, setTotalDebit] = useState(0)
  const [closingBalance, setClosingBalance] = useState(0)
  const [transactionCount, setTransactionCount] = useState(0)
  const [personSummaries, setPersonSummaries] = useState<PersonSummary[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [avgTransactionAmount, setAvgTransactionAmount] = useState(0)
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)

  useEffect(() => {
    if (visible && accountId) {
      loadSummaryData()
      setExpandedPerson(null) // Reset expanded state when modal opens
    }
  }, [visible, accountId])

  const loadSummaryData = async () => {
    setLoading(true)
    try {
      const response = await transactionsAPI.getAll({ account_id: accountId })
      const transactions = response.data.transactions

      // Get DEK
      const dek = getDEK(accountId)
      if (!dek) {
        console.error('DEK not available')
        return
      }

      // Decrypt all transactions
      const decrypted = await Promise.all(
        transactions.map(async (t) => {
          const payload: TransactionPayload = await decryptTransaction(dek, t.encrypted_data || '')
          return {
            date: t.date,
            amount: payload.amount,
            paid_to_from: payload.paid_to_from,
            narration: payload.narration,
          }
        })
      )

      // Calculate totals
      let credit = 0
      let debit = 0
      decrypted.forEach(t => {
        if (t.amount > 0) credit += t.amount
        else debit += Math.abs(t.amount)
      })

      setTotalCredit(credit)
      setTotalDebit(debit)
      setClosingBalance(openingBalance + credit - debit)
      setTransactionCount(decrypted.length)
      setAvgTransactionAmount(decrypted.length > 0 ? (credit + debit) / decrypted.length : 0)

      // Group by person
      const personMap = new Map<string, PersonSummary>()
      decrypted.forEach(t => {
        const existing = personMap.get(t.paid_to_from) || {
          name: t.paid_to_from,
          credit: 0,
          debit: 0,
          net: 0,
          count: 0,
          transactions: []
        }
        existing.count++
        if (t.amount > 0) {
          existing.credit += t.amount
        } else {
          existing.debit += Math.abs(t.amount)
        }
        existing.net = existing.credit - existing.debit
        existing.transactions.push({
          date: t.date,
          amount: t.amount,
          narration: t.narration
        })
        personMap.set(t.paid_to_from, existing)
      })

      const persons = Array.from(personMap.values())
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

      setPersonSummaries(persons)

      // Group by month
      const monthMap = new Map<string, MonthlySummary>()
      decrypted.forEach(t => {
        const monthKey = new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        const existing = monthMap.get(monthKey) || {
          month: monthKey,
          credit: 0,
          debit: 0,
          net: 0
        }
        if (t.amount > 0) {
          existing.credit += t.amount
        } else {
          existing.debit += Math.abs(t.amount)
        }
        existing.net = existing.credit - existing.debit
        monthMap.set(monthKey, existing)
      })

      const months = Array.from(monthMap.values())
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
        .slice(-6) // Last 6 months

      setMonthlySummaries(months)

    } catch (err) {
      console.error('Failed to load summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getBalanceChange = () => {
    const change = closingBalance - openingBalance
    const percent = openingBalance !== 0 ? ((change / Math.abs(openingBalance)) * 100).toFixed(1) : '0.0'
    return { change, percent }
  }

  const togglePersonExpansion = (personName: string) => {
    setExpandedPerson(expandedPerson === personName ? null : personName)
  }

  return (
    <CModal visible={visible} onClose={onClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilChart} className="me-2" />
          Account Summary - {accountName}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className="text-center py-5">
            <CSpinner color="primary" />
            <div className="mt-3 text-medium-emphasis">Loading summary...</div>
          </div>
        ) : (
          <>
            {/* Key Statistics Widgets */}
            <CRow xs={{ gutter: 3 }} className="mb-4">
              <CCol sm={6} lg={3}>
                <CWidgetStatsA
                  color="success-gradient"
                  value={
                    <>
                      {formatCurrency(totalCredit)}
                      <span className="fs-6 fw-normal ms-2">
                        <CIcon icon={cilArrowTop} />
                      </span>
                    </>
                  }
                  title="Total Credit"
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <CWidgetStatsA
                  color="danger-gradient"
                  value={
                    <>
                      {formatCurrency(totalDebit)}
                      <span className="fs-6 fw-normal ms-2">
                        <CIcon icon={cilArrowBottom} />
                      </span>
                    </>
                  }
                  title="Total Debit"
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <CWidgetStatsA
                  color="info-gradient"
                  value={
                    <>
                      {formatCurrency(closingBalance)}
                      {getBalanceChange().change !== 0 && (
                        <span className="fs-6 fw-normal ms-2">
                          ({getBalanceChange().percent}%{' '}
                          <CIcon icon={getBalanceChange().change > 0 ? cilArrowTop : cilArrowBottom} />)
                        </span>
                      )}
                    </>
                  }
                  title="Closing Balance"
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <CWidgetStatsA
                  color="primary-gradient"
                  value={
                    <>
                      {transactionCount}
                      <span className="fs-6 fw-normal ms-2">txns</span>
                    </>
                  }
                  title="Total Transactions"
                />
              </CCol>
            </CRow>

            {/* Charts Section */}
            <CRow className="mb-4">
              <CCol lg={8}>
                <CCard>
                  <CCardBody>
                    <CCardTitle>Monthly Trend</CCardTitle>
                    <CChartBar
                      data={{
                        labels: monthlySummaries.map(m => m.month),
                        datasets: [
                          {
                            label: 'Credit',
                            backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            data: monthlySummaries.map(m => m.credit),
                          },
                          {
                            label: 'Debit',
                            backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            data: monthlySummaries.map(m => m.debit),
                          },
                        ],
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: true,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                      style={{ height: '300px' }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={4}>
                <CCard>
                  <CCardBody>
                    <CCardTitle>Credit vs Debit</CCardTitle>
                    <CChartDoughnut
                      data={{
                        labels: ['Credit', 'Debit'],
                        datasets: [
                          {
                            backgroundColor: ['#22c55e', '#ef4444'],
                            data: [totalCredit, totalDebit],
                          },
                        ],
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: true,
                            position: 'bottom',
                          },
                        },
                      }}
                      style={{ height: '300px' }}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>

            {/* Persons/Entities Breakdown */}
            <CCard className="mb-4">
              <CCardBody>
                <CCardTitle className="mb-3">
                  <CIcon icon={cilPeople} className="me-2" />
                  Summary by Person/Entity
                </CCardTitle>
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Name</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Transactions</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Credit</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Debit</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Net</CTableHeaderCell>
                      <CTableHeaderCell>Impact</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {personSummaries.map((person, idx) => {
                      const maxAmount = Math.max(...personSummaries.map(p => Math.abs(p.net)))
                      const percentage = (Math.abs(person.net) / maxAmount) * 100
                      const isExpanded = expandedPerson === person.name
                      return (
                        <React.Fragment key={idx}>
                          <CTableRow
                            style={{ cursor: 'pointer' }}
                            onClick={() => togglePersonExpansion(person.name)}
                          >
                            <CTableDataCell>
                              <div className="d-flex align-items-center">
                                <CIcon
                                  icon={isExpanded ? cilChevronBottom : cilChevronRight}
                                  className="me-2"
                                  size="sm"
                                />
                                <span className="fw-semibold">{person.name}</span>
                              </div>
                            </CTableDataCell>
                            <CTableDataCell className="text-end">
                              <CBadge color="info">{person.count}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell className="text-end text-success fw-semibold">
                              {formatCurrency(person.credit)}
                            </CTableDataCell>
                            <CTableDataCell className="text-end text-danger fw-semibold">
                              {formatCurrency(person.debit)}
                            </CTableDataCell>
                            <CTableDataCell className="text-end">
                              <span className={person.net >= 0 ? 'text-success' : 'text-danger'}>
                                {formatCurrency(person.net)}
                              </span>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CProgress height={20} className="mb-0">
                                <CProgressBar
                                  color={person.net >= 0 ? 'success' : 'danger'}
                                  value={percentage}
                                >
                                  {percentage.toFixed(0)}%
                                </CProgressBar>
                              </CProgress>
                            </CTableDataCell>
                          </CTableRow>
                          {isExpanded && (
                            <CTableRow>
                              <CTableDataCell colSpan={6} style={{ backgroundColor: '#f8f9fa', padding: '16px' }}>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                  <h6 className="mb-3">Transactions for {person.name}</h6>
                                  <CTable small striped style={{ marginBottom: 0 }}>
                                    <CTableHead>
                                      <CTableRow>
                                        <CTableHeaderCell>Date</CTableHeaderCell>
                                        <CTableHeaderCell>Narration</CTableHeaderCell>
                                        <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                                      </CTableRow>
                                    </CTableHead>
                                    <CTableBody>
                                      {person.transactions
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((txn, txnIdx) => (
                                        <CTableRow key={txnIdx}>
                                          <CTableDataCell>
                                            {new Date(txn.date).toLocaleDateString('en-GB')}
                                          </CTableDataCell>
                                          <CTableDataCell>{txn.narration}</CTableDataCell>
                                          <CTableDataCell className="text-end">
                                            <span className={txn.amount >= 0 ? 'text-success fw-semibold' : 'text-danger fw-semibold'}>
                                              {formatCurrency(txn.amount)}
                                            </span>
                                          </CTableDataCell>
                                        </CTableRow>
                                      ))}
                                    </CTableBody>
                                  </CTable>
                                </div>
                              </CTableDataCell>
                            </CTableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>

            {/* Quick Stats */}
            <CRow>
              <CCol md={6}>
                <CCard className="border-start border-start-4 border-start-primary">
                  <CCardBody>
                    <div className="text-medium-emphasis small">Opening Balance</div>
                    <div className="fs-4 fw-semibold">{formatCurrency(openingBalance)}</div>
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol md={6}>
                <CCard className="border-start border-start-4 border-start-info">
                  <CCardBody>
                    <div className="text-medium-emphasis small">Average Transaction</div>
                    <div className="fs-4 fw-semibold">{formatCurrency(avgTransactionAmount)}</div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default AccountSummaryModal
