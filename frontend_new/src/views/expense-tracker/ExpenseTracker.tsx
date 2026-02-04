/**
 * ExpenseTracker Main Page
 * Orchestrates all expense tracking components
 */

import React, { useState, useEffect } from 'react'
import {
  CContainer,
  CRow,
  CCol,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilCloudDownload,
  cilCloudUpload,
  cilChart,
} from '@coreui/icons'

import AccountSelector from './components/AccountSelector'
import ExcelGridView from './components/ExcelGridView'
import CreateAccountModal from './components/CreateAccountModal'
import AccountBackup from '../../components/AccountBackup'
import ExcelImportModal from './components/ExcelImportModal'
import PDFExportModal from './components/PDFExportModal'
import AccountSummaryModal from './components/AccountSummaryModal'

import { accountsAPI } from '../../services/api'
import { decryptAccountData, type DecryptedAccount } from '../../utils/e2eService'

const ExpenseTracker: React.FC = () => {
  // Account state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<DecryptedAccount | null>(null)  // E2EE: Track full decrypted account
  const [accountRefreshTrigger, setAccountRefreshTrigger] = useState(0)

  // Transaction state
  const [transactionRefreshTrigger, setTransactionRefreshTrigger] = useState(0)

  // Modal visibility state
  const [createAccountModalVisible, setCreateAccountModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [exportPDFModalVisible, setExportPDFModalVisible] = useState(false)
  const [summaryModalVisible, setSummaryModalVisible] = useState(false)

  // Export loading state
  // const [exporting, setExporting] = useState(false)

  // Handlers
  const handleAccountCreated = () => {
    setAccountRefreshTrigger((prev) => prev + 1)
  }

  const handleDataChange = () => {
    setTransactionRefreshTrigger((prev) => prev + 1)
  }

  const handleBackupCreated = () => {
    // Backup created successfully - no need to refresh anything
  }

  const handleBackupRestored = () => {
    // Backup restored - refresh both accounts and transactions
    setAccountRefreshTrigger((prev) => prev + 1)
    setTransactionRefreshTrigger((prev) => prev + 1)
  }

  const handleImportSuccess = () => {
    setTransactionRefreshTrigger((prev) => prev + 1)
  }

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

  // const handleExcelExport = async () => {
  //   if (!selectedAccountId) return

  //   setExporting(true)
  //   try {
  //     const response = await importExportAPI.export({
  //       account_ids: selectedAccountId,
  //     })

  //     // Create blob and download
  //     const blob = new Blob([response.data], {
  //       type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //     })

  //     const url = window.URL.createObjectURL(blob)
  //     const link = document.createElement('a')
  //     link.href = url

  //     // Extract filename from Content-Disposition header if available
  //     const contentDisposition = response.headers['content-disposition']
  //     let filename = 'expense_tracker_export.xlsx'

  //     if (contentDisposition) {
  //       const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)
  //       if (matches != null && matches[1]) {
  //         filename = matches[1].replace(/['"]/g, '')
  //       }
  //     }

  //     link.setAttribute('download', filename)
  //     document.body.appendChild(link)
  //     link.click()
  //     link.remove()
  //     window.URL.revokeObjectURL(url)
  //   } catch (err: any) {
  //     console.error('Failed to export Excel:', err)
  //     alert('Failed to export Excel file. Please try again.')
  //   } finally {
  //     setExporting(false)
  //   }
  // }

  return (
    <>
      {/* Gradient wrapper matching Fresh Design */}
      <div style={{
        width: '100%',
        minHeight: 'calc(100vh - 56px)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px',
        margin: '-24px',
        boxSizing: 'border-box'
      }}>
        {/* Account Selector Toolbar */}
        <CCard style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: 'none',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          marginBottom: '24px'
        }}>
          <CCardBody style={{ padding: '20px 24px' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div style={{ minWidth: '300px', maxWidth: '400px', flex: '1' }}>
                <AccountSelector
                  selectedAccountId={selectedAccountId}
                  onAccountChange={setSelectedAccountId}
                  onCreateClick={() => setCreateAccountModalVisible(true)}
                  refreshTrigger={accountRefreshTrigger}
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                {selectedAccountId && selectedAccount && (
                  <>
                    <CButton
                      color="primary"
                      variant="outline"
                      onClick={() => setSummaryModalVisible(true)}
                    >
                      <CIcon icon={cilChart} className="me-2" />
                      View Summary
                    </CButton>
                    <CButton
                      color="success"
                      variant="outline"
                      onClick={() => setExportPDFModalVisible(true)}
                    >
                      <CIcon icon={cilCloudDownload} className="me-2" />
                      Export PDF
                    </CButton>
                    <CButton
                      color="info"
                      variant="outline"
                      onClick={() => setImportModalVisible(true)}
                    >
                      <CIcon icon={cilCloudUpload} className="me-2" />
                      Import Excel
                    </CButton>
                    <AccountBackup
                      accountId={selectedAccountId}
                      accountName={selectedAccount.name}
                      onBackupCreated={handleBackupCreated}
                      onBackupRestored={handleBackupRestored}
                    />
                  </>
                )}
                <CButton
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)'
                  }}
                  onClick={() => setCreateAccountModalVisible(true)}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  New Account
                </CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>

        {/* Main content area - Excel Grid View */}
        {selectedAccountId && selectedAccount ? (
          <ExcelGridView
            accountId={selectedAccountId}
            openingBalance={selectedAccount.opening_balance}
            accountName={selectedAccount.name}
            onTransactionChange={handleDataChange}
          />
        ) : (
          <CCard style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }}>
            <CCardBody className="text-center py-5">
              <div style={{ color: '#667eea' }}>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '16px'
                }}>
                  Welcome to Expense Tracker
                </h3>
                <p style={{ color: '#666', fontSize: '16px' }}>
                  Select an account from above to start tracking expenses
                </p>
              </div>
            </CCardBody>
          </CCard>
        )}
      </div>

      {/* Modals */}
      <CreateAccountModal
        visible={createAccountModalVisible}
        onClose={() => setCreateAccountModalVisible(false)}
        onSuccess={handleAccountCreated}
      />

      <ExcelImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={handleImportSuccess}
        accountId={selectedAccountId || undefined}
      />

      {selectedAccountId && selectedAccount && (
        <PDFExportModal
          visible={exportPDFModalVisible}
          onClose={() => setExportPDFModalVisible(false)}
          accountId={selectedAccountId}
          accountName={selectedAccount.name}
          openingBalance={selectedAccount.opening_balance}
          currency={selectedAccount.currency}
        />
      )}

      {selectedAccountId && selectedAccount && (
        <AccountSummaryModal
          visible={summaryModalVisible}
          onClose={() => setSummaryModalVisible(false)}
          accountId={selectedAccountId}
          accountName={selectedAccount.name}
          openingBalance={selectedAccount.opening_balance}
          currency={selectedAccount.currency}
        />
      )}
    </>
  )
}

export default ExpenseTracker
