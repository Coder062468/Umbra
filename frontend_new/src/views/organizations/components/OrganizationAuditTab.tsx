/**
 * Organization Audit Tab
 * Display audit log of all actions performed in the organization
 */

import React, { useState, useEffect } from 'react'
import {
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
  CPaginationItem
} from '@coreui/react-pro'
import { organizationsAPI, AuditLog } from '../../../services/api'

interface OrganizationAuditTabProps {
  organizationId: string
}

const OrganizationAuditTab: React.FC<OrganizationAuditTabProps> = ({
  organizationId
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)

  const loadAuditLogs = async (pageNum: number) => {
    try {
      setLoading(true)
      setError(null)
      const response = await organizationsAPI.getAuditLogs(
        organizationId,
        pageNum,
        pageSize
      )
      setLogs(response.data.logs)
      setTotal(response.data.total)
      setPage(response.data.page)
    } catch (err: any) {
      console.error('Failed to load audit logs:', err)
      setError(err.response?.data?.detail || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLogs(1)
  }, [organizationId])

  const getActionBadgeColor = (action: string): string => {
    if (action.includes('created')) return 'success'
    if (action.includes('deleted') || action.includes('removed')) return 'danger'
    if (action.includes('updated') || action.includes('changed')) return 'warning'
    if (action.includes('transferred')) return 'info'
    return 'secondary'
  }

  const formatAction = (action: string): string => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && logs.length === 0) {
    return (
      <div className="text-center py-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}

      <div className="mb-3">
        <h5 className="mb-1">Audit Log</h5>
        <p className="text-medium-emphasis small mb-0">
          Complete history of actions performed in this organization ({total} total events)
        </p>
      </div>

      {logs.length === 0 ? (
        <CAlert color="info">
          No audit log entries yet. Actions will be recorded as members interact with the organization.
        </CAlert>
      ) : (
        <>
          <CTable align="middle" className="mb-0" hover responsive small>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Timestamp</CTableHeaderCell>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Action</CTableHeaderCell>
                <CTableHeaderCell>Resource</CTableHeaderCell>
                <CTableHeaderCell>Details</CTableHeaderCell>
                <CTableHeaderCell>IP Address</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {logs.map((log) => (
                <CTableRow key={log.id}>
                  <CTableDataCell>
                    <small>
                      {new Date(log.created_at).toLocaleString()}
                    </small>
                  </CTableDataCell>
                  <CTableDataCell>
                    <small className="text-medium-emphasis">
                      {log.user_email || 'System'}
                    </small>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getActionBadgeColor(log.action)} size="sm">
                      {formatAction(log.action)}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <small className="text-medium-emphasis">
                      {log.resource_type || '-'}
                    </small>
                  </CTableDataCell>
                  <CTableDataCell>
                    <small className="text-medium-emphasis">
                      {Object.keys(log.details).length > 0 ? (
                        <details>
                          <summary style={{ cursor: 'pointer' }}>
                            View details
                          </summary>
                          <pre className="mb-0 mt-1" style={{ fontSize: '0.75rem' }}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '-'
                      )}
                    </small>
                  </CTableDataCell>
                  <CTableDataCell>
                    <small className="text-medium-emphasis">
                      {log.ip_address || '-'}
                    </small>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>

          {totalPages > 1 && (
            <CPagination className="mt-3" align="center">
              <CPaginationItem
                disabled={page === 1 || loading}
                onClick={() => loadAuditLogs(page - 1)}
              >
                Previous
              </CPaginationItem>

              {[...Array(Math.min(totalPages, 5))].map((_, idx) => {
                const pageNum = page <= 3 ? idx + 1 : page - 2 + idx
                if (pageNum > totalPages) return null
                return (
                  <CPaginationItem
                    key={pageNum}
                    active={pageNum === page}
                    onClick={() => loadAuditLogs(pageNum)}
                    disabled={loading}
                  >
                    {pageNum}
                  </CPaginationItem>
                )
              })}

              <CPaginationItem
                disabled={page === totalPages || loading}
                onClick={() => loadAuditLogs(page + 1)}
              >
                Next
              </CPaginationItem>
            </CPagination>
          )}

          <div className="text-center text-medium-emphasis small mt-2">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
          </div>
        </>
      )}
    </div>
  )
}

export default OrganizationAuditTab
