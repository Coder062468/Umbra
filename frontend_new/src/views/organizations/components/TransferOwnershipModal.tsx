/**
 * Transfer Ownership Modal
 * Transfer organization ownership to another member
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
  CFormLabel,
  CFormSelect,
  CAlert,
  CSpinner
} from '@coreui/react-pro'
import { organizationsAPI, OrganizationMember } from '../../../services/api'

interface TransferOwnershipModalProps {
  visible: boolean
  organizationId: string
  members: OrganizationMember[]
  onClose: () => void
  onSuccess: () => void
}

const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  visible,
  organizationId,
  members,
  onClose,
  onSuccess
}) => {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      setError('Please select a member to transfer ownership to')
      return
    }

    const selectedMember = members.find(m => m.user_id === selectedUserId)
    if (!selectedMember) {
      setError('Invalid member selected')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to transfer ownership to ${selectedMember.email}?\n\n` +
      `After transfer:\n` +
      `- ${selectedMember.email} will become the organization owner\n` +
      `- You will become an admin\n` +
      `- This action cannot be reversed by you\n\n` +
      `Only the new owner will be able to transfer ownership again or delete the organization.`
    )

    if (!confirmed) return

    try {
      setLoading(true)
      setError(null)

      await organizationsAPI.transferOwnership(organizationId, {
        new_owner_id: selectedUserId
      })

      onSuccess()
    } catch (err: any) {
      console.error('Failed to transfer ownership:', err)
      setError(
        err.response?.data?.detail || 'Failed to transfer ownership. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedUserId('')
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
        <CModalTitle>Transfer Ownership</CModalTitle>
      </CModalHeader>

      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          <CAlert color="warning">
            <strong>Warning: This is a permanent action</strong>
            <p className="mb-0 small">
              Transferring ownership will give another member full control over this organization.
              You will automatically become an admin and will no longer be able to delete the
              organization or transfer ownership again.
            </p>
          </CAlert>

          <div className="mb-3">
            <CFormLabel htmlFor="newOwner">
              Select New Owner <span className="text-danger">*</span>
            </CFormLabel>
            <CFormSelect
              id="newOwner"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Choose a member...</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.email} ({member.role})
                </option>
              ))}
            </CFormSelect>
            <small className="text-medium-emphasis">
              The selected member will receive full ownership permissions
            </small>
          </div>

          {selectedUserId && (
            <CAlert color="info">
              <p className="mb-2"><strong>What will happen:</strong></p>
              <ul className="mb-0 small">
                <li>Selected member becomes organization owner</li>
                <li>Your role changes to admin</li>
                <li>Owner can delete organization and transfer ownership</li>
                <li>Admin cannot reverse this action</li>
              </ul>
            </CAlert>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton color="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </CButton>
          <CButton color="danger" type="submit" disabled={loading || !selectedUserId}>
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Transferring...
              </>
            ) : (
              'Transfer Ownership'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default TransferOwnershipModal
