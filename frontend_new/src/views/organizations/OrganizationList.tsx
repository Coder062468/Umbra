/**
 * Organization List View
 * Displays all organizations the user is a member of
 * Allows creating new organizations and managing existing ones
 */

import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CSpinner,
  CAlert
} from '@coreui/react-pro'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPeople, cilBuilding, cilSettings } from '@coreui/icons'
import { organizationsAPI, OrganizationListItem, RoleEnum } from '../../services/api'
import CreateOrganizationModal from './components/CreateOrganizationModal'
import { useNavigate } from 'react-router-dom'

const OrganizationList: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await organizationsAPI.getAll()
      setOrganizations(response.data)
    } catch (err: any) {
      console.error('Failed to load organizations:', err)
      setError(err.response?.data?.detail || 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  const getRoleBadgeColor = (role: RoleEnum): string => {
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

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    loadOrganizations()
  }

  const handleViewOrganization = (orgId: string) => {
    navigate(`/organizations/${orgId}`)
  }

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <CIcon icon={cilBuilding} className="me-2" />
            <strong>Organizations</strong>
          </div>
          <CButton
            color="primary"
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
          >
            <CIcon icon={cilPlus} className="me-1" />
            Create Organization
          </CButton>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <div className="mt-2 text-medium-emphasis">Loading organizations...</div>
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-5">
              <CIcon icon={cilBuilding} size="3xl" className="text-medium-emphasis mb-3" />
              <h5 className="text-medium-emphasis">No Organizations Yet</h5>
              <p className="text-medium-emphasis">
                Create an organization to share expense accounts with your family or team.
              </p>
              <CButton
                color="primary"
                onClick={() => setShowCreateModal(true)}
                className="mt-3"
              >
                <CIcon icon={cilPlus} className="me-1" />
                Create Your First Organization
              </CButton>
            </div>
          ) : (
            <CTable align="middle" className="mb-0" hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>Your Role</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">
                    <CIcon icon={cilPeople} className="me-1" />
                    Members
                  </CTableHeaderCell>
                  <CTableHeaderCell className="text-center">
                    Accounts
                  </CTableHeaderCell>
                  <CTableHeaderCell>Created</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {organizations.map((org) => (
                  <CTableRow
                    key={org.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleViewOrganization(org.id)}
                  >
                    <CTableDataCell>
                      <div className="fw-semibold">{org.name}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getRoleBadgeColor(org.role)}>
                        {org.role.toUpperCase()}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CBadge color="info" shape="rounded-pill">
                        {org.member_count}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CBadge color="success" shape="rounded-pill">
                        {org.account_count}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <small className="text-medium-emphasis">
                        {new Date(org.created_at).toLocaleDateString()}
                      </small>
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CButton
                        color="primary"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewOrganization(org.id)
                        }}
                      >
                        <CIcon icon={cilSettings} className="me-1" />
                        Manage
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {showCreateModal && (
        <CreateOrganizationModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </>
  )
}

export default OrganizationList
