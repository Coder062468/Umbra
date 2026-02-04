/**
 * PDF Export Modal Component
 * Comprehensive PDF export with multiple options and flexibility
 *
 * Features:
 * - Multiple report types (Detailed, Summary by Person, Both)
 * - Date range filtering
 * - Column selection
 * - Person/entity filtering
 * - Sort options
 * - Page orientation
 * - Professional formatting with running balance
 */

import React, { useState, useEffect } from 'react'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CFormInput,
  CFormCheck,
  CAlert,
  CSpinner,
  CRow,
  CCol,
  CAccordion,
  CAccordionItem,
  CAccordionHeader,
  CAccordionBody,
} from '@coreui/react-pro'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { transactionsAPI } from '../../../services/api'
import { decryptTransaction, TransactionPayload } from '../../../utils/encryption'
import { getDEK, loadAccountDEK } from '../../../utils/keyManager'

interface PDFExportModalProps {
  visible: boolean
  onClose: () => void
  accountId: string
  accountName: string
  openingBalance: number
  currency: string
}

interface DecryptedTransaction {
  id: string
  date: string
  amount: number
  paid_to_from: string
  narration: string
  balance: number
}

type ReportType = 'detailed' | 'summary' | 'both'
type DateRangeType = 'all' | 'this_month' | 'this_year' | 'custom'
type SortBy = 'date_asc' | 'date_desc' | 'amount_asc' | 'amount_desc' | 'person'
type Orientation = 'portrait' | 'landscape'

