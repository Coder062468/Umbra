/**
 * Invite Member Modal
 * Send invitation to new member with E2EE key sharing
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
  CFormSelect,
  CAlert,
  CSpinner
} from '@coreui/react-pro'
import { organizationsAPI, RoleEnum } from '../../../services/api'
import { wrapOrganizationKeyForInvitee } from '../../../utils/keyManager'

interface InviteMemberModalProps {
  visible: boolean
  organizationId: string
  onClose: () => void
  onSuccess: () => void
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  visible,
  organizationId,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as RoleEnum,
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Wrap organization key for the invitee using RSA public key encryption
      const wrappedOrgKey = await wrapOrganizationKeyForInvitee(
        organizationId,
        formData.email.trim()
      )

      await organizationsAPI.createInvitation(organizationId, {
        email: formData.email.trim(),
        role: formData.role,
        wrapped_org_key: wrappedOrgKey,
        message: formData.message.trim() || undefined
      })

      onSuccess()
    } catch (err: any) {
      console.error('Failed to send invitation:', err)
      setError(
        err.response?.data?.detail || 'Failed to send invitation. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({ email: '', role: 'member', message: '' })
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
        <CModalTitle>Invite Member</CModalTitle>
      </CModalHeader>

      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          <div className="mb-3">
            <CFormLabel htmlFor="inviteEmail">
              Email Address <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              type="email"
              id="inviteEmail"
              placeholder="member@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
              required
              autoFocus
            />
            <small className="text-medium-emphasis">
              The person you invite will receive an email notification
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="inviteRole">
              Role <span className="text-danger">*</span>
            </CFormLabel>
            <CFormSelect
              id="inviteRole"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as RoleEnum })}
              disabled={loading}
              required
            >
              <option value="admin">Admin - Can manage accounts and members</option>
              <option value="member">Member - Can view and edit transactions</option>
              <option value="viewer">Viewer - Read-only access</option>
            </CFormSelect>
            <small className="text-medium-emphasis">
              You can change their role later if needed
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="inviteMessage">Personal Message (Optional)</CFormLabel>
            <CFormTextarea
              id="inviteMessage"
              rows={3}
              placeholder="Add a personal note to your invitation..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              disabled={loading}
              maxLength={500}
            />
            <small className="text-medium-emphasis">
              {formData.message.length}/500 characters
            </small>
          </div>

          <CAlert color="warning" className="d-flex align-items-start">
            <div>
              <strong>Important</strong>
              <p className="mb-0 small">
                The invitee must have an account with this email address to accept the invitation.
                They will receive secure access to all encrypted data through the invitation.
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
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default InviteMemberModal
