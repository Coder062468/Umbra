/**
 * Organization Management Page
 * Monitor and manage all organizations
 *
 * Features:
 * - View all organizations with statistics
 * - Monitor storage usage and activity
 * - Pagination support
 * - Respects E2EE (no access to encrypted organization data)
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
  CSpinner,
  CAlert,
  CPagination,
  CPaginationItem,
  CProgress
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilBuilding } from '@coreui/icons'
import { adminAPI, OrganizationStats } from '../../services/api'

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadOrganizations()
  }, [page])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getOrganizations(page, 50)
      setOrganizations(response.data)
    } catch (err: any) {
      console.error('Failed to load organizations:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load organizations')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const getStorageColor = (sizeMb: number) => {
    if (sizeMb < 50) return 'success'
    if (sizeMb < 100) return 'warning'
    return 'danger'
  }

  if (loading && organizations.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading organizations...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2>Organization Management</h2>
        <p className="text-medium-emphasis">
          Monitor all organizations and their resource usage. Cannot access encrypted data (E2EE).
        </p>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Error:</strong> {error}
        </CAlert>
      )}

      <CCard>
        <CCardHeader>
          <strong>All Organizations</strong>
          <span className="text-medium-emphasis ms-2">
            (Showing {organizations.length} organizations)
          </span>
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
                  <CTableHeaderCell>Organization</CTableHeaderCell>
                  <CTableHeaderCell>Members</CTableHeaderCell>
                  <CTableHeaderCell>Accounts</CTableHeaderCell>
                  <CTableHeaderCell>Transactions</CTableHeaderCell>
                  <CTableHeaderCell>Storage Used</CTableHeaderCell>
                  <CTableHeaderCell>Last Activity</CTableHeaderCell>
                  <CTableHeaderCell>Created</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {organizations.map((org) => (
                  <CTableRow key={org.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center">
                        <CIcon icon={cilBuilding} className="me-2 text-primary" />
                        <div>
                          <div className="fw-semibold">{org.name}</div>
                          <div className="small text-medium-emphasis">
                            ID: {org.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="info">{org.member_count}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="secondary">{org.account_count}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {org.transaction_count.toLocaleString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div style={{ minWidth: '120px' }}>
                        <div className="d-flex justify-content-between mb-1">
                          <small>{org.storage_used_mb.toFixed(2)} MB</small>
                        </div>
                        <CProgress
                          thin
                          color={getStorageColor(org.storage_used_mb)}
                          value={Math.min((org.storage_used_mb / 100) * 100, 100)}
                        />
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="small">
                        {formatDate(org.last_activity)}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="small">
                        {new Date(org.created_at).toLocaleDateString()}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}

          {organizations.length === 0 && !loading && (
            <CAlert color="info">No organizations found.</CAlert>
          )}

          {organizations.length > 0 && (
            <CPagination className="mt-3" align="center">
              <CPaginationItem
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </CPaginationItem>
              <CPaginationItem active>{page}</CPaginationItem>
              <CPaginationItem
                disabled={organizations.length < 50}
                onClick={() => setPage(page + 1)}
              >
                Next
              </CPaginationItem>
            </CPagination>
          )}
        </CCardBody>
      </CCard>

      {/* Summary Statistics */}
      {organizations.length > 0 && (
        <CCard className="mt-4">
          <CCardHeader>
            <strong>Summary Statistics</strong>
          </CCardHeader>
          <CCardBody>
            <CTableRow className="border-0">
              <div className="d-flex justify-content-around text-center">
                <div>
                  <div className="fs-4 fw-semibold">
                    {organizations.reduce((sum, org) => sum + org.member_count, 0)}
                  </div>
                  <div className="text-medium-emphasis small">Total Members</div>
                </div>
                <div>
                  <div className="fs-4 fw-semibold">
                    {organizations.reduce((sum, org) => sum + org.account_count, 0)}
                  </div>
                  <div className="text-medium-emphasis small">Total Accounts</div>
                </div>
                <div>
                  <div className="fs-4 fw-semibold">
                    {organizations.reduce((sum, org) => sum + org.transaction_count, 0).toLocaleString()}
                  </div>
                  <div className="text-medium-emphasis small">Total Transactions</div>
                </div>
                <div>
                  <div className="fs-4 fw-semibold">
                    {organizations.reduce((sum, org) => sum + org.storage_used_mb, 0).toFixed(2)} MB
                  </div>
                  <div className="text-medium-emphasis small">Total Storage</div>
                </div>
              </div>
            </CTableRow>
          </CCardBody>
        </CCard>
      )}

      <CAlert color="warning" className="mt-4">
        <strong>Security Notice:</strong> System administrators cannot decrypt organization data.
        All financial information remains end-to-end encrypted.
      </CAlert>
    </div>
  )
}

export default OrganizationManagement
