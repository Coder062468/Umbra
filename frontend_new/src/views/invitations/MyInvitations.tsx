/**
 * My Invitations Page
 * View and manage pending organization invitations
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
  CBadge,
  CButtonGroup
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilXCircle, cilEnvelopeOpen } from '@coreui/icons'
import { invitationsAPI, Invitation } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const MyInvitations: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadInvitations = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await invitationsAPI.getMyInvitations()
      setInvitations(response.data)
    } catch (err: any) {
      console.error('Failed to load invitations:', err)
      setError(err.response?.data?.detail || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const handleAccept = async (token: string, invitationId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to accept this invitation?\n\n' +
      'You will gain access to the organization and its encrypted data.'
    )

    if (!confirmed) return

    try {
      setProcessingId(invitationId)
      setError(null)

      // Get the invitation to access wrapped_org_key
      const acceptedInvitation = invitations.find(inv => inv.id === invitationId)
      if (!acceptedInvitation) {
        throw new Error('Invitation not found')
      }

      console.log('[MyInvitations] About to unwrap invitation org key:', {
        invitationId: acceptedInvitation.id,
        hasWrappedKey: !!acceptedInvitation.wrapped_org_key,
        wrappedKeyType: typeof acceptedInvitation.wrapped_org_key,
        wrappedKeyLength: acceptedInvitation.wrapped_org_key?.length,
        wrappedKeyFirst50: acceptedInvitation.wrapped_org_key?.substring(0, 50)
      })

      // E2EE: Unwrap RSA-encrypted key and re-wrap with master key
      const { unwrapInvitationOrgKey } = await import('../../utils/keyManager')
      const wrappedOrgKey = await unwrapInvitationOrgKey(acceptedInvitation.wrapped_org_key)

      // Accept invitation with re-wrapped key
      await invitationsAPI.accept(token, wrappedOrgKey)

      setInvitations(invitations.filter(inv => inv.id !== invitationId))
      navigate(`/organizations/${acceptedInvitation.organization_id}`)
    } catch (err: any) {
      console.error('Failed to accept invitation:', err)

      // Check for encryption key errors
      if (err.message?.includes('Master key not initialised') ||
          err.message?.includes('RSA private key not found')) {
        setError(
          'Encryption keys not loaded. Please log out and log back in to initialize your encryption keys, then try accepting the invitation again.'
        )
      } else {
        setError(
          err.response?.data?.detail || 'Failed to accept invitation. Please try again.'
        )
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (token: string, invitationId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to reject this invitation?\n\n' +
      'This action cannot be undone. You will need to request a new invitation to join this organization.'
    )

    if (!confirmed) return

    try {
      setProcessingId(invitationId)
      setError(null)

      await invitationsAPI.reject(token)

      setInvitations(invitations.filter(inv => inv.id !== invitationId))
    } catch (err: any) {
      console.error('Failed to reject invitation:', err)
      setError(
        err.response?.data?.detail || 'Failed to reject invitation. Please try again.'
      )
    } finally {
      setProcessingId(null)
    }
  }

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'danger'
      case 'admin':
        return 'warning'
      case 'member':
        return 'info'
      case 'viewer':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <div className="container-lg">
      <CCard>
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <CIcon icon={cilEnvelopeOpen} className="me-2" />
              My Invitations
            </h5>
            <CBadge color="info" size="sm">
              {invitations.length} pending
            </CBadge>
          </div>
        </CCardHeader>

        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          {invitations.length === 0 ? (
            <CAlert color="info">
              <strong>No pending invitations</strong>
              <p className="mb-0 small mt-2">
                When someone invites you to join their organization, the invitation will appear here.
                You can accept or reject invitations to manage which organizations you are part of.
              </p>
            </CAlert>
          ) : (
            <CTable align="middle" className="mb-0" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Organization</CTableHeaderCell>
                  <CTableHeaderCell>Role</CTableHeaderCell>
                  <CTableHeaderCell>Invited By</CTableHeaderCell>
                  <CTableHeaderCell>Message</CTableHeaderCell>
                  <CTableHeaderCell>Invited On</CTableHeaderCell>
                  <CTableHeaderCell>Expires</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {invitations.map((invitation) => {
                  const expired = isExpired(invitation.expires_at)
                  const isProcessing = processingId === invitation.id

                  return (
                    <CTableRow key={invitation.id}>
                      <CTableDataCell>
                        <div>
                          <strong>{invitation.organization_name}</strong>
                        </div>
                        {invitation.organization_description && (
                          <small className="text-medium-emphasis">
                            {invitation.organization_description}
                          </small>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={getRoleBadgeColor(invitation.role)} size="sm">
                          {invitation.role}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <small className="text-medium-emphasis">
                          {invitation.invited_by_email}
                        </small>
                      </CTableDataCell>
                      <CTableDataCell>
                        {invitation.message ? (
                          <small className="text-medium-emphasis">
                            {invitation.message}
                          </small>
                        ) : (
                          <small className="text-medium-emphasis fst-italic">
                            No message
                          </small>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <small className="text-medium-emphasis">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </small>
                      </CTableDataCell>
                      <CTableDataCell>
                        {expired ? (
                          <CBadge color="danger" size="sm">Expired</CBadge>
                        ) : (
                          <small className="text-medium-emphasis">
                            {new Date(invitation.expires_at).toLocaleDateString()}
                          </small>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {expired ? (
                          <small className="text-danger">Invitation expired</small>
                        ) : (
                          <CButtonGroup size="sm">
                            <CButton
                              color="success"
                              variant="outline"
                              onClick={() => handleAccept(invitation.token, invitation.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <CSpinner size="sm" />
                              ) : (
                                <>
                                  <CIcon icon={cilCheckCircle} className="me-1" />
                                  Accept
                                </>
                              )}
                            </CButton>
                            <CButton
                              color="danger"
                              variant="outline"
                              onClick={() => handleReject(invitation.token, invitation.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <CSpinner size="sm" />
                              ) : (
                                <>
                                  <CIcon icon={cilXCircle} className="me-1" />
                                  Reject
                                </>
                              )}
                            </CButton>
                          </CButtonGroup>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default MyInvitations
