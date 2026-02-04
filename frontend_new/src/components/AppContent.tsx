import React, { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react-pro'

import AppBreadcrumb from './AppBreadcrumb'

// routes config
import routes from '../routes'

const AppContent = () => {
  const location = useLocation()

  // Routes that require full-width layout (no max-width constraint)
  const fullWidthRoutes = ['/excel-demo', '/expense-tracker']
  const isFullWidth = fullWidthRoutes.some(route => location.pathname.includes(route))

  return (
    <CContainer
      fluid={isFullWidth}
      lg={!isFullWidth}
      className="px-4"
    >
      <AppBreadcrumb />
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            return (
              route.element && <Route key={idx} path={route.path} element={<route.element />} />
            )
          })}
          <Route path="/" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default AppContent
