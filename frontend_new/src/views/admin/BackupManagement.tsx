/**
 * Backup Management Page
 * Create and manage database backups
 *
 * Features:
 * - List all backups with metadata
 * - Create new backups with optional notes
 * - Restore backups with multi-step confirmation
 * - Download backups for off-site storage
 * - Configure automatic backup scheduling
 * - Display backup size and timestamps
 */

import React, { useState, useEffect } from 'react'
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
  CFormSwitch,
  CRow,
  CCol,
  CButtonGroup
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilCloudDownload, cilPlus, cilReload, cilHistory, cilWarning, cilSettings } from '@coreui/icons'
import { adminAPI, BackupMetadata } from '../../services/api'

interface BackupSchedule {
  schedule: string
  enabled: boolean
  description: string
}

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [backupNotes, setBackupNotes] = useState('')

  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null)
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [restoring, setRestoring] = useState(false)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedule, setSchedule] = useState<BackupSchedule>({
    schedule: '0 2 * * *',
    enabled: false,
    description: ''
  })
  const [schedulePreset, setSchedulePreset] = useState('daily')
  const [savingSchedule, setSavingSchedule] = useState(false)

  useEffect(() => {
    loadBackups()
    loadSchedule()
  }, [])

  const loadBackups = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.listBackups()
      setBackups(response.data)
    } catch (err: any) {
      console.error('Failed to load backups:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load backups')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadSchedule = async () => {
    try {
      const response = await adminAPI.getBackupSchedule()
      setSchedule(response.data)
    } catch (err: any) {
      console.error('Failed to load schedule:', err)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setCreating(true)
      setError(null)
      const response = await adminAPI.createBackup(backupNotes || undefined)

      const result = response.data
      const message = `Backup created successfully!\n\n` +
        `Filename: ${result.filename}\n` +
        `Size: ${formatFileSize(result.size_bytes)}\n` +
        `Location: ${result.backup_path}`

      alert(message)

      setShowCreateModal(false)
      setBackupNotes('')
      await loadBackups()
    } catch (err: any) {
      console.error('Failed to create backup:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to create backup'
      setError(errorMsg)
      alert(`Backup creation failed: ${errorMsg}`)
    } finally {
      setCreating(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (restoreConfirmation !== 'RESTORE') {
      alert('You must type "RESTORE" exactly to confirm')
      return
    }

    if (!selectedBackup) return

    try {
      setRestoring(true)
      setError(null)

      const response = await adminAPI.restoreBackup(selectedBackup.id, 'RESTORE')
      const result = response.data

      alert(`Database restored successfully from ${selectedBackup.filename}!\n\nThe application will reload in 3 seconds...`)

      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (err: any) {
      console.error('Failed to restore backup:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to restore backup'
      setError(errorMsg)
      alert(`Restore failed: ${errorMsg}`)
    } finally {
      setRestoring(false)
      setShowRestoreModal(false)
      setRestoreConfirmation('')
    }
  }

  const handleDownloadBackup = async (backup: BackupMetadata) => {
    try {
      const response = await adminAPI.downloadBackup(backup.id)

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', backup.filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Failed to download backup:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to download backup'
      setError(errorMsg)
      alert(`Download failed: ${errorMsg}`)
    }
  }

  const handleSchedulePresetChange = (preset: string) => {
    setSchedulePreset(preset)
    const presets: Record<string, string> = {
      hourly: '0 * * * *',
      daily: '0 2 * * *',
      weekly: '0 2 * * 0',
      monthly: '0 2 1 * *',
      custom: schedule.schedule
    }
    setSchedule({ ...schedule, schedule: presets[preset] || schedule.schedule })
  }

  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true)
      setError(null)

      await adminAPI.updateBackupSchedule(schedule.schedule, schedule.enabled)

      alert('Backup schedule updated successfully!')
      setShowScheduleModal(false)
      await loadSchedule()
    } catch (err: any) {
      console.error('Failed to update schedule:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to update schedule'
      setError(errorMsg)
      alert(`Schedule update failed: ${errorMsg}`)
    } finally {
      setSavingSchedule(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const handleOpenCreateModal = () => {
    setBackupNotes('')
    setShowCreateModal(true)
  }

  const handleOpenRestoreModal = (backup: BackupMetadata) => {
    setSelectedBackup(backup)
    setRestoreConfirmation('')
    setShowRestoreModal(true)
  }

  const handleOpenScheduleModal = () => {
    setShowScheduleModal(true)
  }

  if (loading && backups.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading backups...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2>Backup Management</h2>
        <p className="text-medium-emphasis">
          Create and manage database backups for disaster recovery
        </p>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Error:</strong> {error}
        </CAlert>
      )}

      {/* Action Buttons */}
      <div className="mb-3 d-flex gap-2">
        <CButton
          color="primary"
          onClick={handleOpenCreateModal}
          disabled={creating}
        >
          <CIcon icon={cilPlus} className="me-1" />
          Create New Backup
        </CButton>
        <CButton
          color="secondary"
          variant="outline"
          onClick={() => loadBackups()}
          disabled={loading}
        >
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
        <CButton
          color="info"
          variant="outline"
          onClick={handleOpenScheduleModal}
        >
          <CIcon icon={cilSettings} className="me-1" />
          Configure Schedule
        </CButton>
      </div>

      {/* Schedule Status */}
      {schedule.enabled && (
        <CAlert color="info" className="mb-3">
          <strong>Automatic Backups Enabled:</strong> {schedule.schedule} (Cron expression)
        </CAlert>
      )}

      {/* Backups Table */}
      <CCard>
        <CCardHeader>
          <strong>Database Backups</strong>
          <span className="text-medium-emphasis ms-2">
            ({backups.length} backup{backups.length !== 1 ? 's' : ''})
          </span>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : backups.length > 0 ? (
            <CTable align="middle" className="mb-0" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Filename</CTableHeaderCell>
                  <CTableHeaderCell>Size</CTableHeaderCell>
                  <CTableHeaderCell>Created</CTableHeaderCell>
                  <CTableHeaderCell>Notes</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {backups.map((backup) => (
                  <CTableRow key={backup.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center">
                        <CIcon icon={cilCloudDownload} className="me-2 text-primary" />
                        <div>
                          <div className="fw-semibold">{backup.filename}</div>
                          <div className="small text-medium-emphasis">
                            {backup.backup_path}
                          </div>
                        </div>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">
                        {formatFileSize(backup.size_bytes)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="small">
                        {formatDate(backup.created_at)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {backup.notes ? (
                        <div className="small">{backup.notes}</div>
                      ) : (
                        <span className="text-medium-emphasis small">No notes</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CButtonGroup size="sm">
                        <CButton
                          color="primary"
                          variant="ghost"
                          onClick={() => handleDownloadBackup(backup)}
                          title="Download backup"
                        >
                          <CIcon icon={cilCloudDownload} />
                        </CButton>
                        <CButton
                          color="danger"
                          variant="ghost"
                          onClick={() => handleOpenRestoreModal(backup)}
                          title="Restore from backup"
                        >
                          <CIcon icon={cilHistory} />
                        </CButton>
                      </CButtonGroup>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          ) : (
            <CAlert color="info">
              No backups found. Create your first backup to get started.
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      {/* Information Cards */}
      <CRow className="mt-4">
        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <strong>Backup Information</strong>
            </CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <div className="text-medium-emphasis small">Total Backups</div>
                <div className="fs-4 fw-semibold">{backups.length}</div>
              </div>
              <div className="mb-3">
                <div className="text-medium-emphasis small">Total Storage Used</div>
                <div className="fs-4 fw-semibold">
                  {formatFileSize(backups.reduce((sum, b) => sum + b.size_bytes, 0))}
                </div>
              </div>
              {backups.length > 0 && (
                <div>
                  <div className="text-medium-emphasis small">Latest Backup</div>
                  <div className="fw-semibold">
                    {formatDate(backups[0].created_at)}
                  </div>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <strong>Backup Schedule</strong>
            </CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <div className="text-medium-emphasis small">Status</div>
                <div className="fs-5 fw-semibold">
                  {schedule.enabled ? (
                    <span className="text-success">Enabled</span>
                  ) : (
                    <span className="text-danger">Disabled</span>
                  )}
                </div>
              </div>
              {schedule.enabled && (
                <div className="mb-3">
                  <div className="text-medium-emphasis small">Schedule</div>
                  <div className="fw-semibold">{schedule.schedule}</div>
                  <div className="small text-medium-emphasis">{schedule.description}</div>
                </div>
              )}
              <CButton
                color="info"
                size="sm"
                onClick={handleOpenScheduleModal}
              >
                Configure Schedule
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard>
            <CCardHeader>
              <strong>Best Practices</strong>
            </CCardHeader>
            <CCardBody>
              <ul className="small mb-0">
                <li>Create backups before major changes</li>
                <li>Store backups off-site for safety</li>
                <li>Test restoration regularly</li>
                <li>Keep multiple backup versions</li>
                <li>Enable automatic scheduling</li>
              </ul>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CAlert color="warning" className="mt-4">
        <strong>Important:</strong> Backups are stored on the server filesystem.
        Download backups regularly for off-site disaster recovery.
      </CAlert>

      {/* Create Backup Modal */}
      <CModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>Create Database Backup</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel htmlFor="backupNotes">
                Backup Notes <span className="text-medium-emphasis">(Optional)</span>
              </CFormLabel>
              <CFormTextarea
                id="backupNotes"
                rows={3}
                placeholder="Enter notes to identify this backup (e.g., 'Before version 2.0 upgrade')"
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
                disabled={creating}
              />
              <div className="form-text">
                Notes help identify the purpose of this backup
              </div>
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowCreateModal(false)}
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
                Creating Backup...
              </>
            ) : (
              <>
                <CIcon icon={cilPlus} className="me-1" />
                Create Backup
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
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilWarning} className="text-danger me-2" />
            Restore Database Backup
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="danger">
            <strong>DANGER: This action cannot be undone!</strong>
            <p className="mb-0 mt-2">
              This will DROP the current database and restore from the selected backup.
              All current data will be PERMANENTLY LOST.
            </p>
          </CAlert>

          {selectedBackup && (
            <div className="mb-3">
              <strong>Backup to restore:</strong>
              <div className="mt-2 p-2 bg-light rounded">
                <div><strong>File:</strong> {selectedBackup.filename}</div>
                <div><strong>Size:</strong> {formatFileSize(selectedBackup.size_bytes)}</div>
                <div><strong>Created:</strong> {formatDate(selectedBackup.created_at)}</div>
                {selectedBackup.notes && <div><strong>Notes:</strong> {selectedBackup.notes}</div>}
              </div>
            </div>
          )}

          <div className="mb-3">
            <CFormLabel htmlFor="restoreConfirmation">
              Type <strong>RESTORE</strong> to confirm:
            </CFormLabel>
            <CFormInput
              id="restoreConfirmation"
              type="text"
              value={restoreConfirmation}
              onChange={(e) => setRestoreConfirmation(e.target.value)}
              placeholder="Type RESTORE here"
              disabled={restoring}
            />
          </div>
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
            color="danger"
            onClick={handleRestoreBackup}
            disabled={restoring || restoreConfirmation !== 'RESTORE'}
          >
            {restoring ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Restoring...
              </>
            ) : (
              <>
                <CIcon icon={cilHistory} className="me-1" />
                Restore Database
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Schedule Configuration Modal */}
      <CModal
        visible={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        alignment="center"
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>Configure Backup Schedule</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormSwitch
                id="scheduleEnabled"
                label="Enable automatic backups"
                checked={schedule.enabled}
                onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
              />
              <div className="form-text">
                When enabled, backups will be created automatically according to the schedule below
              </div>
            </div>

            {schedule.enabled && (
              <>
                <div className="mb-3">
                  <CFormLabel htmlFor="schedulePreset">Schedule Preset</CFormLabel>
                  <CFormSelect
                    id="schedulePreset"
                    value={schedulePreset}
                    onChange={(e) => handleSchedulePresetChange(e.target.value)}
                  >
                    <option value="hourly">Hourly (every hour)</option>
                    <option value="daily">Daily (2:00 AM)</option>
                    <option value="weekly">Weekly (Sunday 2:00 AM)</option>
                    <option value="monthly">Monthly (1st day, 2:00 AM)</option>
                    <option value="custom">Custom (cron expression)</option>
                  </CFormSelect>
                </div>

                <div className="mb-3">
                  <CFormLabel htmlFor="cronExpression">
                    Cron Expression
                    {schedulePreset !== 'custom' && (
                      <span className="text-medium-emphasis ms-2">(Generated from preset)</span>
                    )}
                  </CFormLabel>
                  <CFormInput
                    id="cronExpression"
                    type="text"
                    value={schedule.schedule}
                    onChange={(e) => setSchedule({ ...schedule, schedule: e.target.value })}
                    placeholder="0 2 * * *"
                    disabled={schedulePreset !== 'custom'}
                  />
                  <div className="form-text">
                    Format: minute hour day month day_of_week (e.g., "0 2 * * *" = Daily at 2:00 AM)
                  </div>
                </div>

                <CAlert color="info">
                  <strong>Next backup:</strong> Based on the schedule, the next automatic backup
                  will run according to the cron expression "{schedule.schedule}".
                </CAlert>
              </>
            )}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowScheduleModal(false)}
            disabled={savingSchedule}
          >
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={handleSaveSchedule}
            disabled={savingSchedule}
          >
            {savingSchedule ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Saving...
              </>
            ) : (
              <>
                <CIcon icon={cilSettings} className="me-1" />
                Save Schedule
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default BackupManagement
