import React from 'react'
import { CAutocomplete, CCard, CCardBody, CCardHeader, CCol, CRow, CForm } from '@coreui/react-pro'
import { DocsComponents, DocsExample } from 'src/components'
import { ProBadge } from 'src/components'

const Autocomplete = () => {
  const programmingLanguages = [
    'JavaScript',
    'TypeScript',
    'Python',
    'Java',
    'C#',
    'C++',
    'Go',
    'Rust',
    'Swift',
    'Kotlin',
    'React.js',
  ]

  const frameworks = [
    'Angular',
    'Bootstrap',
    'React.js',
    'Vue.js',
    'Svelte',
    'Next.js',
    'Nuxt.js',
    'jQuery',
  ]

  const countries = [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'France',
    'Italy',
    'Spain',
    'Poland',
    'Netherlands',
    'Belgium',
  ]

  const cities = [
    'New York',
    'Los Angeles',
    'Chicago',
    'Houston',
    'Phoenix',
    'Philadelphia',
    'San Antonio',
    'San Diego',
    'Dallas',
    'San Jose',
  ]

  const technologies = [
    'HTML',
    'CSS',
    'JavaScript',
    'TypeScript',
    'React',
    'Vue.js',
    'Angular',
    'Node.js',
    'Express',
    'MongoDB',
    'PostgreSQL',
    'Redis',
  ]

  const colors = [
    'Red',
    'Green',
    'Blue',
    'Yellow',
    'Orange',
    'Purple',
    'Pink',
    'Cyan',
    'Magenta',
    'Lime',
  ]

  const basicOptions = ['Option 1', 'Option 2', 'Option 3', 'Option 4']

  return (
    <CRow>
      <CCol xs={12}>
        <DocsComponents href="forms/autocomplete/" />
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>Basic example</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              A straightforward demonstration of how to implement a basic React.js Autocomplete
              input field, highlighting essential attributes and configurations.
            </p>
            <DocsExample href="forms/autocomplete/#basic-example">
              <CAutocomplete
                id="autocomplete1"
                label="Programming Languages"
                options={programmingLanguages}
                placeholder="Type to search...."
                cleaner
                highlightOptionsOnSearch
                indicator
                searchNoResultsLabel="No results found"
                showHints
                value="React.js"
              />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>With hints</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Enable hints by adding <code>showHints=&#123;true&#125;</code> to show completion
              suggestions as you type.
            </p>
            <DocsExample href="forms/autocomplete/#show-hints">
              <CAutocomplete
                id="autocomplete2"
                label="Frameworks"
                options={frameworks}
                placeholder="Search frameworks..."
                showHints
              />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>With cleaner button</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Add a clear button by setting <code>cleaner=&#123;true&#125;</code>.
            </p>
            <DocsExample href="forms/autocomplete/#cleaner-functionality">
              <CAutocomplete
                id="autocomplete3"
                label="Countries"
                options={countries}
                placeholder="Select country..."
                cleaner
              />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>Highlight matching text</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Enable text highlighting in dropdown options with{' '}
              <code>highlightOptionsOnSearch=&#123;true&#125;</code>.
            </p>
            <DocsExample href="forms/autocomplete/#highlight-matching-text">
              <CAutocomplete
                id="autocomplete4"
                label="Cities"
                options={cities}
                placeholder="Find city..."
                highlightOptionsOnSearch
              />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>Multiple configurations</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Combine multiple features for enhanced functionality.
            </p>
            <DocsExample href="forms/autocomplete/">
              <CForm>
                <CRow>
                  <CCol md={6} className="mb-3">
                    <CAutocomplete
                      id="autocomplete6"
                      label="Technologies (with hints & cleaner)"
                      options={technologies}
                      placeholder="Choose technology..."
                      showHints
                      cleaner
                      highlightOptionsOnSearch
                    />
                  </CCol>
                  <CCol md={6} className="mb-3">
                    <CAutocomplete
                      id="autocomplete7"
                      label="Colors"
                      options={colors}
                      placeholder="Pick a color..."
                      cleaner
                    />
                  </CCol>
                </CRow>
              </CForm>
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>CoreUI Autocomplete</strong> <small>Validation states</small>
            <ProBadge />
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Apply validation states using Bootstrap's validation classes.
            </p>
            <DocsExample href="forms/autocomplete/#validation-states">
              <CForm>
                <CRow>
                  <CCol md={4} className="mb-3">
                    <CAutocomplete
                      id="autocomplete-valid"
                      label="Valid input"
                      options={basicOptions}
                      placeholder="Valid state..."
                      valid
                      feedbackValid="Valid choice!"
                    />
                  </CCol>
                  <CCol md={4} className="mb-3">
                    <CAutocomplete
                      id="autocomplete-invalid"
                      label="Invalid input"
                      options={basicOptions}
                      placeholder="Invalid state..."
                      invalid
                      feedbackInvalid="Please select a valid option."
                    />
                  </CCol>
                  <CCol md={4} className="mb-3">
                    <CAutocomplete
                      id="autocomplete-disabled"
                      label="Disabled"
                      options={basicOptions}
                      placeholder="Disabled state..."
                      disabled
                    />
                  </CCol>
                </CRow>
              </CForm>
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Autocomplete