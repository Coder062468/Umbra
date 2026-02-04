/**
 * Organization Members Tab
 * Manage organization members, roles, invitations, and ownership transfer
 */

import React, { useState, useEffect } from 'react'
import {
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CAlert,
  CSpinner
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilUserPlus, cilOptions, cilTrash, cilSwapHorizontal } from '@coreui/icons'
import { organizationsAPI, OrganizationMember, RoleEnum } from '../../../services/api'
import InviteMemberModal from './InviteMemberModal'
import TransferOwnershipModal from './TransferOwnershipModal'

interface OrganizationMembersTabProps {
  organizationId: string
  organizationRole: RoleEnum
  onUpdate: () => void
}

const OrganizationMembersTab: React.FC<OrganizationMembersTabProps> = ({
  organizationId,
  organizationRole,
  onUpdate
}) => {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)

  const canInvite = organizationRole === 'owner' || organizationRole === 'admin'
  const canManage = organizationRole === 'owner' || organizationRole === 'admin'
  const isOwner = organizationRole === 'owner'

  const loadMembers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await organizationsAPI.getMembers(organizationId)
      setMembers(response.data)
    } catch (err: any) {
      console.error('Failed to load members:', err)
      setError(err.response?.data?.detail || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [organizationId])

  const handleRoleChange = async (userId: string, newRole: RoleEnum) => {
    try {
      await organizationsAPI.updateMember(organizationId, userId, { role: newRole })
      await loadMembers()
      onUpdate()
    } catch (err: any) {
      console.error('Failed to update member role:', err)
      setError(err.response?.data?.detail || 'Failed to update member role')
    }
  }

  const handleRemoveMember = async (userId: string, email: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${email} from this organization?\n\n` +
      `They will lose access to all organization accounts.`
    )

    if (!confirmed) return

    try {
      await organizationsAPI.removeMember(organizationId, userId)
      await loadMembers()
      onUpdate()
    } catch (err: any) {
      console.error('Failed to remove member:', err)
      setError(err.response?.data?.detail || 'Failed to remove member')
    }
  }

  const getRoleBadgeColor = (role: RoleEnum): string => {
    switch (role) {
      case 'owner': return 'danger'
      case 'admin': return 'warning'
      case 'member': return 'info'
      case 'viewer': return 'secondary'
      default: return 'secondary'
    }
  }

  const canChangeRole = (memberRole: RoleEnum): boolean => {
    if (!canManage) return false
    if (memberRole === 'owner') return false // Cannot change owner via role update
    if (organizationRole === 'admin' && memberRole === 'admin') return false
    return true
  }

  const canRemove = (memberRole: RoleEnum): boolean => {
    if (!canManage) return false
    if (memberRole === 'owner') return false
    if (organizationRole === 'admin' && (memberRole === 'admin' || memberRole === 'owner')) return false
    return true
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Members ({members.length})</h5>
          <p className="text-medium-emphasis small mb-0">
            Manage organization members and their access levels
          </p>
        </div>
        <div className="d-flex gap-2">
          {isOwner && (
            <CButton
              color="warning"
              variant="outline"
              size="sm"
              onClick={() => setShowTransferModal(true)}
            >
              <CIcon icon={cilSwapHorizontal} className="me-1" />
              Transfer Ownership
            </CButton>
          )}
          {canInvite && (
            <CButton
              color="primary"
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              <CIcon icon={cilUserPlus} className="me-1" />
              Invite Member
            </CButton>
          )}
        </div>
      </div>

      <CTable align="middle" className="mb-0" hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Email</CTableHeaderCell>
            <CTableHeaderCell>Role</CTableHeaderCell>
            <CTableHeaderCell>Joined</CTableHeaderCell>
            {canManage && <CTableHeaderCell className="text-center">Actions</CTableHeaderCell>}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {members.map((member) => (
            <CTableRow key={member.id}>
              <CTableDataCell>
                <div className="fw-semibold">{member.email}</div>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={getRoleBadgeColor(member.role)}>
                  {member.role.toUpperCase()}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <small className="text-medium-emphasis">
                  {new Date(member.joined_at).toLocaleDateString()}
                </small>
              </CTableDataCell>
              {canManage && (
                <CTableDataCell className="text-center">
                  {(canChangeRole(member.role) || canRemove(member.role)) && (
                    <CDropdown>
                      <CDropdownToggle color="light" size="sm">
                        <CIcon icon={cilOptions} />
                      </CDropdownToggle>
                      <CDropdownMenu>
                        {canChangeRole(member.role) && (
                          <>
                            <CDropdownItem header>Change Role</CDropdownItem>
                            {(['admin', 'member', 'viewer'] as RoleEnum[])
                              .filter(role => role !== member.role)
                              .map(role => (
                                <CDropdownItem
                                  key={role}
                                  onClick={() => handleRoleChange(member.user_id, role)}
                                >
                                  Make {role.charAt(0).toUpperCase() + role.slice(1)}
                                </CDropdownItem>
                              ))
                            }
                            <CDropdownItem divider />
                          </>
                        )}
                        {canRemove(member.role) && (
                          <CDropdownItem
                            onClick={() => handleRemoveMember(member.user_id, member.email)}
                            className="text-danger"
                          >
                            <CIcon icon={cilTrash} className="me-1" />
                            Remove from Organization
                          </CDropdownItem>
                        )}
                      </CDropdownMenu>
                    </CDropdown>
                  )}
                </CTableDataCell>
              )}
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>

      {showInviteModal && (
        <InviteMemberModal
          visible={showInviteModal}
          organizationId={organizationId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false)
            loadMembers()
          }}
        />
      )}

      {showTransferModal && (
        <TransferOwnershipModal
          visible={showTransferModal}
          organizationId={organizationId}
          members={members.filter(m => m.role !== 'owner')}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false)
            loadMembers()
            onUpdate()
          }}
        />
      )}
    </>
  )
}

export default OrganizationMembersTab
