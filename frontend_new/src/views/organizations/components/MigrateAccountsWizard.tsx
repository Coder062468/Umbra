/**
 * Migrate Accounts Wizard
 * Help users migrate personal accounts to organizations with E2EE key re-wrapping
 */

import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CAlert,
  CSpinner,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CFormCheck,
  CProgress,
  CProgressBar,
  CBadge
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilWarning } from '@coreui/icons'
import { accountsAPI, organizationsAPI } from '../../../services/api'
import { rewrapDEKWithOrgKey, loadAccountDEK, loadOrganizationKey } from '../../../utils/keyManager'
import { decryptAccountData } from '../../../utils/e2eService'
import { useAccounts } from '../../../contexts/AccountsContext'

interface Account {
  id: string
  name: string
  opening_balance: number
  organization_id: string | null
}

interface MigrateAccountsWizardProps {
  visible: boolean
  organizationId: string
  organizationName: string
  onClose: () => void
  onSuccess: () => void
}

enum MigrationStep {
  SELECT_ACCOUNTS = 'select',
  CONFIRM = 'confirm',
  MIGRATING = 'migrating',
  COMPLETE = 'complete'
}

const MigrateAccountsWizard: React.FC<MigrateAccountsWizardProps> = ({
  visible,
  organizationId,
  organizationName,
  onClose,
  onSuccess
}) => {
  const { invalidateCache } = useAccounts()
  const [step, setStep] = useState<MigrationStep>(MigrationStep.SELECT_ACCOUNTS)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0)

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await accountsAPI.getAll()

      // Filter personal accounts (not part of any organization)
      const personalAccountsEncrypted = response.data.filter(
        (acc: any) => !acc.organization_id
      )

      // Decrypt each account to get name and balance
      const decryptedAccounts: Account[] = []
      for (const encryptedAccount of personalAccountsEncrypted) {
        try {
          // Decrypt account data (decryptAccountData handles both DEK loading and decryption)
          if (encryptedAccount.encrypted_data) {
            const decrypted = await decryptAccountData(encryptedAccount)
            decryptedAccounts.push({
              id: decrypted.id,
              name: decrypted.name,
              opening_balance: decrypted.opening_balance || 0,
              organization_id: null
            })
          }
        } catch (err) {
          console.error(`Failed to decrypt account ${encryptedAccount.id}:`, err)
          // Skip accounts that fail to decrypt
        }
      }

      setAccounts(decryptedAccounts)
    } catch (err: any) {
      console.error('Failed to load accounts:', err)
      setError(err.response?.data?.detail || 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      loadAccounts()
      setStep(MigrationStep.SELECT_ACCOUNTS)
      setSelectedAccountIds(new Set())
      setProgress(0)
      setCurrentAccountIndex(0)
    }
  }, [visible])

  const handleAccountToggle = (accountId: string) => {
    const newSelected = new Set(selectedAccountIds)
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId)
    } else {
      newSelected.add(accountId)
    }
    setSelectedAccountIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedAccountIds.size === accounts.length) {
      setSelectedAccountIds(new Set())
    } else {
      setSelectedAccountIds(new Set(accounts.map(acc => acc.id)))
    }
  }

  const handleNext = () => {
    if (step === MigrationStep.SELECT_ACCOUNTS) {
      if (selectedAccountIds.size === 0) {
        setError('Please select at least one account to migrate')
        return
      }
      setStep(MigrationStep.CONFIRM)
    } else if (step === MigrationStep.CONFIRM) {
      handleMigrate()
    }
  }

  const handleMigrate = async () => {
    try {
      setStep(MigrationStep.MIGRATING)
      setError(null)
      setProgress(0)
      setCurrentAccountIndex(0)

      // Step 1: Load organization key first
      console.log('[Migration] Loading organization key...')
      const orgResponse = await organizationsAPI.getById(organizationId)

      if (!orgResponse.data.wrapped_org_key) {
        throw new Error('Organization key not found. You may not have access to this organization.')
      }

      // Load and cache the organization key
      await loadOrganizationKey(organizationId, orgResponse.data.wrapped_org_key)
      console.log('[Migration] Organization key loaded successfully')

      const selectedAccounts = accounts.filter(acc => selectedAccountIds.has(acc.id))
      const totalAccounts = selectedAccounts.length

      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i]
        setCurrentAccountIndex(i + 1)

        try {
          // Step 2: Load account DEK (needs encrypted_dek from server)
          console.log(`[Migration] Loading DEK for account ${account.name}...`)
          const accountDetails = await accountsAPI.getById(account.id)

          if (!accountDetails.data.encrypted_dek) {
            throw new Error(`Account ${account.name} has no encrypted_dek`)
          }

          // Load and cache the account DEK using user's master key
          await loadAccountDEK(account.id, accountDetails.data.encrypted_dek)
          console.log(`[Migration] Account DEK loaded for ${account.name}`)

          // Step 3: Re-wrap account DEK with organization key
          console.log(`[Migration] Re-wrapping DEK for ${account.name}...`)
          const newEncryptedDEK = await rewrapDEKWithOrgKey(account.id, organizationId)

          // Step 4: Update account to associate with organization
          console.log(`[Migration] Updating account ${account.name} on server...`)
          await accountsAPI.update(account.id, {
            organization_id: organizationId,
            wrapped_dek: newEncryptedDEK,
            migrated: true
          })

          console.log(`[Migration] Successfully migrated ${account.name}`)
          setProgress(((i + 1) / totalAccounts) * 100)
        } catch (accountErr: any) {
          console.error(`Failed to migrate account ${account.name}:`, accountErr)
          throw new Error(
            `Failed to migrate account "${account.name}": ${accountErr.message}`
          )
        }
      }

      // Invalidate accounts cache to refresh all components
      invalidateCache()

      setStep(MigrationStep.COMPLETE)
    } catch (err: any) {
      console.error('Migration failed:', err)
      setError(err.message || 'Failed to migrate accounts. Please try again.')
      setStep(MigrationStep.CONFIRM)
    }
  }

  const handleClose = () => {
    if (step !== MigrationStep.MIGRATING) {
      setStep(MigrationStep.SELECT_ACCOUNTS)
      setSelectedAccountIds(new Set())
      setError(null)
      onClose()
    }
  }

  const handleComplete = () => {
    onSuccess()
    handleClose()
  }

  const renderSelectAccounts = () => (
    <>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <div className="mb-3">
          <h6>Select Accounts to Migrate</h6>
          <p className="text-medium-emphasis small">
            Choose which personal accounts you want to migrate to "{organizationName}".
            Migrated accounts will be accessible to all organization members based on their permissions.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-3">
            <CSpinner color="primary" />
          </div>
        ) : accounts.length === 0 ? (
          <CAlert color="info">
            <strong>No accounts to migrate</strong>
            <p className="mb-0 small mt-2">
              You don't have any personal accounts that can be migrated.
              All your accounts are already part of organizations.
            </p>
          </CAlert>
        ) : (
          <>
            <div className="mb-2">
              <CFormCheck
                id="selectAll"
                label={
                  <strong>
                    {selectedAccountIds.size === accounts.length
                      ? 'Deselect All'
                      : 'Select All'}{' '}
                    ({accounts.length} accounts)
                  </strong>
                }
                checked={selectedAccountIds.size === accounts.length}
                onChange={handleSelectAll}
              />
            </div>

            <CTable align="middle" className="mb-0" hover small responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '40px' }}></CTableHeaderCell>
                  <CTableHeaderCell>Account Name</CTableHeaderCell>
                  <CTableHeaderCell>Balance</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {accounts.map((account) => (
                  <CTableRow
                    key={account.id}
                    onClick={() => handleAccountToggle(account.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <CTableDataCell>
                      <CFormCheck
                        checked={selectedAccountIds.has(account.id)}
                        onChange={() => handleAccountToggle(account.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <strong>{account.name}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      ${account.opening_balance.toFixed(2)}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={handleClose} disabled={loading}>
          Cancel
        </CButton>
        <CButton
          color="primary"
          onClick={handleNext}
          disabled={loading || selectedAccountIds.size === 0}
        >
          Next
        </CButton>
      </CModalFooter>
    </>
  )

  const renderConfirm = () => (
    <>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <CAlert color="warning" className="d-flex align-items-start">
          <CIcon icon={cilWarning} className="me-2 mt-1" size="lg" />
          <div>
            <strong>Please Review Migration Details</strong>
            <p className="mb-0 small mt-2">
              You are about to migrate {selectedAccountIds.size} account(s) to the organization
              "{organizationName}". This action will:
            </p>
            <ul className="mb-0 small mt-2">
              <li>Transfer account ownership to the organization</li>
              <li>Re-encrypt account data with the organization master key</li>
              <li>Grant access to organization members based on their permissions</li>
              <li>Maintain end-to-end encryption for all account data</li>
            </ul>
          </div>
        </CAlert>

        <div className="mb-3">
          <h6>Accounts to Migrate:</h6>
          <ul className="mb-0">
            {accounts
              .filter(acc => selectedAccountIds.has(acc.id))
              .map(account => (
                <li key={account.id}>
                  <strong>{account.name}</strong> - ${account.opening_balance.toFixed(2)}
                </li>
              ))}
          </ul>
        </div>

        <CAlert color="info">
          <strong>Important</strong>
          <p className="mb-0 small">
            After migration, these accounts will no longer be personal accounts.
            Organization admins and owners will be able to manage permissions for these accounts.
          </p>
        </CAlert>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={() => setStep(MigrationStep.SELECT_ACCOUNTS)}>
          Back
        </CButton>
        <CButton color="primary" onClick={handleNext}>
          Migrate Accounts
        </CButton>
      </CModalFooter>
    </>
  )

  const renderMigrating = () => (
    <>
      <CModalBody>
        <div className="text-center mb-3">
          <CSpinner color="primary" size="lg" />
        </div>

        <h6 className="text-center mb-3">Migrating Accounts...</h6>

        <CProgress className="mb-2" height={20}>
          <CProgressBar value={progress}>
            {Math.round(progress)}%
          </CProgressBar>
        </CProgress>

        <p className="text-center text-medium-emphasis small mb-0">
          Processing account {currentAccountIndex} of {selectedAccountIds.size}
        </p>

        <CAlert color="warning" className="mt-3">
          <strong>Please do not close this window</strong>
          <p className="mb-0 small">
            The migration process is re-encrypting your account data with the organization key.
            Interrupting this process may result in data corruption.
          </p>
        </CAlert>
      </CModalBody>
    </>
  )

  const renderComplete = () => (
    <>
      <CModalBody>
        <div className="text-center mb-3">
          <CIcon icon={cilCheckCircle} size="3xl" className="text-success" />
        </div>

        <h5 className="text-center mb-3">Migration Complete!</h5>

        <CAlert color="success">
          <strong>Successfully migrated {selectedAccountIds.size} account(s)</strong>
          <p className="mb-0 small mt-2">
            Your accounts have been transferred to "{organizationName}" and are now accessible
            to organization members based on their permissions.
          </p>
        </CAlert>

        <div className="mb-3">
          <h6>Migrated Accounts:</h6>
          <ul className="mb-0">
            {accounts
              .filter(acc => selectedAccountIds.has(acc.id))
              .map(account => (
                <li key={account.id}>
                  <CIcon icon={cilCheckCircle} className="text-success me-2" size="sm" />
                  <strong>{account.name}</strong>
                  <CBadge color="success" className="ms-2" size="sm">Migrated</CBadge>
                </li>
              ))}
          </ul>
        </div>

        <CAlert color="info">
          <strong>What's Next?</strong>
          <p className="mb-0 small">
            You can now manage these accounts from the organization settings page.
            Organization members will be able to access them based on the permissions you set.
          </p>
        </CAlert>
      </CModalBody>

      <CModalFooter>
        <CButton color="primary" onClick={handleComplete}>
          Done
        </CButton>
      </CModalFooter>
    </>
  )

  return (
    <CModal
      visible={visible}
      onClose={handleClose}
      backdrop="static"
      keyboard={step !== MigrationStep.MIGRATING}
      size="lg"
    >
      <CModalHeader closeButton={step !== MigrationStep.MIGRATING}>
        <CModalTitle>Migrate Accounts to Organization</CModalTitle>
      </CModalHeader>

      {step === MigrationStep.SELECT_ACCOUNTS && renderSelectAccounts()}
      {step === MigrationStep.CONFIRM && renderConfirm()}
      {step === MigrationStep.MIGRATING && renderMigrating()}
      {step === MigrationStep.COMPLETE && renderComplete()}
    </CModal>
  )
}

export default MigrateAccountsWizard
