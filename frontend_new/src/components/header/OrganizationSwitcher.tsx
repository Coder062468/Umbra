/**
 * Organization Switcher Component
 * Dropdown in navbar for quick organization switching
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CBadge,
  CSpinner,
  CAlert
} from '@coreui/react-pro'
import { cilLayers, cilCheckCircle, cilPlus, cilList } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useOrganization } from '../../contexts/OrganizationContext'

const OrganizationSwitcher: React.FC = () => {
  const {
    currentOrganization,
    organizations,
    isLoading,
    error,
    switchOrganization
  } = useOrganization()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) return

    try {
      setSwitching(orgId)
      await switchOrganization(orgId)
    } catch (err) {
      console.error('Failed to switch organization:', err)
    } finally {
      setSwitching(null)
    }
  }

  if (isLoading) {
    return (
      <div className="d-flex align-items-center px-3">
        <CSpinner size="sm" color="primary" />
      </div>
    )
  }

  if (organizations.length === 0) {
    return null
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle className="py-0 px-3" caret>
        <CIcon icon={cilLayers} className="me-2" />
        <span className="d-none d-md-inline">
          {currentOrganization?.name || 'Select Organization'}
        </span>
      </CDropdownToggle>
      <CDropdownMenu style={{ minWidth: '280px' }}>
        <CDropdownHeader className="bg-body-secondary text-body-secondary fw-semibold rounded-top">
          Organizations
        </CDropdownHeader>

        {error && (
          <div className="px-3 py-2">
            <CAlert color="danger" className="mb-0 small">
              {error}
            </CAlert>
          </div>
        )}

        {organizations.length > 0 ? (
          organizations.map((org) => {
            const isActive = currentOrganization?.id === org.id
            const isSwitching = switching === org.id

            return (
              <CDropdownItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                disabled={isActive || isSwitching}
                style={{
                  cursor: isActive ? 'default' : 'pointer',
                  backgroundColor: isActive ? 'rgba(0, 123, 255, 0.1)' : undefined
                }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center flex-grow-1">
                    <CIcon
                      icon={cilLayers}
                      className="me-2"
                      style={{
                        color: isActive ? 'var(--cui-primary)' : 'var(--cui-secondary)'
                      }}
                    />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{org.name}</div>
                      {org.description && (
                        <div className="small text-medium-emphasis">
                          {org.description.substring(0, 50)}
                          {org.description.length > 50 ? '...' : ''}
                        </div>
                      )}
                      <div className="small text-medium-emphasis">
                        <CBadge
                          color={
                            org.role === 'owner'
                              ? 'danger'
                              : org.role === 'admin'
                              ? 'warning'
                              : org.role === 'member'
                              ? 'info'
                              : 'secondary'
                          }
                          size="sm"
                        >
                          {org.role}
                        </CBadge>
                      </div>
                    </div>
                  </div>
                  {isSwitching && <CSpinner size="sm" className="ms-2" />}
                  {isActive && !isSwitching && (
                    <CIcon
                      icon={cilCheckCircle}
                      className="ms-2"
                      style={{ color: 'var(--cui-success)' }}
                    />
                  )}
                </div>
              </CDropdownItem>
            )
          })
        ) : (
          <CDropdownItem disabled>
            <div className="text-center text-medium-emphasis small">
              No organizations found
            </div>
          </CDropdownItem>
        )}

        <CDropdownDivider />

        <CDropdownItem onClick={() => navigate('/organizations')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilList} className="me-2" />
          Manage Organizations
        </CDropdownItem>

        <CDropdownItem onClick={() => navigate('/invitations')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilPlus} className="me-2" />
          View Invitations
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default OrganizationSwitcher
