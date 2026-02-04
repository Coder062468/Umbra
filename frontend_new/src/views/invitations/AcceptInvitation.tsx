/**
 * Accept Invitation Page
 * Standalone page for accepting organization invitations via email link
 * Route: /invitations/:token/accept
 */

import React, { useState, useEffect } from 'react'
import {
  CContainer,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CSpinner,
  CAlert,
  CBadge,
  CRow,
  CCol,
  CButtonGroup
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import {
  cilCheckCircle,
  cilXCircle,
  cilLayers,
  cilUser,
  cilCalendar,
  cilEnvelopeOpen,
  cilWarning
} from '@coreui/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { invitationsAPI, Invitation } from '../../services/api'
import { loadOrganizationKey } from '../../utils/keyManager'

const AcceptInvitation: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.')
      setLoading(false)
      return
    }

    loadInvitation()
  }, [token])

  const loadInvitation = async () => {
    if (!token) return

    try {
      setLoading(true)
      setError(null)
      const response = await invitationsAPI.getByToken(token)
      setInvitation(response.data)
    } catch (err: any) {
      console.error('Failed to load invitation:', err)

      if (err.response?.status === 401) {
        setError(
          'You must be logged in to view this invitation. Please log in and try again.'
        )
      } else if (err.response?.status === 403) {
        setError(
          'This invitation is for a different email address. Please log in with the correct account.'
        )
      } else if (err.response?.status === 404) {
        setError(
          'Invitation not found or has expired. Please contact the person who invited you.'
        )
      } else {
        setError(
          err.response?.data?.detail || 'Failed to load invitation. Please check the link and try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!token || !invitation) return

    const confirmed = window.confirm(
      `Are you sure you want to accept this invitation to join "${invitation.organization_name}"?\n\n` +
      `You will be granted ${invitation.role} access to the organization and its encrypted data.`
    )

    if (!confirmed) return

    try {
      setProcessing(true)
      setError(null)
      setSuccess(null)

      if (!invitation.wrapped_org_key) {
        throw new Error('Invitation does not contain encryption key')
      }

      // E2EE: Unwrap RSA-encrypted key and re-wrap with master key
      const { unwrapInvitationOrgKey } = await import('../../utils/keyManager')
      const wrappedOrgKey = await unwrapInvitationOrgKey(invitation.wrapped_org_key)

      // Accept invitation with re-wrapped key
      await invitationsAPI.accept(token, wrappedOrgKey)

      setSuccess(
        `Successfully joined ${invitation.organization_name}! Redirecting to organization...`
      )

      setTimeout(() => {
        navigate(`/organizations/${invitation.organization_id}`)
      }, 2000)

    } catch (err: any) {
      console.error('Failed to accept invitation:', err)

      // Check for encryption key errors
      if (err.message?.includes('Master key not initialised') ||
          err.message?.includes('RSA private key not found')) {
        setError(
          'Encryption keys not loaded. Please log out and log back in to initialize your encryption keys, then try accepting the invitation again.'
        )
      } else if (err.response?.status === 400) {
        const detail = err.response?.data?.detail || ''
        if (detail.includes('already a member')) {
          setError('You are already a member of this organization.')
          setTimeout(() => {
            navigate(`/organizations/${invitation.organization_id}`)
          }, 2000)
        } else {
          setError(detail || 'Unable to accept invitation. Please try again.')
        }
      } else if (err.response?.status === 404) {
        setError('Invitation has expired or been cancelled.')
      } else {
        setError(
          err.response?.data?.detail || 'Failed to accept invitation. Please try again.'
        )
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!token || !invitation) return

    const confirmed = window.confirm(
      `Are you sure you want to reject this invitation to join "${invitation.organization_name}"?\n\n` +
      'This action cannot be undone. You will need a new invitation to join this organization.'
    )

    if (!confirmed) return

    try {
      setProcessing(true)
      setError(null)
      setSuccess(null)

      await invitationsAPI.reject(token)

      setSuccess('Invitation rejected. Redirecting...')

      setTimeout(() => {
        navigate('/invitations')
      }, 2000)

    } catch (err: any) {
      console.error('Failed to reject invitation:', err)
      setError(
        err.response?.data?.detail || 'Failed to reject invitation. Please try again.'
      )
    } finally {
      setProcessing(false)
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={8} lg={6}>
              <div className="text-center">
                <CSpinner color="primary" size="lg" />
                <p className="text-medium-emphasis mt-3">Loading invitation details...</p>
              </div>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={8} lg={6}>
              <CCard>
                <CCardBody className="text-center p-5">
                  <CIcon icon={cilWarning} size="4xl" className="text-danger mb-4" />
                  <h3 className="mb-3">Unable to Load Invitation</h3>
                  <CAlert color="danger" className="text-start">
                    {error}
                  </CAlert>
                  <div className="mt-4">
                    <CButton
                      color="primary"
                      variant="outline"
                      onClick={() => navigate('/invitations')}
                      className="me-2"
                    >
                      View My Invitations
                    </CButton>
                    <CButton
                      color="secondary"
                      variant="outline"
                      onClick={() => navigate('/organizations')}
                    >
                      Go to Organizations
                    </CButton>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={8} lg={6}>
              <CCard>
                <CCardBody className="text-center p-5">
                  <CIcon icon={cilWarning} size="4xl" className="text-warning mb-4" />
                  <h3 className="mb-3">Invitation Not Found</h3>
                  <p className="text-medium-emphasis">
                    The invitation could not be found. It may have been cancelled or already accepted.
                  </p>
                  <CButton
                    color="primary"
                    onClick={() => navigate('/invitations')}
                    className="mt-3"
                  >
                    View My Invitations
                  </CButton>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  const expired = isExpired(invitation.expires_at)
  const alreadyAccepted = !!invitation.accepted_at
  const alreadyRejected = !!invitation.rejected_at

  return (
    <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={10} lg={8}>
            <CCard>
              <CCardHeader className="bg-white">
                <div className="text-center">
                  <CIcon icon={cilEnvelopeOpen} size="3xl" className="text-primary mb-3" />
                  <h3 className="mb-0">Organization Invitation</h3>
                </div>
              </CCardHeader>

              <CCardBody className="p-4">
                {success && (
                  <CAlert color="success" className="d-flex align-items-center">
                    <CIcon icon={cilCheckCircle} className="me-2" />
                    {success}
                  </CAlert>
                )}

                {error && (
                  <CAlert color="danger" dismissible onClose={() => setError(null)}>
                    {error}
                  </CAlert>
                )}

                {expired && !alreadyAccepted && !alreadyRejected && (
                  <CAlert color="danger" className="d-flex align-items-center">
                    <CIcon icon={cilWarning} className="me-2" />
                    <div>
                      <strong>This invitation has expired</strong>
                      <p className="mb-0 small mt-1">
                        Please contact {invitation.invited_by_email} to request a new invitation.
                      </p>
                    </div>
                  </CAlert>
                )}

                {alreadyAccepted && (
                  <CAlert color="info" className="d-flex align-items-center">
                    <CIcon icon={cilCheckCircle} className="me-2" />
                    <div>
                      <strong>You already accepted this invitation</strong>
                      <p className="mb-0 small mt-1">
                        Accepted on {formatDate(invitation.accepted_at!)}
                      </p>
                    </div>
                  </CAlert>
                )}

                {alreadyRejected && (
                  <CAlert color="warning" className="d-flex align-items-center">
                    <CIcon icon={cilXCircle} className="me-2" />
                    <div>
                      <strong>You already rejected this invitation</strong>
                      <p className="mb-0 small mt-1">
                        Rejected on {formatDate(invitation.rejected_at!)}
                      </p>
                    </div>
                  </CAlert>
                )}

                <div className="mb-4">
                  <h5>
                    <CIcon icon={cilLayers} className="me-2" />
                    {invitation.organization_name}
                  </h5>
                  <p className="text-medium-emphasis mb-0">
                    You've been invited to join this organization
                  </p>
                </div>

                <CRow className="mb-4">
                  <CCol md={6} className="mb-3">
                    <div className="d-flex align-items-center">
                      <CIcon icon={cilUser} className="me-2 text-medium-emphasis" />
                      <div>
                        <small className="text-medium-emphasis d-block">Role</small>
                        <CBadge color={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </CBadge>
                      </div>
                    </div>
                  </CCol>

                  <CCol md={6} className="mb-3">
                    <div className="d-flex align-items-center">
                      <CIcon icon={cilUser} className="me-2 text-medium-emphasis" />
                      <div>
                        <small className="text-medium-emphasis d-block">Invited By</small>
                        <strong>{invitation.invited_by_email}</strong>
                      </div>
                    </div>
                  </CCol>

                  <CCol md={6} className="mb-3">
                    <div className="d-flex align-items-center">
                      <CIcon icon={cilCalendar} className="me-2 text-medium-emphasis" />
                      <div>
                        <small className="text-medium-emphasis d-block">Invited On</small>
                        <strong>{formatDate(invitation.created_at)}</strong>
                      </div>
                    </div>
                  </CCol>

                  <CCol md={6} className="mb-3">
                    <div className="d-flex align-items-center">
                      <CIcon icon={cilCalendar} className="me-2 text-medium-emphasis" />
                      <div>
                        <small className="text-medium-emphasis d-block">
                          {expired ? 'Expired On' : 'Expires On'}
                        </small>
                        <strong className={expired ? 'text-danger' : ''}>
                          {formatDate(invitation.expires_at)}
                        </strong>
                      </div>
                    </div>
                  </CCol>
                </CRow>

                {invitation.message && (
                  <CAlert color="info" className="mb-4">
                    <strong>Personal Message</strong>
                    <p className="mb-0 mt-2">{invitation.message}</p>
                  </CAlert>
                )}

                <div className="border-top pt-4">
                  <h6 className="mb-3">What happens when you accept?</h6>
                  <ul className="small text-medium-emphasis">
                    <li>You will become a {invitation.role} of {invitation.organization_name}</li>
                    <li>You will gain access to shared accounts and data</li>
                    <li>All data remains end-to-end encrypted</li>
                    <li>Your actions will be logged in the organization's audit log</li>
                  </ul>
                </div>

                <div className="d-grid gap-2 d-md-flex justify-content-md-center mt-4">
                  {!expired && !alreadyAccepted && !alreadyRejected && (
                    <>
                      <CButton
                        color="success"
                        size="lg"
                        onClick={handleAccept}
                        disabled={processing}
                        className="px-5"
                      >
                        {processing ? (
                          <>
                            <CSpinner size="sm" className="me-2" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CIcon icon={cilCheckCircle} className="me-2" />
                            Accept Invitation
                          </>
                        )}
                      </CButton>
                      <CButton
                        color="danger"
                        variant="outline"
                        size="lg"
                        onClick={handleReject}
                        disabled={processing}
                        className="px-5"
                      >
                        {processing ? (
                          <>
                            <CSpinner size="sm" className="me-2" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <CIcon icon={cilXCircle} className="me-2" />
                            Reject
                          </>
                        )}
                      </CButton>
                    </>
                  )}

                  {(expired || alreadyAccepted || alreadyRejected) && (
                    <CButtonGroup>
                      <CButton
                        color="primary"
                        variant="outline"
                        onClick={() => navigate('/invitations')}
                      >
                        View My Invitations
                      </CButton>
                      <CButton
                        color="primary"
                        onClick={() => navigate('/organizations')}
                      >
                        Go to Organizations
                      </CButton>
                    </CButtonGroup>
                  )}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default AcceptInvitation
