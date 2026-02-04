import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { CSpinner, useColorModes } from '@coreui/react-pro'

import './scss/style.scss'

// We use those styles to show code examples, you should remove them in your application.
import './scss/examples.scss'

import type { State } from './store'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { AccountsProvider } from './contexts/AccountsContext'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

// Protected Route Component
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="pt-3 text-center">
        <CSpinner color="primary" variant="grow" />
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="pt-3 text-center">
        <CSpinner color="primary" variant="grow" />
      </div>
    )
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />
}

const AppContent = () => {
  const { isColorModeSet, setColorMode } = useColorModes(
    'coreui-pro-react-admin-template-theme-modern',
  )
  const storedTheme = useSelector((state: State) => state.theme)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    let theme = urlParams.get('theme')

    if (theme !== null && theme.match(/^[A-Za-z0-9\s]+/)) {
      theme = theme.match(/^[A-Za-z0-9\s]+/)![0]
    }

    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Suspense
      fallback={
        <div className="pt-3 text-center">
          <CSpinner color="primary" variant="grow" />
        </div>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route path="/404" element={<Page404 />} />
        <Route path="/500" element={<Page500 />} />
        <Route
          path="*"
          element={
            <PrivateRoute>
              <DefaultLayout />
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <OrganizationProvider>
          <AccountsProvider>
            <AppContent />
          </AccountsProvider>
        </OrganizationProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
