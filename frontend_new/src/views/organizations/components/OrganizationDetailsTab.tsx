/**
 * Organization Details Tab
 * View and edit organization basic information
 */

import React, { useState } from 'react'
import {
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CButton,
  CAlert,
  CSpinner,
  CRow,
  CCol,
  CBadge
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilSave, cilPencil } from '@coreui/icons'
import { organizationsAPI, Organization } from '../../../services/api'

interface OrganizationDetailsTabProps {
  organization: Organization
  onUpdate: () => void
}

const OrganizationDetailsTab: React.FC<OrganizationDetailsTabProps> = ({
  organization,
  onUpdate
}) => {
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: organization.name,
    description: organization.description || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canEdit = organization.role === 'owner' || organization.role === 'admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Organization name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      await organizationsAPI.update(organization.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      })

      setSuccess(true)
      setEditing(false)
      onUpdate()

      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to update organization:', err)
      setError(err.response?.data?.detail || 'Failed to update organization')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: organization.name,
      description: organization.description || ''
    })
    setEditing(false)
    setError(null)
  }

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'owner': return 'danger'
      case 'admin': return 'warning'
      case 'member': return 'info'
      case 'viewer': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}

      {success && (
        <CAlert color="success" dismissible onClose={() => setSuccess(false)}>
          Organization updated successfully
        </CAlert>
      )}

      <CForm onSubmit={handleSubmit}>
        <CRow className="mb-4">
          <CCol md={6}>
            <div className="mb-3">
              <CFormLabel>Organization ID</CFormLabel>
              <CFormInput
                type="text"
                value={organization.id}
                disabled
                readOnly
              />
              <small className="text-medium-emphasis">Unique identifier for this organization</small>
            </div>
          </CCol>
          <CCol md={6}>
            <div className="mb-3">
              <CFormLabel>Your Role</CFormLabel>
              <div>
                <CBadge color={getRoleBadgeColor(organization.role)} size="lg">
                  {organization.role.toUpperCase()}
                </CBadge>
              </div>
              <small className="text-medium-emphasis">
                Your permission level in this organization
              </small>
            </div>
          </CCol>
        </CRow>

        <CRow className="mb-4">
          <CCol md={6}>
            <div className="mb-3">
              <CFormLabel>Created</CFormLabel>
              <CFormInput
                type="text"
                value={new Date(organization.created_at).toLocaleString()}
                disabled
                readOnly
              />
            </div>
          </CCol>
          <CCol md={6}>
            <div className="mb-3">
              <CFormLabel>Last Updated</CFormLabel>
              <CFormInput
                type="text"
                value={new Date(organization.updated_at).toLocaleString()}
                disabled
                readOnly
              />
            </div>
          </CCol>
        </CRow>

        <hr className="my-4" />

        <div className="mb-3">
          <CFormLabel htmlFor="orgName">
            Organization Name {canEdit && <span className="text-danger">*</span>}
          </CFormLabel>
          <CFormInput
            type="text"
            id="orgName"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!editing || loading}
            readOnly={!canEdit}
            required
          />
        </div>

        <div className="mb-3">
          <CFormLabel htmlFor="orgDescription">Description</CFormLabel>
          <CFormTextarea
            id="orgDescription"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={!editing || loading}
            readOnly={!canEdit}
          />
        </div>

        {canEdit && (
          <div className="d-flex gap-2">
            {!editing ? (
              <CButton
                color="primary"
                onClick={() => setEditing(true)}
              >
                <CIcon icon={cilPencil} className="me-1" />
                Edit Details
              </CButton>
            ) : (
              <>
                <CButton
                  color="primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CIcon icon={cilSave} className="me-1" />
                      Save Changes
                    </>
                  )}
                </CButton>
                <CButton
                  color="secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </CButton>
              </>
            )}
          </div>
        )}
      </CForm>

      <CAlert color="info" className="mt-4">
        <strong>End-to-End Encryption</strong>
        <p className="mb-0 small">
          All accounts and transactions in this organization are protected with end-to-end encryption.
          Only members with the organization key can access the encrypted data.
        </p>
      </CAlert>
    </div>
  )
}

export default OrganizationDetailsTab
