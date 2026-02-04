import React from 'react'
import { CCard, CCardBody, CCardHeader, CRow } from '@coreui/react-pro'
import { freeSet } from '@coreui/icons'
import { DocsIcons } from 'src/components'
import { getIconsView } from 'src/views/icons/IconView'

const CoreUIIcons = () => {
  return (
    <>
      <DocsIcons />
      <CCard className="mb-4">
        <CCardHeader>Free Icons</CCardHeader>
        <CCardBody>
          <CRow className="text-center">{getIconsView(freeSet)}</CRow>
        </CCardBody>
      </CCard>
    </>
  )
}

export default CoreUIIcons
