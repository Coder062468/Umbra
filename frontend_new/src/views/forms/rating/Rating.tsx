import React from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRating, CRow } from '@coreui/react-pro'
import { CIcon } from '@coreui/icons-react'
import {
  cilHeart,
  cilMeh,
  cilMoodBad,
  cilMoodGood,
  cilMoodVeryBad,
  cilMoodVeryGood,
} from '@coreui/icons'
import { DocsComponents, DocsExample } from 'src/components'

export const CustomIconsExample1 = () => {
  const icons = {
    1: <CIcon icon={cilMoodVeryBad} customClassName=" " />,
    2: <CIcon icon={cilMoodBad} customClassName=" " />,
    3: <CIcon icon={cilMeh} customClassName=" " />,
    4: <CIcon icon={cilMoodGood} customClassName=" " />,
    5: <CIcon icon={cilMoodVeryGood} customClassName=" " />,
  }

  const activeIcons = {
    1: <CIcon icon={cilMoodVeryBad} customClassName="text-danger-emphasis" />,
    2: <CIcon icon={cilMoodBad} customClassName="text-danger" />,
    3: <CIcon icon={cilMeh} customClassName="text-warning" />,
    4: <CIcon icon={cilMoodGood} customClassName="text-success" />,
    5: <CIcon icon={cilMoodVeryGood} customClassName="text-success-emphasis" />,
  }

  return (
    <CRating
      activeIcon={activeIcons}
      highlightOnlySelected
      icon={icons}
      tooltips={['Very bad', 'Bad', 'Meh', 'Good', 'Very good']}
      value={3}
    />
  )
}

const Rating = () => {
  return (
    <CRow>
      <CCol xs={12}>
        <DocsComponents href="forms/rating/" />
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Embed the Rating component in your React application like this:
            </p>
            <DocsExample href="forms/rating/#how-to-use-react-rating-component">
              <CRating value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Read only</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Set the React rating component to read-only by adding <code>readOnly</code> property.
              This disables interaction, preventing users from changing the displayed rating value.
            </p>
            <DocsExample href="forms/rating/#read-only">
              <CRating readOnly value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Disabled</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Add the <code>disabled</code> boolean property to give it a grayed out appearance,
              remove pointer events, and prevent focusing.
            </p>
            <DocsExample href="forms/rating/#disabled">
              <CRating disabled value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Tooltips</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Enable descriptive text on hover by adding <code>tooltips</code> prop. This provides
              immediate feedback or guidance as the user interacts with the rating items.
            </p>
            <DocsExample href="forms/rating/#tooltips">
              <CRating tooltips value={3} />
            </DocsExample>
            <p className="text-body-secondary small">
              For custom messages, provide an array of labels corresponding to each rating value to
              enhance the user's understanding of each rating level.
            </p>
            <DocsExample href="forms/rating/#tooltips">
              <CRating tooltips={['Very bad', 'Bad', 'Meh', 'Good', 'Very good']} value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Sizes</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Larger or smaller react rating component? Add <code>size="lg"</code> or{' '}
              <code>size="sm"</code> for additional sizes.
            </p>
            <DocsExample href="forms/rating/#sizes">
              <CRating size="sm" value={3} />
              <CRating value={3} />
              <CRating size="lg" value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Precision</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Adjust the granularity of the Rating component by setting <code>precision</code> prop.
              This attribute allows for fractional ratings, such as quarter values, to provide more
              precise feedback.
            </p>
            <DocsExample href="forms/rating/#precision">
              <CRating precision={0.25} value={3} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Number of items</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Control the total number of rating items displayed by using <code>itemCount</code>{' '}
              property. You can create a React rating component with a custom scale, be it larger
              for detailed assessments or smaller for simplicity.
            </p>
            <DocsExample href="forms/rating/#number-of-items">
              <CRating className="mb-3 " itemCount={20} value={5} />
              <CRating itemCount={3} value={1} />
            </DocsExample>
          </CCardBody>
        </CCard>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>React Rating</strong> <small>Custom icons</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Customize the React rating component with your choice of SVG icons by assigning new
              values to the <code>activeIcon</code> and <code>icon</code> properties in the
              JavaScript options. This allows for a unique look tailored to the design language of
              your site or application.
            </p>
            <DocsExample href="forms/rating/#custom-icons">
              <CRating
                activeIcon={<CIcon icon={cilHeart} customClassName="text-danger" />}
                icon={<CIcon icon={cilHeart} customClassName=" " />}
                value={3}
              />
            </DocsExample>
            <p className="text-body-secondary small">
              For a more dynamic experience, define different icons for each rating value, enhancing
              the visual feedback:
            </p>
            <DocsExample href="forms/rating/#custom-icons">
              <CustomIconsExample1 />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Rating