const PDFExportModal: React.FC<PDFExportModalProps> = ({
  visible,
  onClose,
  accountId,
  accountName,
  openingBalance,
  currency,
}) => {
  // Export options state
  const [reportType, setReportType] = useState<ReportType>('detailed')
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [sortBy, setSortBy] = useState<SortBy>('date_asc')
  const [filterPerson, setFilterPerson] = useState('')

  // Column visibility
  const [showDate, setShowDate] = useState(true)
  const [showPaidToFrom, setShowPaidToFrom] = useState(true)
  const [showNarration, setShowNarration] = useState(true)
  const [showAmount, setShowAmount] = useState(true)
  const [showBalance, setShowBalance] = useState(true)

  // Additional options
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true)
  const [includeClosingBalance, setIncludeClosingBalance] = useState(true)
  const [includePageNumbers, setIncludePageNumbers] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)

  // State
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availablePersons, setAvailablePersons] = useState<string[]>([])

  // Load available persons for filtering
  useEffect(() => {
    if (visible && accountId) {
      loadAvailablePersons()
    }
  }, [visible, accountId])

  const loadAvailablePersons = async () => {
    try {
      const response = await transactionsAPI.getAll({ account_id: accountId })
      const transactions = response.data.transactions

      // Get DEK for this account
      let dek = getDEK(accountId)
      if (!dek) {
        // DEK not in cache, need to load it - but we don't have encrypted_dek here
        // The parent component should have already loaded it, but let's handle gracefully
        const persons: string[] = []
        setAvailablePersons(persons)
        return
      }

      const decrypted = await Promise.all(
        transactions.map(async (t) => {
          const payload: TransactionPayload = await decryptTransaction(dek!, t.encrypted_data || '')
          return payload.paid_to_from
        })
      )

      const unique = Array.from(new Set(decrypted)).filter(p => p).sort()
      setAvailablePersons(unique)
    } catch (err) {
      console.error('Failed to load persons:', err)
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      // Fetch transactions
      let fetchParams: any = { account_id: accountId }

      // Apply date filters
      if (dateRangeType === 'custom' && startDate && endDate) {
        fetchParams.start_date = startDate
        fetchParams.end_date = endDate
      } else if (dateRangeType === 'this_month') {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        fetchParams.start_date = firstDay.toISOString().split('T')[0]
        fetchParams.end_date = lastDay.toISOString().split('T')[0]
      } else if (dateRangeType === 'this_year') {
        const now = new Date()
        fetchParams.start_date = `${now.getFullYear()}-01-01`
        fetchParams.end_date = `${now.getFullYear()}-12-31`
      }

      const response = await transactionsAPI.getAll(fetchParams)
      const transactions = response.data.transactions

      // Get DEK for this account
      const dek = getDEK(accountId)
      if (!dek) {
        setError('Encryption key not available. Please try again.')
        return
      }

      // Decrypt transactions
      const decrypted: DecryptedTransaction[] = await Promise.all(
        transactions.map(async (t) => {
          const payload: TransactionPayload = await decryptTransaction(dek, t.encrypted_data || '')
          return {
            id: t.id,
            date: t.date,
            amount: payload.amount,
            paid_to_from: payload.paid_to_from,
            narration: payload.narration || '',
            balance: 0, // Will calculate below
          }
        })
      )

      // Sort transactions by date
      decrypted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Calculate running balance
      let runningBalance = openingBalance
      decrypted.forEach((t) => {
        runningBalance += t.amount
        t.balance = runningBalance
      })

      // Apply person filter
      let filtered = decrypted
      if (filterPerson) {
        filtered = decrypted.filter(t => t.paid_to_from === filterPerson)
      }

      // Apply sorting
      filtered = applySorting(filtered, sortBy)

      // Generate PDF
      generatePDF(filtered)
    } catch (err: any) {
      console.error('Failed to generate PDF:', err)
      setError(err.message || 'Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const applySorting = (transactions: DecryptedTransaction[], sort: SortBy): DecryptedTransaction[] => {
    const sorted = [...transactions]

    switch (sort) {
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      case 'amount_asc':
        return sorted.sort((a, b) => a.amount - b.amount)
      case 'amount_desc':
        return sorted.sort((a, b) => b.amount - a.amount)
      case 'person':
        return sorted.sort((a, b) => a.paid_to_from.localeCompare(b.paid_to_from))
      default:
        return sorted
    }
  }

  const generatePDF = (transactions: DecryptedTransaction[]) => {
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20

    // Add header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(accountName, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 8

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Account Statement', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Add date range
    doc.setFontSize(10)
    let dateRangeText = 'Period: All Transactions'
    if (dateRangeType === 'custom' && startDate && endDate) {
      dateRangeText = `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
    } else if (dateRangeType === 'this_month') {
      dateRangeText = `Period: This Month`
    } else if (dateRangeType === 'this_year') {
      dateRangeText = `Period: This Year`
    }
    doc.text(dateRangeText, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6

    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Add opening balance if enabled
    if (includeOpeningBalance) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Opening Balance: ${formatCurrency(openingBalance)}`, 14, yPosition)
      yPosition += 8
    }

    // Generate detailed report
    if (reportType === 'detailed' || reportType === 'both') {
      yPosition = generateDetailedReport(doc, transactions, yPosition, pageWidth, pageHeight)
    }

    // Generate summary by person
    if (reportType === 'summary' || reportType === 'both') {
      yPosition = generatePersonSummary(doc, transactions, yPosition, pageWidth, pageHeight)
    }

    // Add page numbers if enabled
    if (includePageNumbers) {
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }
    }

    // Open PDF in new tab for viewing (instead of auto-download)
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)

    // Open in new tab
    const newTab = window.open(pdfUrl, '_blank')

    if (newTab) {
      // Set the title of the new tab
      newTab.document.title = `${accountName} - Account Statement`

      // Clean up the URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl)
      }, 1000)
    } else {
      // If popup was blocked, fall back to download
      const filename = `${accountName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)
    }
  }

  const generateDetailedReport = (
    doc: jsPDF,
    transactions: DecryptedTransaction[],
    startY: number,
    pageWidth: number,
    pageHeight: number
  ): number => {
    // Prepare table columns
    const columns: any[] = []
    if (showDate) columns.push({ header: 'Date', dataKey: 'date' })
    if (showPaidToFrom) columns.push({ header: 'Paid To/From', dataKey: 'paid_to_from' })
    if (showNarration) columns.push({ header: 'Narration', dataKey: 'narration' })
    if (showAmount) columns.push({ header: 'Amount', dataKey: 'amount' })
    if (showBalance) columns.push({ header: 'Balance', dataKey: 'balance' })

    // Prepare table data
    const rows = transactions.map(t => ({
      date: showDate ? new Date(t.date).toLocaleDateString() : '',
      paid_to_from: showPaidToFrom ? t.paid_to_from : '',
      narration: showNarration ? t.narration : '',
      amount: showAmount ? formatCurrency(t.amount) : '',
      balance: showBalance ? formatCurrency(t.balance) : '',
    }))

    // Generate table
    autoTable(doc, {
      startY: startY,
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => r[c.dataKey as keyof typeof r])),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 14, right: 14 },
    })

    let finalY = (doc as any).lastAutoTable.finalY + 10

    // Add summary if enabled
    if (includeSummary) {
      const totalCredit = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
      const totalDebit = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      const closingBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : openingBalance

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)

      if (finalY > pageHeight - 40) {
        doc.addPage()
        finalY = 20
      }

      doc.text('Summary:', 14, finalY)
      finalY += 6

      doc.setFont('helvetica', 'normal')
      doc.text(`Total Transactions: ${transactions.length}`, 14, finalY)
      finalY += 5
      doc.text(`Total Credit: ${formatCurrency(totalCredit)}`, 14, finalY)
      finalY += 5
      doc.text(`Total Debit: ${formatCurrency(totalDebit)}`, 14, finalY)
      finalY += 5

      if (includeClosingBalance) {
        doc.setFont('helvetica', 'bold')
        doc.text(`Closing Balance: ${formatCurrency(closingBalance)}`, 14, finalY)
        finalY += 8
      }
    }

    return finalY
  }

  const generatePersonSummary = (
    doc: jsPDF,
    transactions: DecryptedTransaction[],
    startY: number,
    pageWidth: number,
    pageHeight: number
  ): number => {
    // Group by person
    const personMap = new Map<string, { count: number; total: number; credit: number; debit: number }>()

    transactions.forEach(t => {
      const existing = personMap.get(t.paid_to_from) || { count: 0, total: 0, credit: 0, debit: 0 }
      existing.count++
      existing.total += t.amount
      if (t.amount > 0) {
        existing.credit += t.amount
      } else {
        existing.debit += Math.abs(t.amount)
      }
      personMap.set(t.paid_to_from, existing)
    })

    // Convert to array and sort by total
    const personSummary = Array.from(personMap.entries())
      .map(([person, data]) => ({
        person,
        count: data.count,
        credit: data.credit,
        debit: data.debit,
        net: data.total,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

    // Check if we need a new page
    if (startY > pageHeight - 60) {
      doc.addPage()
      startY = 20
    }

    // Add header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary by Person/Entity', 14, startY)
    startY += 10

    // Generate summary table
    autoTable(doc, {
      startY: startY,
      head: [['Person/Entity', 'Transactions', 'Credit', 'Debit', 'Net Amount']],
      body: personSummary.map(p => [
        p.person,
        p.count.toString(),
        formatCurrency(p.credit),
        formatCurrency(p.debit),
        formatCurrency(p.net),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [118, 75, 162],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 14, right: 14 },
    })

    return (doc as any).lastAutoTable.finalY + 10
  }

  const handleClose = () => {
    if (!generating) {
      setError(null)
      onClose()
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static" size="lg">
      <CModalHeader>
        <CModalTitle>Export to PDF</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <CForm>
          <CAccordion activeItemKey={1} alwaysOpen>
            {/* Report Type */}
            <CAccordionItem itemKey={1}>
              <CAccordionHeader>Report Type & Date Range</CAccordionHeader>
              <CAccordionBody>
                <CRow className="mb-3">
                  <CCol md={6}>
                    <CFormLabel>Report Type</CFormLabel>
                    <CFormSelect value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
                      <option value="detailed">Detailed Transactions</option>
                      <option value="summary">Summary by Person</option>
                      <option value="both">Both (Detailed + Summary)</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Date Range</CFormLabel>
                    <CFormSelect value={dateRangeType} onChange={(e) => setDateRangeType(e.target.value as DateRangeType)}>
                      <option value="all">All Transactions</option>
                      <option value="this_month">This Month</option>
                      <option value="this_year">This Year</option>
                      <option value="custom">Custom Range</option>
                    </CFormSelect>
                  </CCol>
                </CRow>

                {dateRangeType === 'custom' && (
                  <CRow className="mb-3">
                    <CCol md={6}>
                      <CFormLabel>Start Date</CFormLabel>
                      <CFormInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel>End Date</CFormLabel>
                      <CFormInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </CCol>
                  </CRow>
                )}
              </CAccordionBody>
            </CAccordionItem>

            {/* Columns & Filters */}
            <CAccordionItem itemKey={2}>
              <CAccordionHeader>Columns & Filters</CAccordionHeader>
              <CAccordionBody>
                <CFormLabel>Show Columns</CFormLabel>
                <div className="mb-3">
                  <CFormCheck label="Date" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
                  <CFormCheck label="Paid To/From" checked={showPaidToFrom} onChange={(e) => setShowPaidToFrom(e.target.checked)} />
                  <CFormCheck label="Narration" checked={showNarration} onChange={(e) => setShowNarration(e.target.checked)} />
                  <CFormCheck label="Amount" checked={showAmount} onChange={(e) => setShowAmount(e.target.checked)} />
                  <CFormCheck label="Balance" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
                </div>

                <CRow>
                  <CCol md={6}>
                    <CFormLabel>Filter by Person</CFormLabel>
                    <CFormSelect value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
                      <option value="">All Persons</option>
                      {availablePersons.map(person => (
                        <option key={person} value={person}>{person}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Sort By</CFormLabel>
                    <CFormSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                      <option value="date_asc">Date (Oldest First)</option>
                      <option value="date_desc">Date (Newest First)</option>
                      <option value="amount_asc">Amount (Low to High)</option>
                      <option value="amount_desc">Amount (High to Low)</option>
                      <option value="person">Person/Entity (A-Z)</option>
                    </CFormSelect>
                  </CCol>
                </CRow>
              </CAccordionBody>
            </CAccordionItem>

            {/* Layout & Options */}
            <CAccordionItem itemKey={3}>
              <CAccordionHeader>Layout & Options</CAccordionHeader>
              <CAccordionBody>
                <CRow className="mb-3">
                  <CCol md={6}>
                    <CFormLabel>Page Orientation</CFormLabel>
                    <CFormSelect value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </CFormSelect>
                  </CCol>
                </CRow>

                <CFormLabel>Include</CFormLabel>
                <div>
                  <CFormCheck label="Opening Balance" checked={includeOpeningBalance} onChange={(e) => setIncludeOpeningBalance(e.target.checked)} />
                  <CFormCheck label="Closing Balance" checked={includeClosingBalance} onChange={(e) => setIncludeClosingBalance(e.target.checked)} />
                  <CFormCheck label="Page Numbers" checked={includePageNumbers} onChange={(e) => setIncludePageNumbers(e.target.checked)} />
                  <CFormCheck label="Summary Totals" checked={includeSummary} onChange={(e) => setIncludeSummary(e.target.checked)} />
                </div>
              </CAccordionBody>
            </CAccordionItem>
          </CAccordion>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={handleClose} disabled={generating}>
          Cancel
        </CButton>
        <CButton color="primary" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Generating PDF...
            </>
          ) : (
            'Generate PDF'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default PDFExportModal
