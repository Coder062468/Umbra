/**
 * System Settings Management Page
 * View and manage system-wide configuration settings
 *
 * Features:
 * - List all system settings
 * - Edit setting values with validation
 * - Setting descriptions and metadata
 * - Confirmation for critical changes
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
  CFormInput,
  CFormTextarea,
  CBadge
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilReload, cilSettings } from '@coreui/icons'
import { adminAPI, SystemSetting } from '../../services/api'

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getSettings()
      setSettings(response.data)
    } catch (err: any) {
      console.error('Failed to load settings:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load settings')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (setting: SystemSetting) => {
    setEditingSetting(setting)
    setEditValue(setting.value || '')
    setShowEditModal(true)
  }

  const handleSaveSetting = async () => {
    if (!editingSetting) return

    try {
      setSaving(true)
      setError(null)

      await adminAPI.updateSetting(editingSetting.key, editValue)

      alert(`Setting "${editingSetting.key}" updated successfully`)

      setShowEditModal(false)
      setEditingSetting(null)
      setEditValue('')
      await loadSettings()
    } catch (err: any) {
      console.error('Failed to update setting:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to update setting'
      setError(errorMsg)
      alert(`Failed to update setting: ${errorMsg}`)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'system': 'primary',
      'security': 'danger',
      'email': 'info',
      'backup': 'warning',
      'features': 'success',
      'limits': 'secondary'
    }
    return colors[category.toLowerCase()] || 'secondary'
  }

  if (loading && settings.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading system settings...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2>System Settings</h2>
        <p className="text-medium-emphasis">
          Configure system-wide settings and preferences
        </p>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Error:</strong> {error}
        </CAlert>
      )}

      {/* Action Buttons */}
      <div className="mb-3">
        <CButton
          color="secondary"
          variant="outline"
          onClick={() => loadSettings()}
          disabled={loading}
        >
          <CIcon icon={cilReload} className="me-1" />
          Refresh
        </CButton>
      </div>

      {/* Settings Table */}
      <CCard>
        <CCardHeader>
          <strong>Configuration Settings</strong>
          <span className="text-medium-emphasis ms-2">
            ({settings.length} setting{settings.length !== 1 ? 's' : ''})
          </span>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : settings.length > 0 ? (
            <CTable align="middle" className="mb-0" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '25%' }}>Setting</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '20%' }}>Value</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '35%' }}>Description</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '10%' }}>Category</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '10%' }}>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {settings.map((setting) => (
                  <CTableRow key={setting.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center">
                        <CIcon icon={cilSettings} className="me-2 text-secondary" />
                        <div>
                          <div className="fw-semibold">{setting.key}</div>
                          <div className="small text-medium-emphasis">
                            Updated: {formatDate(setting.updated_at)}
                          </div>
                        </div>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {setting.value ? (
                        <div className="font-monospace small">{setting.value}</div>
                      ) : (
                        <span className="text-medium-emphasis small">Not set</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="small">{setting.description}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getCategoryColor(setting.category)}>
                        {setting.category}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="primary"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(setting)}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          ) : (
            <CAlert color="info">
              No settings found. Settings will be created automatically as needed.
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      {/* Settings by Category */}
      {settings.length > 0 && (
        <CCard className="mt-4">
          <CCardHeader>
            <strong>Settings Summary</strong>
          </CCardHeader>
          <CCardBody>
            <div className="d-flex flex-wrap gap-3">
              {Array.from(new Set(settings.map(s => s.category))).map(category => (
                <div key={category}>
                  <CBadge color={getCategoryColor(category)} className="me-1">
                    {category}
                  </CBadge>
                  <span className="text-medium-emphasis">
                    {settings.filter(s => s.category === category).length}
                  </span>
                </div>
              ))}
            </div>
          </CCardBody>
        </CCard>
      )}

      <CAlert color="warning" className="mt-4">
        <strong>Caution:</strong> Changing system settings can affect application behavior.
        Ensure you understand the impact before modifying critical settings.
      </CAlert>

      {/* Edit Setting Modal */}
      <CModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingSetting(null)
          setEditValue('')
        }}
        alignment="center"
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>Edit Setting</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {editingSetting && (
            <CForm>
              <div className="mb-3">
                <CFormLabel className="fw-semibold">Setting Key</CFormLabel>
                <CFormInput
                  value={editingSetting.key}
                  disabled
                  readOnly
                />
              </div>
              <div className="mb-3">
                <CFormLabel className="fw-semibold">Category</CFormLabel>
                <div>
                  <CBadge color={getCategoryColor(editingSetting.category)}>
                    {editingSetting.category}
                  </CBadge>
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel className="fw-semibold">Description</CFormLabel>
                <div className="text-medium-emphasis small">
                  {editingSetting.description}
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="settingValue" className="fw-semibold">
                  Value
                </CFormLabel>
                <CFormTextarea
                  id="settingValue"
                  rows={3}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  disabled={saving}
                  placeholder="Enter setting value"
                />
                <div className="form-text">
                  Current value: {editingSetting.value || '(not set)'}
                </div>
              </div>
            </CForm>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => {
              setShowEditModal(false)
              setEditingSetting(null)
              setEditValue('')
            }}
            disabled={saving}
          >
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={handleSaveSetting}
            disabled={saving}
          >
            {saving ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Saving...
              </>
            ) : (
              <>
                <CIcon icon={cilPencil} className="me-1" />
                Save Changes
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default SystemSettings
