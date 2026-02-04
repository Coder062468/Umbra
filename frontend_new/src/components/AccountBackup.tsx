/**
 * Account Backup Component
 * Provides backup and restore functionality for individual accounts
 *
 * Features:
 * - Create encrypted backups of account and transactions
 * - Restore from backup with multiple modes (replace, merge, new account)
 * - Download backup files (.etbackup format)
 * - Multi-step confirmation for destructive operations
 * - E2EE preserved throughout backup/restore process
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
  CFormTextarea,
  CFormInput,
  CFormSelect,
  CAlert,
  CSpinner,
  CButtonGroup
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilHistory, cilWarning } from '@coreui/icons'
import { accountsAPI, RestoreMode } from '../services/api'

interface AccountBackupProps {
  accountId: string
  accountName: string
  onBackupCreated?: () => void
  onBackupRestored?: () => void
}

const AccountBackup: React.FC<AccountBackupProps> = ({
  accountId,
  accountName,
  onBackupCreated,
  onBackupRestored,
}) => {
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [backupNotes, setBackupNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace')
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null)

  const handleCreateBackup = async () => {
    try {
      setCreating(true)
      setError(null)

      const response = await accountsAPI.createBackup(accountId, {
        notes: backupNotes || undefined,
      })

      const result = response.data

      const blob = new Blob([result.backup_data], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', result.filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      alert(
        `Backup created successfully!\n\n` +
          `Filename: ${result.filename}\n` +
          `Size: ${formatFileSize(result.size_bytes)}\n` +
          `Transactions: ${result.transaction_count}\n\n` +
          `File has been downloaded.`
      )

      setShowBackupModal(false)
      setBackupNotes('')

      if (onBackupCreated) {
        onBackupCreated()
      }
    } catch (err: any) {
      console.error('Failed to create backup:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to create backup'
      setError(errorMsg)
      alert(`Backup creation failed: ${errorMsg}`)
    } finally {
      setCreating(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.etbackup')) {
      setError('Please select a valid .etbackup file')
      return
    }

    setBackupFile(file)
    setError(null)

    try {
      const content = await file.text()
      setBackupFileContent(content)

      const parsed = JSON.parse(content)
      if (parsed.platform !== 'expense_tracker_e2ee') {
        setError('Invalid backup file: Not from Expense Tracker platform')
        setBackupFile(null)
        setBackupFileContent(null)
        return
      }
    } catch (err) {
      setError('Invalid backup file: Could not parse JSON')
      setBackupFile(null)
      setBackupFileContent(null)
    }
  }

  const handleRestoreBackup = async () => {
    if (!backupFileContent) {
      alert('Please select a backup file first')
      return
    }

    if (restoreMode === 'replace') {
      const confirmed = window.confirm(
        'WARNING: This will DELETE all existing transactions and replace them with the backup.\n\n' +
          'This action CANNOT be undone!\n\n' +
          'Are you sure you want to continue?'
      )
      if (!confirmed) return
    }

    try {
      setRestoring(true)
      setError(null)

      const response = await accountsAPI.restoreBackup(
        accountId,
        restoreMode,
        backupFileContent
      )

      const result = response.data

      let message = `Backup restored successfully!\n\n` +
        `Mode: ${result.mode}\n` +
        `Transactions restored: ${result.restored_transactions}\n`

      if (result.new_account_id) {
        message += `\nNew account created: ${result.new_account_id}`
      }

      alert(message)

      setShowRestoreModal(false)
      setBackupFile(null)
      setBackupFileContent(null)
      setRestoreMode('replace')

      if (onBackupRestored) {
        onBackupRestored()
      }

      if (result.mode !== 'new_account') {
        window.location.reload()
      }
    } catch (err: any) {
      console.error('Failed to restore backup:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to restore backup'
      setError(errorMsg)
      alert(`Restore failed: ${errorMsg}`)
    } finally {
      setRestoring(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <CButtonGroup size="sm">
        <CButton
          color="primary"
          variant="outline"
          onClick={() => setShowBackupModal(true)}
          title="Create backup"
        >
          <CIcon icon={cilCloudDownload} className="me-1" />
          Backup
        </CButton>
        <CButton
          color="secondary"
          variant="outline"
          onClick={() => setShowRestoreModal(true)}
          title="Restore from backup"
        >
          <CIcon icon={cilHistory} className="me-1" />
          Restore
        </CButton>
      </CButtonGroup>

      {/* Create Backup Modal */}
      <CModal
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Create Account Backup</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          <p>
            Create an encrypted backup of <strong>{accountName}</strong> including all
            transactions.
          </p>

          <CForm>
            <div className="mb-3">
              <CFormLabel htmlFor="backupNotes">
                Notes <span className="text-medium-emphasis">(Optional)</span>
              </CFormLabel>
              <CFormTextarea
                id="backupNotes"
                rows={3}
                placeholder="e.g., Before Q4 2024 cleanup"
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
                disabled={creating}
              />
              <div className="form-text">
                Add notes to identify this backup later
              </div>
            </div>
          </CForm>

          <CAlert color="info">
            <strong>About backups:</strong>
            <ul className="mb-0 mt-2">
              <li>Encrypted data remains encrypted (.etbackup format)</li>
              <li>Can only be restored on this platform</li>
              <li>Includes account metadata and all transactions</li>
              <li>Store safely for disaster recovery</li>
            </ul>
          </CAlert>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowBackupModal(false)}
            disabled={creating}
          >
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={handleCreateBackup}
            disabled={creating}
          >
            {creating ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Creating...
              </>
            ) : (
              <>
                <CIcon icon={cilCloudDownload} className="me-1" />
                Download Backup
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Restore Backup Modal */}
      <CModal
        visible={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        alignment="center"
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilHistory} className="me-2" />
            Restore Account from Backup
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          {restoreMode === 'replace' && (
            <CAlert color="warning">
              <CIcon icon={cilWarning} className="me-2" />
              <strong>Warning:</strong> Replace mode will DELETE all existing
              transactions and restore from backup. This cannot be undone!
            </CAlert>
          )}

          <CForm>
            <div className="mb-3">
              <CFormLabel htmlFor="backupFile">
                Upload Backup File (.etbackup)
              </CFormLabel>
              <CFormInput
                type="file"
                id="backupFile"
                accept=".etbackup"
                onChange={handleFileSelect}
                disabled={restoring}
              />
              {backupFile && (
                <div className="form-text text-success">
                  Selected: {backupFile.name} ({formatFileSize(backupFile.size)})
                </div>
              )}
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="restoreMode">Restore Mode</CFormLabel>
              <CFormSelect
                id="restoreMode"
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value as RestoreMode)}
                disabled={restoring}
              >
                <option value="replace">
                  Replace - Delete existing and restore from backup
                </option>
                <option value="merge">
                  Merge - Keep existing, add transactions from backup
                </option>
                <option value="new_account">
                  New Account - Create a copy with backup data
                </option>
              </CFormSelect>
              <div className="form-text">
                {restoreMode === 'replace' &&
                  'All current transactions will be permanently deleted.'}
                {restoreMode === 'merge' &&
                  'Transactions from backup will be added, duplicates skipped.'}
                {restoreMode === 'new_account' &&
                  'Creates a new account, original remains unchanged.'}
              </div>
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowRestoreModal(false)}
            disabled={restoring}
          >
            Cancel
          </CButton>
          <CButton
            color={restoreMode === 'replace' ? 'danger' : 'primary'}
            onClick={handleRestoreBackup}
            disabled={restoring || !backupFile}
          >
            {restoring ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Restoring...
              </>
            ) : (
              <>
                <CIcon icon={cilHistory} className="me-1" />
                Restore Backup
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default AccountBackup
