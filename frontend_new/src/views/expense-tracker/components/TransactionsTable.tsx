/**
 * TransactionsTable Component
 * Displays transactions with filtering, sorting, pagination, and CRUD actions
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CSpinner,
  CAlert,
  CPagination,
  CPaginationItem,
  CFormInput,
  CFormSelect,
  CRow,
  CCol,
  CButtonGroup,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CBadge,
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash, cilFilter, cilX } from '@coreui/icons'
import { transactionsAPI, accountsAPI } from '../../../services/api'
import {
  decryptAndCalculateBalances,
  recalculateBalances,
  type DecryptedTransaction,
  type RawTransaction,
} from '../../../utils/e2eService'
import { loadAccountDEK } from '../../../utils/keyManager'

interface TransactionsTableProps {
  accountId: string
  openingBalance: number  // E2EE: Required for client-side balance calculation
  refreshTrigger?: number
  onEdit: (transaction: DecryptedTransaction) => void  // E2EE: Changed to DecryptedTransaction
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  accountId,
  openingBalance,  // E2EE: Added openingBalance prop
  refreshTrigger,
  onEdit,
}) => {
  const [transactions, setTransactions] = useState<DecryptedTransaction[]>([])  // E2EE: Changed to DecryptedTransaction
  const [filteredTransactions, setFilteredTransactions] = useState<DecryptedTransaction[]>([])  // E2EE: Changed to DecryptedTransaction
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dekLoadedRef = useRef(false)  // E2EE: Track DEK loading

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    person: '',
    amountMin: '',
    amountMax: '',
    search: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  // Delete confirmation state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<DecryptedTransaction | null>(null)  // E2EE: Changed to DecryptedTransaction
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (accountId) {
      loadTransactions()
    }
  }, [accountId, refreshTrigger])

  useEffect(() => {
    applyFilters()
  }, [transactions, filters])

  const loadTransactions = async () => {
    setLoading(true)
    setError('')
    try {
      // E2EE: Load account DEK on first fetch
      if (!dekLoadedRef.current) {
        const accountResponse = await accountsAPI.getById(accountId)
        const account = accountResponse.data
        if (account.encrypted_dek) {
          await loadAccountDEK(accountId, account.encrypted_dek)
          dekLoadedRef.current = true
        }
      }

      // E2EE: Fetch encrypted transactions (no pagination)
      const response = await transactionsAPI.getAll({
        account_id: accountId,
      })

      const rawTransactions = response.data.transactions || []

      // E2EE: Decrypt and calculate balances client-side
      const decrypted = await decryptAndCalculateBalances(
        rawTransactions as RawTransaction[],
        accountId,
        openingBalance
      )

      // Sort by date descending (newest first)
      const sorted = decrypted.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setTransactions(sorted)
    } catch (err: any) {
      setError('Failed to load transactions')
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter((t) => t.date >= filters.dateFrom)
    }
    if (filters.dateTo) {
      filtered = filtered.filter((t) => t.date <= filters.dateTo)
    }

    // Person filter (case-insensitive)
    if (filters.person.trim()) {
      const searchTerm = filters.person.toLowerCase()
      filtered = filtered.filter((t) =>
        t.paid_to_from.toLowerCase().includes(searchTerm)
      )
    }

    // Search filter (searches in both person and narration)
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter((t) =>
        t.paid_to_from.toLowerCase().includes(searchTerm) ||
        (t.narration && t.narration.toLowerCase().includes(searchTerm))
      )
    }

    // Amount range filter
    if (filters.amountMin) {
      filtered = filtered.filter(
        (t) => {
          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
          return amount >= parseFloat(filters.amountMin)
        }
      )
    }
    if (filters.amountMax) {
      filtered = filtered.filter(
        (t) => {
          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
          return amount <= parseFloat(filters.amountMax)
        }
      )
    }

    setFilteredTransactions(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      person: '',
      amountMin: '',
      amountMax: '',
      search: '',
    })
  }

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction)
    setDeleteModalVisible(true)
  }

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return

    setDeleting(true)
    try {
      await transactionsAPI.delete(transactionToDelete.id)
      setDeleteModalVisible(false)
      setTransactionToDelete(null)
      loadTransactions() // Reload to refresh balances
    } catch (err: any) {
      setError('Failed to delete transaction')
      console.error('Failed to delete transaction:', err)
    } finally {
      setDeleting(false)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getAmountColor = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return num < 0 ? 'text-danger' : num > 0 ? 'text-success' : 'text-muted'
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex)

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.person ||
    filters.amountMin ||
    filters.amountMax ||
    filters.search

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <strong>Transactions</strong>
            <CBadge color="primary">{filteredTransactions.length}</CBadge>
            {hasActiveFilters && (
              <CBadge color="warning">Filtered</CBadge>
            )}
          </div>
          <div className="d-flex gap-2">
            <CButton
              color={showFilters ? 'secondary' : 'light'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <CIcon icon={cilFilter} className="me-1" />
              Filters
            </CButton>
            {hasActiveFilters && (
              <CButton color="light" size="sm" onClick={clearFilters}>
                <CIcon icon={cilX} className="me-1" />
                Clear
              </CButton>
            )}
          </div>
        </CCardHeader>

        {showFilters && (
          <CCardBody className="border-bottom bg-light">
            <CRow className="g-3">
              <CCol md={12}>
                <label className="form-label small">Search (Person or Narration)</label>
                <CFormInput
                  type="text"
                  size="sm"
                  placeholder="Search in person names or narration..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                />
              </CCol>
              <CCol md={6} lg={3}>
                <label className="form-label small">From Date</label>
                <CFormInput
                  type="date"
                  size="sm"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters({ ...filters, dateFrom: e.target.value })
                  }
                />
              </CCol>
              <CCol md={6} lg={3}>
                <label className="form-label small">To Date</label>
                <CFormInput
                  type="date"
                  size="sm"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters({ ...filters, dateTo: e.target.value })
                  }
                />
              </CCol>
              <CCol md={6} lg={3}>
                <label className="form-label small">Person/Category</label>
                <CFormInput
                  type="text"
                  size="sm"
                  placeholder="Filter by person..."
                  value={filters.person}
                  onChange={(e) =>
                    setFilters({ ...filters, person: e.target.value })
                  }
                />
              </CCol>
              <CCol md={3} lg={1.5}>
                <label className="form-label small">Min Amount</label>
                <CFormInput
                  type="number"
                  size="sm"
                  step="0.01"
                  placeholder="Min"
                  value={filters.amountMin}
                  onChange={(e) =>
                    setFilters({ ...filters, amountMin: e.target.value })
                  }
                />
              </CCol>
              <CCol md={3} lg={1.5}>
                <label className="form-label small">Max Amount</label>
                <CFormInput
                  type="number"
                  size="sm"
                  step="0.01"
                  placeholder="Max"
                  value={filters.amountMax}
                  onChange={(e) =>
                    setFilters({ ...filters, amountMax: e.target.value })
                  }
                />
              </CCol>
            </CRow>
          </CCardBody>
        )}

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

          {!loading && !error && transactions.length === 0 && (
            <div className="text-center text-muted p-4">
              <p>No transactions yet</p>
              <small>Add your first transaction to get started</small>
            </div>
          )}

          {!loading && !error && filteredTransactions.length === 0 && transactions.length > 0 && (
            <div className="text-center text-muted p-4">
              <p>No transactions match your filters</p>
              <CButton color="link" size="sm" onClick={clearFilters}>
                Clear filters
              </CButton>
            </div>
          )}

          {!loading && !error && currentTransactions.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <CTable hover responsive className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ minWidth: '120px' }}>
                        Date
                      </CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: '140px' }} className="text-end">
                        Amount
                      </CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: '200px' }}>
                        Paid To/From
                      </CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: '250px' }}>
                        Narration
                      </CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: '140px' }} className="text-end">
                        Balance After
                      </CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: '120px' }} className="text-center">
                        Actions
                      </CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {currentTransactions.map((transaction) => (
                      <CTableRow key={transaction.id}>
                        <CTableDataCell>
                          {formatDate(transaction.date)}
                        </CTableDataCell>
                        <CTableDataCell
                          className={`text-end fw-semibold ${getAmountColor(
                            transaction.amount
                          )}`}
                        >
                          {formatCurrency(transaction.amount)}
                        </CTableDataCell>
                        <CTableDataCell>
                          <div
                            className="text-truncate"
                            style={{ maxWidth: '200px' }}
                            title={transaction.paid_to_from}
                          >
                            {transaction.paid_to_from}
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div
                            className="text-muted small text-truncate"
                            style={{ maxWidth: '250px' }}
                            title={transaction.narration || '-'}
                          >
                            {transaction.narration || '-'}
                          </div>
                        </CTableDataCell>
                        <CTableDataCell className="text-end">
                          {formatCurrency(transaction.balance_after)}
                        </CTableDataCell>
                        <CTableDataCell className="text-center">
                          <CButtonGroup size="sm">
                            <CButton
                              color="light"
                              onClick={() => onEdit(transaction)}
                              title="Edit transaction"
                            >
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton
                              color="light"
                              onClick={() => handleDeleteClick(transaction)}
                              title="Delete transaction"
                            >
                              <CIcon icon={cilTrash} className="text-danger" />
                            </CButton>
                          </CButtonGroup>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted small">Rows per page:</span>
                    <CFormSelect
                      size="sm"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      style={{ width: 'auto' }}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </CFormSelect>
                    <span className="text-muted small">
                      {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of{' '}
                      {filteredTransactions.length}
                    </span>
                  </div>

                  <CPagination className="mb-0">
                    <CPaginationItem
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </CPaginationItem>

                    {/* Show first page */}
                    {currentPage > 3 && (
                      <>
                        <CPaginationItem onClick={() => setCurrentPage(1)}>
                          1
                        </CPaginationItem>
                        {currentPage > 4 && <CPaginationItem disabled>...</CPaginationItem>}
                      </>
                    )}

                    {/* Show pages around current page */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === currentPage ||
                          page === currentPage - 1 ||
                          page === currentPage + 1 ||
                          page === currentPage - 2 ||
                          page === currentPage + 2
                      )
                      .map((page) => (
                        <CPaginationItem
                          key={page}
                          active={page === currentPage}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </CPaginationItem>
                      ))}

                    {/* Show last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && (
                          <CPaginationItem disabled>...</CPaginationItem>
                        )}
                        <CPaginationItem onClick={() => setCurrentPage(totalPages)}>
                          {totalPages}
                        </CPaginationItem>
                      </>
                    )}

                    <CPaginationItem
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </CPaginationItem>
                  </CPagination>
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {/* Delete Confirmation Modal */}
      <CModal
        visible={deleteModalVisible}
        onClose={() => !deleting && setDeleteModalVisible(false)}
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>Confirm Delete</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {transactionToDelete && (
            <div>
              <p>Are you sure you want to delete this transaction?</p>
              <div className="bg-light p-3 rounded">
                <div className="mb-2">
                  <strong>Date:</strong> {formatDate(transactionToDelete.date)}
                </div>
                <div className="mb-2">
                  <strong>Amount:</strong>{' '}
                  <span className={getAmountColor(transactionToDelete.amount)}>
                    {formatCurrency(transactionToDelete.amount)}
                  </span>
                </div>
                <div className="mb-2">
                  <strong>Paid To/From:</strong> {transactionToDelete.paid_to_from}
                </div>
                {transactionToDelete.narration && (
                  <div>
                    <strong>Narration:</strong> {transactionToDelete.narration}
                  </div>
                )}
              </div>
              <CAlert color="warning" className="mt-3 mb-0">
                <small>
                  <strong>Note:</strong> This will recalculate running balances for all
                  subsequent transactions.
                </small>
              </CAlert>
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
              'Delete Transaction'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default TransactionsTable
