/**
 * System Logs Viewer
 * View and filter system logs
 *
 * Features:
 * - Real-time log viewing
 * - Filter by level and category
 * - Pagination
 * - Log cleanup functionality
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
  CForm,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CButtonGroup
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilFilterX, cilReload, cilTrash } from '@coreui/icons'
import { adminAPI, SystemLogEntry } from '../../services/api'

const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  useEffect(() => {
    loadLogs()
  }, [page, levelFilter, categoryFilter])

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getLogs(
        levelFilter || undefined,
        categoryFilter || undefined,
        page,
        100
      )
      setLogs(response.data.logs)
      setTotal(response.data.total)
    } catch (err: any) {
      console.error('Failed to load logs:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load logs')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    const daysOld = prompt(
      'Delete logs older than how many days?\n\n' +
      'Enter a number between 1 and 365:',
      '90'
    )

    if (!daysOld) return

    const days = parseInt(daysOld, 10)
    if (isNaN(days) || days < 1 || days > 365) {
      alert('Please enter a valid number between 1 and 365')
      return
    }

    const confirmed = window.confirm(
      `This will permanently delete all system logs older than ${days} days.\n\n` +
      `This action cannot be undone. Continue?`
    )

    if (!confirmed) return

    try {
      const response = await adminAPI.cleanupLogs(days)
      alert(`Successfully deleted ${response.data.deleted_count} log entries`)
      loadLogs()
    } catch (err: any) {
      console.error('Failed to cleanup logs:', err)
      alert(err.response?.data?.detail || 'Failed to cleanup logs')
    }
  }

  const clearFilters = () => {
    setLevelFilter('')
    setCategoryFilter('')
    setPage(1)
  }

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
        return 'danger'
      case 'ERROR':
        return 'danger'
      case 'WARNING':
        return 'warning'
      case 'INFO':
        return 'info'
      default:
        return 'secondary'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'auth':
        return 'primary'
      case 'database':
        return 'success'
      case 'backup':
        return 'info'
      case 'admin':
        return 'warning'
      case 'system':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading && logs.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading system logs...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2>System Logs</h2>
        <p className="text-medium-emphasis">
          View system events, errors, and administrative actions
        </p>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Error:</strong> {error}
        </CAlert>
      )}

      {/* Filters and Actions */}
      <CCard className="mb-3">
        <CCardBody>
          <CForm>
            <div className="d-flex flex-wrap gap-2 align-items-end">
              <div style={{ minWidth: '200px' }}>
                <label className="form-label small">Level</label>
                <CFormSelect
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All Levels</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </CFormSelect>
              </div>
              <div style={{ minWidth: '200px' }}>
                <label className="form-label small">Category</label>
                <CFormSelect
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">All Categories</option>
                  <option value="auth">Auth</option>
                  <option value="database">Database</option>
                  <option value="backup">Backup</option>
                  <option value="admin">Admin</option>
                  <option value="system">System</option>
                </CFormSelect>
              </div>
              <CButtonGroup>
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!levelFilter && !categoryFilter}
                >
                  <CIcon icon={cilFilterX} className="me-1" />
                  Clear Filters
                </CButton>
                <CButton
                  color="primary"
                  variant="outline"
                  onClick={() => loadLogs()}
                  disabled={loading}
                >
                  <CIcon icon={cilReload} className="me-1" />
                  Refresh
                </CButton>
                <CButton
                  color="danger"
                  variant="outline"
                  onClick={handleCleanup}
                >
                  <CIcon icon={cilTrash} className="me-1" />
                  Cleanup Old Logs
                </CButton>
              </CButtonGroup>
            </div>
          </CForm>
        </CCardBody>
      </CCard>

      {/* Logs Table */}
      <CCard>
        <CCardHeader>
          <strong>System Logs</strong>
          <span className="text-medium-emphasis ms-2">
            (Showing {logs.length} of {total} logs)
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
                  <CTableHeaderCell style={{ width: '160px' }}>Timestamp</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '100px' }}>Level</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '100px' }}>Category</CTableHeaderCell>
                  <CTableHeaderCell>Message</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {logs.map((log) => (
                  <CTableRow key={log.id}>
                    <CTableDataCell>
                      <div className="small">{formatDate(log.created_at)}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getLevelColor(log.level)}>{log.level}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getCategoryColor(log.category)}>{log.category}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>{log.message}</div>
                      {Object.keys(log.details).length > 0 && (
                        <details className="mt-1">
                          <summary className="small text-medium-emphasis" style={{ cursor: 'pointer' }}>
                            View Details
                          </summary>
                          <pre className="small bg-light p-2 mt-1" style={{ fontSize: '11px' }}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}

          {logs.length === 0 && !loading && (
            <CAlert color="info">No logs found matching the selected filters.</CAlert>
          )}

          {total > 100 && (
            <CPagination className="mt-3" align="center">
              <CPaginationItem
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </CPaginationItem>
              <CPaginationItem active>{page}</CPaginationItem>
              <CPaginationItem>...</CPaginationItem>
              <CPaginationItem>{Math.ceil(total / 100)}</CPaginationItem>
              <CPaginationItem
                disabled={page >= Math.ceil(total / 100)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </CPaginationItem>
            </CPagination>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default SystemLogs
