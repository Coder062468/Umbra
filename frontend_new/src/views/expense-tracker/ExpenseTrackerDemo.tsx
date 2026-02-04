/**
 * ExpenseTrackerDemo Page
 * Demo page showing Excel-style grid vs traditional view
 */

import React, { useState, useEffect } from 'react'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CAlert,
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilGrid, cilList } from '@coreui/icons'

import AccountSelector from './components/AccountSelector'
import ExcelGridView from './components/ExcelGridView'
import TransactionsTable from './components/TransactionsTable'
import PersonSummary from './components/PersonSummary'
import CreateAccountModal from './components/CreateAccountModal'
import TransactionModal from './components/TransactionModal'
import { accountsAPI } from '../../services/api'
import { decryptAccountData, type DecryptedTransaction, type DecryptedAccount } from '../../utils/e2eService'

const ExpenseTrackerDemo: React.FC = () => {
  // Account state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<DecryptedAccount | null>(null)  // E2EE: Track full decrypted account
  const [accountRefreshTrigger, setAccountRefreshTrigger] = useState(0)

  // Transaction state
  const [transactionRefreshTrigger, setTransactionRefreshTrigger] = useState(0)

  // View toggle
  const [activeTab, setActiveTab] = useState<'excel' | 'traditional'>('excel')

  // Modal visibility state
  const [createAccountModalVisible, setCreateAccountModalVisible] = useState(false)
  const [editTransactionModalVisible, setEditTransactionModalVisible] = useState(false)

  // Transaction edit state
  const [transactionToEdit, setTransactionToEdit] = useState<DecryptedTransaction | null>(null)  // E2EE: Changed to DecryptedTransaction

  // E2EE: Load and decrypt selected account to get opening_balance
  useEffect(() => {
    const loadSelectedAccount = async () => {
      if (!selectedAccountId) {
        setSelectedAccount(null)
        return
      }

      try {
        const response = await accountsAPI.getById(selectedAccountId)
        const decrypted = await decryptAccountData(response.data as any)
        setSelectedAccount(decrypted)
      } catch (err) {
        console.error('Failed to load selected account:', err)
      }
    }

    loadSelectedAccount()
  }, [selectedAccountId])

  // Handlers
  const handleAccountCreated = () => {
    setAccountRefreshTrigger((prev) => prev + 1)
  }

  const handleTransactionUpdated = () => {
    setTransactionRefreshTrigger((prev) => prev + 1)
  }

  const handleDataChange = () => {
    setTransactionRefreshTrigger((prev) => prev + 1)
  }

  const handleEditTransaction = (transaction: DecryptedTransaction) => {  // E2EE: Changed to DecryptedTransaction
    setTransactionToEdit(transaction)
    setEditTransactionModalVisible(true)
  }

  return (
    <CContainer fluid className="p-4">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="mb-1">Expense Tracker - Excel Grid Demo</h2>
        <p className="text-muted mb-0">
          Compare the new Excel-style grid with the traditional view
        </p>
      </div>

      {/* Account Selector */}
      <AccountSelector
        selectedAccountId={selectedAccountId}
        onAccountChange={setSelectedAccountId}
        onCreateClick={() => setCreateAccountModalVisible(true)}
        refreshTrigger={accountRefreshTrigger}
      />

      {selectedAccountId && selectedAccount ? (
        <>
          {/* Demo Notice */}
          <CAlert color="info" className="mb-3">
            <strong>Demo Mode:</strong> Switch between tabs to compare the Excel-style grid (new)
            with the traditional table view (current). The Excel grid allows inline editing, bulk
            entry, and keyboard shortcuts just like Excel!
          </CAlert>

          {/* View Tabs */}
          <CCard className="mb-3">
            <CCardBody className="p-0">
              <CNav variant="tabs" role="tablist">
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'excel'}
                    onClick={() => setActiveTab('excel')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilGrid} className="me-2" />
                    Excel-Style Grid (NEW)
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    active={activeTab === 'traditional'}
                    onClick={() => setActiveTab('traditional')}
                    style={{ cursor: 'pointer' }}
                  >
                    <CIcon icon={cilList} className="me-2" />
                    Traditional View (CURRENT)
                  </CNavLink>
                </CNavItem>
              </CNav>
            </CCardBody>
          </CCard>

          {/* Tab Content */}
          <CTabContent>
            {/* Excel Grid View */}
            <CTabPane visible={activeTab === 'excel'}>
              <CRow className="g-3">
                <CCol lg={9}>
                  <div className="mb-3">
                    <CAlert color="success">
                      <strong>Excel-Style Features:</strong>
                      <ul className="mb-0 mt-2">
                        <li>
                          <strong>Click "Add 5 Rows"</strong> to add multiple transactions at once
                        </li>
                        <li>
                          <strong>Double-click any cell</strong> to edit inline (like Excel)
                        </li>
                        <li>
                          <strong>Press Tab</strong> to move to next cell, <strong>Enter</strong>{' '}
                          to move down
                        </li>
                        <li>
                          <strong>Autocomplete</strong> for "Paid To/From" based on your previous
                          entries
                        </li>
                        <li>
                          <strong>Select multiple rows</strong> with checkboxes and delete in bulk
                        </li>
                        <li>
                          <strong>Click "Save Changes"</strong> to batch save all new/edited rows
                        </li>
                      </ul>
                    </CAlert>
                  </div>
                  <ExcelGridView
                    accountId={selectedAccountId}
                    openingBalance={selectedAccount.opening_balance}
                    refreshTrigger={transactionRefreshTrigger}
                    onDataChange={handleDataChange}
                  />
                </CCol>
                <CCol lg={3}>
                  <PersonSummary
                    accountId={selectedAccountId}
                    refreshTrigger={transactionRefreshTrigger}
                  />
                </CCol>
              </CRow>
            </CTabPane>

            {/* Traditional View */}
            <CTabPane visible={activeTab === 'traditional'}>
              <CRow className="g-3">
                <CCol lg={9}>
                  <div className="mb-3">
                    <CAlert color="warning">
                      <strong>Traditional View Limitations:</strong>
                      <ul className="mb-0 mt-2">
                        <li>Must open a modal for each transaction</li>
                        <li>Can only add one transaction at a time</li>
                        <li>No inline editing capability</li>
                        <li>Slower for bulk data entry</li>
                      </ul>
                    </CAlert>
                  </div>
                  <TransactionsTable
                    accountId={selectedAccountId}
                    openingBalance={selectedAccount.opening_balance}
                    refreshTrigger={transactionRefreshTrigger}
                    onEdit={handleEditTransaction}
                  />
                </CCol>
                <CCol lg={3}>
                  <PersonSummary
                    accountId={selectedAccountId}
                    refreshTrigger={transactionRefreshTrigger}
                  />
                </CCol>
              </CRow>
            </CTabPane>
          </CTabContent>
        </>
      ) : (
        <CCard>
          <CCardBody className="text-center py-5">
            <div className="text-muted mb-3">
              <h5>Welcome to Expense Tracker Demo</h5>
              <p>Create or select an account to try the Excel-style grid</p>
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Modals */}
      <CreateAccountModal
        visible={createAccountModalVisible}
        onClose={() => setCreateAccountModalVisible(false)}
        onSuccess={handleAccountCreated}
      />

      <TransactionModal
        visible={editTransactionModalVisible}
        onClose={() => {
          setEditTransactionModalVisible(false)
          setTransactionToEdit(null)
        }}
        onSuccess={handleTransactionUpdated}
        accountId={selectedAccountId || ''}
        transaction={transactionToEdit}
        mode="edit"
      />
    </CContainer>
  )
}

export default ExpenseTrackerDemo
