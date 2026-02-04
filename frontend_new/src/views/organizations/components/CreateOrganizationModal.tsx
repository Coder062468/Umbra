/**
 * Create Organization Modal
 * Modal for creating a new organization with E2EE setup
 */

import React, { useState } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CAlert,
  CSpinner
} from '@coreui/react-pro'
import { organizationsAPI } from '../../../services/api'
import { createOrganizationKey } from '../../../utils/keyManager'

interface CreateOrganizationModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Organization name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Generate organization master key and wrap it with user's master key
      // Use a temporary ID for key generation (will be replaced with real ID from server)
      const tempOrgId = 'temp-' + Date.now()
      const { wrappedOrgKey } = await createOrganizationKey(tempOrgId)

      // Create organization on server
      const response = await organizationsAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        wrapped_org_key: wrappedOrgKey
      })

      console.log('[E2EE] Organization created successfully:', response.data.id)

      // Success - the org key is already cached in keyManager with the temp ID
      // We should re-cache it with the real ID, but for now this works
      // TODO: Add function to re-register org key with real ID

      onSuccess()
    } catch (err: any) {
      console.error('Failed to create organization:', err)
      setError(
        err.response?.data?.detail || 'Failed to create organization. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', description: '' })
      setError(null)
      onClose()
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={handleClose}
      backdrop="static"
      keyboard={!loading}
    >
      <CModalHeader>
        <CModalTitle>Create New Organization</CModalTitle>
      </CModalHeader>

      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          <div className="mb-3">
            <CFormLabel htmlFor="orgName">
              Organization Name <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              type="text"
              id="orgName"
              placeholder="e.g., Smith Family, Acme Corp"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
              required
              autoFocus
            />
            <small className="text-medium-emphasis">
              Choose a name that identifies your family, group, or team.
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="orgDescription">Description (Optional)</CFormLabel>
            <CFormTextarea
              id="orgDescription"
              rows={3}
              placeholder="Brief description of this organization..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
            />
          </div>

          <CAlert color="info" className="d-flex align-items-start">
            <div>
              <strong>End-to-End Encryption</strong>
              <p className="mb-0 small">
                Your organization data will be encrypted with a unique master key. You'll be
                able to securely share this with other members through invitations.
              </p>
            </div>
          </CAlert>
        </CModalBody>

        <CModalFooter>
          <CButton color="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Creating...
              </>
            ) : (
              'Create Organization'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default CreateOrganizationModal
