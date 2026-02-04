import React, { useId, useRef, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CPasswordInput,
  CRow,
  CStepper,
} from '@coreui/react-pro'
import { DocsComponents, DocsExample } from 'src/components'

const StepperExample = () => {
  const stepperRef = useRef(null)
  const uid = useId()
  const [currentStep, setCurrentStep] = useState(1)
  const [finish, setFinish] = useState(false)

  const steps = [
    {
      label: 'Step 1',
      content: (
        <CForm className="row g-3" noValidate>
          <CCol md={4}>
            <CFormInput type="text" defaultValue="Łukasz" label="First name" />
          </CCol>
          <CCol md={4}>
            <CFormInput type="text" defaultValue="Holeczek" label="Last name" />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor={`validationCustomUsername-${uid}-01`}>Username</CFormLabel>
            <CInputGroup>
              <CInputGroupText id={`inputGroupPrependFeedback-${uid}`}>@</CInputGroupText>
              <CFormInput
                type="text"
                id={`validationCustomUsername-${uid}-01`}
                aria-describedby={`inputGroupPrependFeedback-${uid}`}
              />
            </CInputGroup>
          </CCol>
        </CForm>
      ),
    },
    {
      label: 'Step 2',
      content: (
        <CForm className="row g-3" noValidate>
          <CCol md={6}>
            <CFormInput type="text" label="City" />
          </CCol>
          <CCol md={3}>
            <CFormSelect label="State">
              <option disabled>Choose...</option>
              <option>...</option>
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormInput type="text" label="Zip" />
          </CCol>
        </CForm>
      ),
    },
    {
      label: 'Step 3',
      content: (
        <CForm className="row g-3 needs-validation">
          <CCol md={6}>
            <CFormInput type="email" label="Email" />
          </CCol>
          <CCol md={6}>
            <CPasswordInput label="Password" autoComplete="current-password" />
          </CCol>
          <CCol xs={12}>
            <CFormCheck type="checkbox" label="Agree to terms and conditions" />
          </CCol>
        </CForm>
      ),
    },
  ]
  return (
    <>
      <CStepper
        steps={steps}
        onFinish={() => setFinish(true)}
        onReset={() => setFinish(false)}
        onStepChange={setCurrentStep}
        ref={stepperRef}
      />
      {finish && <div>All steps are complete—you're finished.</div>}
      <div className="d-flex gap-2 mt-4">
        {!finish && currentStep > 1 && (
          <CButton color="secondary" onClick={() => stepperRef.current?.prev()}>
            Previous
          </CButton>
        )}
        {!finish && currentStep < steps.length && (
          <CButton color="primary" onClick={() => stepperRef.current?.next()}>
            Next
          </CButton>
        )}
        {!finish && currentStep === steps.length && (
          <CButton color="primary" onClick={() => stepperRef.current?.finish()}>
            Finish
          </CButton>
        )}
        {finish && (
          <CButton color="danger" onClick={() => stepperRef.current?.reset()}>
            Reset
          </CButton>
        )}
      </div>
    </>
  )
}

const StepperVerticalIndicatorLayoutExample = () => {
  const steps = [
    {
      label: 'Step 1',
    },
    {
      label: 'Step 2',
    },
    {
      label: 'Step 3',
    },
  ]

  return <CStepper steps={steps} stepButtonLayout="vertical" />
}

const StepperVerticalLayoutExample = () => {
  const stepperRef = useRef(null)
  const uid = useId()
  const [currentStep, setCurrentStep] = useState(1)
  const [finish, setFinish] = useState(false)

  const steps = [
    {
      label: 'Step 1',
      content: (
        <CForm className="row g-3 py-3" noValidate>
          <CCol md={4}>
            <CFormInput type="text" defaultValue="Łukasz" label="First name" />
          </CCol>
          <CCol md={4}>
            <CFormInput type="text" defaultValue="Holeczek" label="Last name" />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor={`validationCustomUsername-${uid}-01`}>Username</CFormLabel>
            <CInputGroup>
              <CInputGroupText id={`inputGroupPrependFeedback-${uid}`}>@</CInputGroupText>
              <CFormInput
                type="text"
                id={`validationCustomUsername-${uid}-01`}
                aria-describedby={`inputGroupPrependFeedback-${uid}`}
              />
            </CInputGroup>
          </CCol>
        </CForm>
      ),
    },
    {
      label: 'Step 2',
      content: (
        <CForm className="row g-3  py-3" noValidate>
          <CCol md={6}>
            <CFormInput type="text" label="City" />
          </CCol>
          <CCol md={3}>
            <CFormSelect label="State">
              <option disabled>Choose...</option>
              <option>...</option>
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormInput type="text" label="Zip" />
          </CCol>
        </CForm>
      ),
    },
    {
      label: 'Step 3',
      content: (
        <CForm className="row g-3 pt-3" noValidate>
          <CCol md={6}>
            <CFormInput type="email" label="Email" />
          </CCol>
          <CCol md={6}>
            <CPasswordInput label="Password" autoComplete="current-password" />
          </CCol>
          <CCol xs={12}>
            <CFormCheck type="checkbox" label="Agree to terms and conditions" />
          </CCol>
        </CForm>
      ),
    },
  ]

  return (
    <>
      <CStepper
        layout="vertical"
        steps={steps}
        onFinish={() => setFinish(true)}
        onReset={() => setFinish(false)}
        onStepChange={setCurrentStep}
        ref={stepperRef}
      />
      <div className="d-flex gap-2 mt-4">
        {!finish && currentStep > 1 && (
          <CButton color="secondary" onClick={() => stepperRef.current?.prev()}>
            Previous
          </CButton>
        )}
        {!finish && currentStep < steps.length && (
          <CButton color="primary" onClick={() => stepperRef.current?.next()}>
            Next
          </CButton>
        )}
        {!finish && currentStep === steps.length && (
          <CButton color="primary" onClick={() => stepperRef.current?.finish()}>
            Finish
          </CButton>
        )}
        {finish && (
          <CButton color="danger" onClick={() => stepperRef.current?.reset()}>
            Reset
          </CButton>
        )}
      </div>
    </>
  )
}

const Stepper = () => {
  return (
    <CRow>
      <CCol xs={12}>
        <DocsComponents href="forms/stepper/" />
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Stepper</strong>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              The React Stepper component helps you build intuitive, multi-step form experiences
              (Form Wizards) for your React applications. It supports horizontal and vertical
              layouts, built-in form validation, custom indicators, and seamless integration with
              any React form library.
            </p>
            <DocsExample href="forms/stepper/#example">
              <StepperExample />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Stepper</strong> <small>Vertical indicator layout</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              In this example, the step indicators are displayed vertically above the labels using
              the <code>stepButtonLayout="vertical"</code> prop, while the form content remains laid
              out horizontally. This option is useful when you want a more compact and visually
              balanced look for the step navigation, especially in narrower layouts. Use{' '}
              <code>stepButtonLayout="vertical"</code> when you want a clear visual separation of
              steps without changing the main content flow.
            </p>
            <DocsExample href="forms/stepper/#vertical-indicator-layout">
              <StepperVerticalIndicatorLayoutExample />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Stepper</strong> <small>Vertical layout</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              This example shows a fully vertical multi-step form wizard created with the React
              Stepper component. By using the <code>layout="vertical"</code> prop, both the step
              indicators and the step content are stacked vertically. This layout is ideal for
              mobile devices or designs where vertical flow is preferred. Choose{' '}
              <code>layout="vertical"</code> if you want the entire wizard to guide users in a
              top-to-bottom progression.
            </p>
            <DocsExample href="forms/stepper/#vertical-layout">
              <StepperVerticalLayoutExample />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Stepper
