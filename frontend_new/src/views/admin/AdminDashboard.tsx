/**
 * System Administration Dashboard
 * Displays system-wide statistics and health indicators
 *
 * Access: System administrators only (is_system_admin=true)
 */

import React, { useState, useEffect } from 'react'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CAlert,
  CSpinner,
  CWidgetStatsA
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import {
  cilPeople,
  cilBuilding,
  cilWallet,
  cilChart,
  cilCheckCircle
} from '@coreui/icons'
import { adminAPI, SystemStats } from '../../services/api'

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getStats()
      setStats(response.data)
    } catch (err: any) {
      console.error('Failed to load system stats:', err)
      if (err.response?.status === 403) {
        setError('Access denied. System administrator privileges required.')
      } else {
        setError(err.response?.data?.detail || 'Failed to load statistics')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <div className="mt-2 text-medium-emphasis">Loading system statistics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <CAlert color="danger">
        <strong>Error:</strong> {error}
      </CAlert>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div>
      <div className="mb-4">
        <h2>System Administration</h2>
        <p className="text-medium-emphasis">
          Monitor system health, user activity, and platform statistics
        </p>
      </div>

      {/* Top Statistics Row */}
      <CRow className="mb-4">
        <CCol sm={6} lg={3}>
          <CWidgetStatsA
            className="mb-4"
            color="primary"
            value={stats.total_users.toString()}
            title="Total Users"
          >
            <CIcon icon={cilPeople} height={36} />
          </CWidgetStatsA>
        </CCol>
        <CCol sm={6} lg={3}>
          <CWidgetStatsA
            className="mb-4"
            color="info"
            value={stats.total_organizations.toString()}
            title="Organizations"
          >
            <CIcon icon={cilBuilding} height={36} />
          </CWidgetStatsA>
        </CCol>
        <CCol sm={6} lg={3}>
          <CWidgetStatsA
            className="mb-4"
            color="warning"
            value={stats.total_accounts.toString()}
            title="Accounts"
          >
            <CIcon icon={cilWallet} height={36} />
          </CWidgetStatsA>
        </CCol>
        <CCol sm={6} lg={3}>
          <CWidgetStatsA
            className="mb-4"
            color="success"
            value={stats.total_transactions.toLocaleString()}
            title="Transactions"
          >
            <CIcon icon={cilChart} height={36} />
          </CWidgetStatsA>
        </CCol>
      </CRow>

      {/* Activity Statistics */}
      <CRow className="mb-4">
        <CCol md={4}>
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small text-uppercase mb-2">
                Active Users Today
              </div>
              <div className="fs-2 fw-semibold">{stats.active_users_today}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small text-uppercase mb-2">
                Active Users (7 days)
              </div>
              <div className="fs-2 fw-semibold">{stats.active_users_week}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small text-uppercase mb-2">
                Active Users (30 days)
              </div>
              <div className="fs-2 fw-semibold">{stats.active_users_month}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* System Health & Metrics */}
      <CRow>
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>Database Metrics</strong>
            </CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <div className="text-medium-emphasis small">Database Size</div>
                <div className="fs-5 fw-semibold">{stats.database_size_mb.toFixed(2)} MB</div>
              </div>
              <div className="mb-3">
                <div className="text-medium-emphasis small">Avg Transactions per User</div>
                <div className="fs-5 fw-semibold">{stats.avg_transactions_per_user.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-medium-emphasis small">Avg Accounts per Organization</div>
                <div className="fs-5 fw-semibold">{stats.avg_accounts_per_org.toFixed(2)}</div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>System Status</strong>
            </CCardHeader>
            <CCardBody>
              <div className="d-flex align-items-center mb-3">
                <CIcon icon={cilCheckCircle} className="text-success me-2" size="lg" />
                <div>
                  <div className="fw-semibold">API Server</div>
                  <div className="text-medium-emphasis small">Running</div>
                </div>
              </div>
              <div className="d-flex align-items-center mb-3">
                <CIcon icon={cilCheckCircle} className="text-success me-2" size="lg" />
                <div>
                  <div className="fw-semibold">Database</div>
                  <div className="text-medium-emphasis small">Connected</div>
                </div>
              </div>
              <div className="d-flex align-items-center">
                <CIcon icon={cilCheckCircle} className="text-success me-2" size="lg" />
                <div>
                  <div className="fw-semibold">Encryption</div>
                  <div className="text-medium-emphasis small">Active (E2EE)</div>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Security Notice */}
      <CAlert color="info" className="mt-4">
        <strong>Zero-Knowledge Architecture:</strong> System administrators cannot decrypt user data.
        All financial information remains end-to-end encrypted and accessible only to authorized users.
      </CAlert>
    </div>
  )
}

export default AdminDashboard
