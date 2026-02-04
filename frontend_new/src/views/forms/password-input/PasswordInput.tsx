import React from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CForm, CPasswordInput, CRow } from '@coreui/react-pro'
import { DocsComponents, DocsExample } from 'src/components'

const PasswordInput = () => {
  return (
    <CRow>
      <CCol xs={12}>
        <DocsComponents href="forms/password-input/" />
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Password Input</strong>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              The <code>&lt;CPasswordInput /&gt;</code> is a fully featured{' '}
              <strong>React password input field</strong> built with Bootstrap and CoreUI. It
              includes built-in <strong>password visibility toggling</strong>, <code>sm</code> /{' '}
              <code>lg</code> <strong>sizing options</strong>, and support for <code>disabled</code>
              , <code>readOnly</code>, and form validation states. Ideal for login forms, signup
              screens, and any secure input in your React app.
            </p>
            <DocsExample href="forms/password-input/#example">
              <CForm>
                <div className="mb-3">
                  <CPasswordInput
                    label="Password"
                    placeholder="Enter your password"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <CPasswordInput
                    label="Password with value"
                    placeholder="Enter your password"
                    value="Top secret"
                    autoComplete="new-password"
                  />
                </div>
              </CForm>
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Password Input</strong> <small>Sizing</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Use the <code>size</code> prop to control the height and padding of the input.
              Available options:
            </p>
            <DocsExample href="forms/password-input/#sizing">
              <CForm className="d-flex flex-column gap-3">
                <CPasswordInput
                  size="lg"
                  placeholder="Large password input"
                  aria-label="lg input example"
                  autoComplete="new-password"
                />
                <CPasswordInput
                  placeholder="Default password input"
                  aria-label="default input example"
                  autoComplete="new-password"
                />
                <CPasswordInput
                  size="sm"
                  placeholder="Small password input"
                  aria-label="sm input example"
                  autoComplete="new-password"
                />
              </CForm>
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default PasswordInput
