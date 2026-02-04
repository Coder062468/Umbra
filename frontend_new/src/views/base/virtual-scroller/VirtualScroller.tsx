import React, { useState } from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow, CVirtualScroller } from '@coreui/react-pro'
import { DocsComponents, DocsExample } from 'src/components'

export const VirtualScrollExample = () => {
  const [, setIndex] = useState<number>(0)
  return (
    <div className="bg-body border p-3 rounded">
      <CVirtualScroller
        visibleItems={20}
        onScroll={(currentItemIndex) => setIndex(currentItemIndex)}
      >
        {Array.from({ length: 10000 }, (_, i) => (
          <div key={i}>Option {i + 1}</div>
        ))}
      </CVirtualScroller>
    </div>
  )
}

const VirtualScroller = () => {
  return (
    <CRow>
      <CCol xs={12}>
        <DocsComponents href="components/virtual-scroller/" />
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Virtual Scroller</strong> <small>(10000 Items)</small>
          </CCardHeader>
          <CCardBody>
            <p className="text-body-secondary small">
              Virtual scrollers work by only rendering the items that are currently visible on the
              screen, and as the user scrolls through the list, new items are dynamically loaded and
              added to the view. This helps to reduce the amount of data that needs to be loaded and
              processed at any given time, which can improve the performance and responsiveness of
              the UI.
            </p>
            <DocsExample href="components/virtual-scroller/#virtual-scroll-10000-items">
              <VirtualScrollExample />
            </DocsExample>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default VirtualScroller
