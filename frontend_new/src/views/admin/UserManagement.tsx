/**
 * User Management Page
 * List and manage all system users
 *
 * Features:
 * - View all users with statistics
 * - Toggle system admin privileges
 * - Delete individual users (with double confirmation)
 * - Bulk delete multiple users (with select all/checkbox)
 * - Search and pagination
 * - Respects E2EE (no access to encrypted user data)
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
  CBadge,
  CButton,
  CSpinner,
  CAlert,
  CPagination,
  CPaginationItem,
  CFormCheck
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilShieldAlt, cilUser, cilTrash } from '@coreui/icons'
import { adminAPI, UserStats } from '../../services/api'

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [page])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getUsers(page, 50)
      setUsers(response.data)
    } catch (err: any) {
      console.error('Failed to load users:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load users')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'revoke' : 'grant'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} system administrator privileges for this user?\n\n` +
      `This will ${currentStatus ? 'remove' : 'give'} them access to the admin panel.`
    )

    if (!confirmed) return

    try {
      setToggling(userId)
      await adminAPI.toggleSystemAdmin(userId)
      await loadUsers()
    } catch (err: any) {
      console.error('Failed to toggle admin status:', err)
      alert(err.response?.data?.detail || 'Failed to update user privileges')
    } finally {
      setToggling(null)
    }
  }

  const handleDeleteUser = async (user: UserStats) => {
    const confirmed = window.confirm(
      `⚠️ DANGER: Permanently delete user "${user.email}"?\n\n` +
      `This will irreversibly delete:\n` +
      `• ${user.account_count} account(s)\n` +
      `• ${user.transaction_count} transaction(s)\n` +
      `• ${user.organization_count} organization membership(s)\n` +
      `• All encrypted user data\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type the user's email to confirm:`
    )

    if (!confirmed) return

    // Additional confirmation - ask user to type email
    const emailConfirm = window.prompt(
      `To confirm deletion, type the user's email exactly:\n\n${user.email}`
    )

    if (emailConfirm !== user.email) {
      alert('Email does not match. Deletion cancelled.')
      return
    }

    try {
      setDeleting(user.id)
      await adminAPI.deleteUser(user.id)
      alert(`User "${user.email}" has been permanently deleted.`)
      await loadUsers()
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      if (err.response?.status === 403) {
        alert(err.response?.data?.detail || 'Cannot delete your own account')
      } else {
        alert(err.response?.data?.detail || 'Failed to delete user')
      }
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) {
      alert('Please select at least one user to delete')
      return
    }

    const selectedUsersData = users.filter(u => selectedUsers.has(u.id))
    const totalAccounts = selectedUsersData.reduce((sum, u) => sum + u.account_count, 0)
    const totalTransactions = selectedUsersData.reduce((sum, u) => sum + u.transaction_count, 0)
    const totalOrgs = selectedUsersData.reduce((sum, u) => sum + u.organization_count, 0)

    const confirmed = window.confirm(
      `⚠️ DANGER: Permanently delete ${selectedUsers.size} user(s)?\n\n` +
      `Users to delete:\n${selectedUsersData.map(u => `• ${u.email}`).join('\n')}\n\n` +
      `This will irreversibly delete:\n` +
      `• ${totalAccounts} account(s)\n` +
      `• ${totalTransactions} transaction(s)\n` +
      `• ${totalOrgs} organization membership(s)\n` +
      `• All encrypted user data\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE" to confirm:`
    )

    if (!confirmed) return

    const deleteConfirm = window.prompt(
      `To confirm bulk deletion of ${selectedUsers.size} user(s), type "DELETE" in uppercase:`
    )

    if (deleteConfirm !== 'DELETE') {
      alert('Confirmation text does not match. Deletion cancelled.')
      return
    }

    try {
      setBulkDeleting(true)
      let successCount = 0
      let failedUsers: string[] = []

      for (const userId of selectedUsers) {
        try {
          await adminAPI.deleteUser(userId)
          successCount++
        } catch (err: any) {
          const user = users.find(u => u.id === userId)
          failedUsers.push(user?.email || userId)
          console.error(`Failed to delete user ${userId}:`, err)
        }
      }

      if (failedUsers.length > 0) {
        alert(
          `Bulk deletion completed with errors:\n\n` +
          `✓ Successfully deleted: ${successCount} user(s)\n` +
          `✗ Failed to delete: ${failedUsers.length} user(s)\n\n` +
          `Failed users:\n${failedUsers.map(e => `• ${e}`).join('\n')}`
        )
      } else {
        alert(`Successfully deleted ${successCount} user(s).`)
      }

      setSelectedUsers(new Set())
      await loadUsers()
    } catch (err: any) {
      console.error('Bulk delete failed:', err)
      alert('Bulk deletion failed. Please try again.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  if (loading && users.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading users...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2>User Management</h2>
        <p className="text-medium-emphasis">
          View and manage system users. Cannot access encrypted user data (E2EE).
        </p>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Error:</strong> {error}
        </CAlert>
      )}

      <CCard>
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>All Users</strong>
              <span className="text-medium-emphasis ms-2">
                (Showing {users.length} users)
              </span>
              {selectedUsers.size > 0 && (
                <CBadge color="primary" className="ms-2">
                  {selectedUsers.size} selected
                </CBadge>
              )}
            </div>
            {selectedUsers.size > 0 && (
              <CButton
                color="danger"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <CIcon icon={cilTrash} className="me-2" />
                    Delete {selectedUsers.size} User{selectedUsers.size > 1 ? 's' : ''}
                  </>
                )}
              </CButton>
            )}
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : (
            <CTable align="middle" className="mb-0" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '40px' }}>
                    <CFormCheck
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      title="Select All"
                    />
                  </CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell>Role</CTableHeaderCell>
                  <CTableHeaderCell>Organizations</CTableHeaderCell>
                  <CTableHeaderCell>Accounts</CTableHeaderCell>
                  <CTableHeaderCell>Transactions</CTableHeaderCell>
                  <CTableHeaderCell>Last Login</CTableHeaderCell>
                  <CTableHeaderCell>Login Count</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.map((user) => (
                  <CTableRow key={user.id}>
                    <CTableDataCell>
                      <CFormCheck
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleToggleSelectUser(user.id)}
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex align-items-center">
                        <CIcon
                          icon={user.is_system_admin ? cilShieldAlt : cilUser}
                          className={`me-2 ${user.is_system_admin ? 'text-danger' : 'text-secondary'}`}
                        />
                        <div>
                          <div className="fw-semibold">{user.email}</div>
                          <div className="small text-medium-emphasis">
                            Joined {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {user.is_system_admin ? (
                        <CBadge color="danger">System Admin</CBadge>
                      ) : (
                        <CBadge color="secondary">User</CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>{user.organization_count}</CTableDataCell>
                    <CTableDataCell>{user.account_count}</CTableDataCell>
                    <CTableDataCell>{user.transaction_count.toLocaleString()}</CTableDataCell>
                    <CTableDataCell>
                      <div className="small">
                        {formatDate(user.last_login_at)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>{user.login_count}</CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-2">
                        <CButton
                          color={user.is_system_admin ? 'warning' : 'primary'}
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleAdmin(user.id, user.is_system_admin)}
                          disabled={toggling === user.id || deleting === user.id}
                        >
                          {toggling === user.id ? (
                            <CSpinner size="sm" />
                          ) : (
                            <>
                              <CIcon icon={cilShieldAlt} className="me-1" />
                              {user.is_system_admin ? 'Revoke Admin' : 'Make Admin'}
                            </>
                          )}
                        </CButton>
                        <CButton
                          color="danger"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          disabled={toggling === user.id || deleting === user.id}
                        >
                          {deleting === user.id ? (
                            <CSpinner size="sm" />
                          ) : (
                            <>
                              <CIcon icon={cilTrash} className="me-1" />
                              Delete
                            </>
                          )}
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}

          {users.length === 0 && !loading && (
            <CAlert color="info">No users found.</CAlert>
          )}

          {users.length > 0 && (
            <CPagination className="mt-3" align="center">
              <CPaginationItem
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </CPaginationItem>
              <CPaginationItem active>{page}</CPaginationItem>
              <CPaginationItem
                disabled={users.length < 50}
                onClick={() => setPage(page + 1)}
              >
                Next
              </CPaginationItem>
            </CPagination>
          )}
        </CCardBody>
      </CCard>

      <CAlert color="warning" className="mt-4">
        <strong>Security Notice:</strong> System administrators cannot decrypt user data.
        This panel only shows aggregate statistics and metadata.
      </CAlert>
    </div>
  )
}

export default UserManagement
