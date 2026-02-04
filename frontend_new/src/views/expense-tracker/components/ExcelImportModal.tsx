/**
 * Excel Import Modal Component
 * Allows bulk importing transactions from Excel files with E2EE
 *
 * Features:
 * - Client-side Excel parsing using xlsx library
 * - Auto-detection of common column names
 * - Column mapping UI
 * - Data validation and preview
 * - Bulk transaction encryption and creation with E2EE
 * - Progress tracking
 */

import React, { useState, useCallback } from 'react'
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
  CAlert,
  CSpinner,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CProgress,
} from '@coreui/react-pro'
import * as XLSX from 'xlsx'
import { transactionsAPI } from '../../../services/api'
import { encryptForCreate } from '../../../utils/e2eService'

interface ExcelImportModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  accountId?: string
}

interface ParsedRow {
  date: string
  amount: number
  paid_to_from: string
  narration: string
  rowNumber: number
  errors: string[]
}

interface ImportProgress {
  total: number
  successful: number
  failed: number
  currentRow: number
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
  accountId,
}) => {
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Parsed data state
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0)

  // Column mapping state
  const [dateColumn, setDateColumn] = useState<string>('')
  const [amountColumn, setAmountColumn] = useState<string>('')
  const [paidToFromColumn, setPaidToFromColumn] = useState<string>('')
  const [narrationColumn, setNarrationColumn] = useState<string>('')

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importComplete, setImportComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Current step (1: upload, 2: map columns, 3: preview, 4: import)
  const [currentStep, setCurrentStep] = useState<number>(1)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ]

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setFileError('Please select a valid Excel file (.xlsx, .xls, or .csv)')
      setSelectedFile(null)
      return
    }

    setFileError(null)
    setSelectedFile(file)
    parseExcelFile(file)
  }, [])

  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length === 0) {
          setFileError('Excel file is empty')
          return
        }

        // Smart header detection: Find the row with the most non-empty cells that looks like headers
        let headerRowIndex = 0
        let maxNonEmptyCells = 0

        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i]
          const nonEmptyCount = row.filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '').length

          // Check if this row contains typical header keywords
          const rowStr = row.map((cell: any) => String(cell || '').toLowerCase()).join(' ')
          const hasDateHeader = /date|dt|transaction.*date/.test(rowStr)
          const hasAmountHeader = /amount|amt|value|debit|credit/.test(rowStr)
          const hasPaidToFromHeader = /paid.*to|paid.*from|payee|vendor|party|name/.test(rowStr)

          // If this row has header-like keywords and reasonable number of cells, use it
          if ((hasDateHeader || hasAmountHeader || hasPaidToFromHeader) && nonEmptyCount >= 3) {
            headerRowIndex = i
            break
          }

          // Otherwise, use the row with the most non-empty cells
          if (nonEmptyCount > maxNonEmptyCells) {
            maxNonEmptyCells = nonEmptyCount
            headerRowIndex = i
          }
        }

        // Extract headers from detected header row
        const headers = jsonData[headerRowIndex].map((h: any) => String(h || '').trim()).filter((h: string) => h !== '')

        if (headers.length === 0) {
          setFileError('Could not find valid headers in Excel file')
          return
        }

        setExcelHeaders(headers)
        setHeaderRowIndex(headerRowIndex)

        // Auto-detect columns based on common header names
        const dateColIndex = headers.findIndex((h: string) =>
          /date|dt|transaction.*date/i.test(h)
        )
        const amountColIndex = headers.findIndex((h: string) =>
          /amount|amt|value|debit|credit/i.test(h)
        )
        const paidToFromColIndex = headers.findIndex((h: string) =>
          /paid.*to|paid.*from|payee|vendor|party|name|description/i.test(h)
        )
        const narrationColIndex = headers.findIndex((h: string) =>
          /narration|note|remark|detail|comment|memo/i.test(h)
        )

        // Set auto-detected columns
        if (dateColIndex !== -1) setDateColumn(headers[dateColIndex])
        if (amountColIndex !== -1) setAmountColumn(headers[amountColIndex])
        if (paidToFromColIndex !== -1) setPaidToFromColumn(headers[paidToFromColIndex])
        if (narrationColIndex !== -1) setNarrationColumn(headers[narrationColIndex])

        // Store raw data for later mapping
        setParsedData([])
        setCurrentStep(2)
      } catch (err) {
        console.error('Failed to parse Excel file:', err)
        setFileError('Failed to parse Excel file. Please ensure it is a valid Excel file.')
      }
    }

    reader.onerror = () => {
      setFileError('Failed to read file')
    }

    reader.readAsArrayBuffer(file)
  }, [])

  const handleMapColumns = useCallback(() => {
    if (!selectedFile || !dateColumn || !amountColumn || !paidToFromColumn) {
      setError('Please select required columns (Date, Amount, Paid To/From)')
      return
    }

    // Re-parse the file with column mappings
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        const headers = jsonData[headerRowIndex].map((h: any) => String(h || '').trim())
        const dateIdx = headers.indexOf(dateColumn)
        const amountIdx = headers.indexOf(amountColumn)
        const paidToFromIdx = headers.indexOf(paidToFromColumn)
        const narrationIdx = narrationColumn ? headers.indexOf(narrationColumn) : -1

        const parsed: ParsedRow[] = []

        // Process data rows (start from row after detected header)
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          const errors: string[] = []

          // Skip empty rows
          if (!row || row.every((cell: any) => !cell)) continue

          // Extract values
          const dateValue = row[dateIdx]
          const amountValue = row[amountIdx]
          const paidToFromValue = row[paidToFromIdx]
          const narrationValue = narrationIdx !== -1 ? row[narrationIdx] : ''

          // Skip rows that don't have data in key columns (date or amount)
          if (!dateValue && !amountValue) continue

          // Validate and parse date
          let parsedDate = ''
          if (!dateValue) {
            errors.push('Date is required')
          } else {
            try {
              // Handle Excel date serial numbers
              if (typeof dateValue === 'number') {
                const excelDate = XLSX.SSF.parse_date_code(dateValue)
                parsedDate = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`
              } else {
                // Parse string dates
                const dateStr = String(dateValue).trim()

                // Try DD.MM.YY or DD.MM.YYYY format (common in Indian Excel files)
                const ddmmyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
                if (ddmmyyMatch) {
                  const day = parseInt(ddmmyyMatch[1], 10)
                  const month = parseInt(ddmmyyMatch[2], 10)
                  let year = parseInt(ddmmyyMatch[3], 10)

                  // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx otherwise)
                  if (year < 100) {
                    year += year < 50 ? 2000 : 1900
                  }

                  parsedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                } else {
                  // Try standard date parsing
                  const date = new Date(dateStr)
                  if (isNaN(date.getTime())) {
                    errors.push('Invalid date format')
                  } else {
                    parsedDate = date.toISOString().split('T')[0]
                  }
                }
              }
            } catch {
              errors.push('Failed to parse date')
            }
          }

          // Validate and parse amount
          let parsedAmount = 0
          if (!amountValue && amountValue !== 0) {
            errors.push('Amount is required')
          } else {
            parsedAmount = parseFloat(String(amountValue).replace(/[^\d.-]/g, ''))
            if (isNaN(parsedAmount)) {
              errors.push('Invalid amount')
            }
          }

          // Validate paid_to_from
          const parsedPaidToFrom = String(paidToFromValue || '').trim()
          if (!parsedPaidToFrom) {
            errors.push('Paid To/From is required')
          }

          // Validate narration
          const parsedNarration = String(narrationValue || '').trim()

          parsed.push({
            date: parsedDate,
            amount: parsedAmount,
            paid_to_from: parsedPaidToFrom,
            narration: parsedNarration,
            rowNumber: i + 1,
            errors,
          })
        }

        setParsedData(parsed)
        setCurrentStep(3)
        setError(null)
      } catch (err) {
        console.error('Failed to map columns:', err)
        setError('Failed to process Excel data. Please check the file format.')
      }
    }

    reader.readAsArrayBuffer(selectedFile)
  }, [selectedFile, dateColumn, amountColumn, paidToFromColumn, narrationColumn])

  const handleImport = async () => {
    if (!accountId) {
      setError('No account selected. Please select an account first.')
      return
    }

    // Filter out rows with errors
    const validRows = parsedData.filter((row) => row.errors.length === 0)

    if (validRows.length === 0) {
      setError('No valid rows to import. Please fix errors and try again.')
      return
    }

    setImporting(true)
    setImportProgress({
      total: validRows.length,
      successful: 0,
      failed: 0,
      currentRow: 0,
    })
    setError(null)

    let successful = 0
    let failed = 0

    try {
      // Import transactions sequentially to avoid overwhelming the server
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]

        setImportProgress({
          total: validRows.length,
          successful,
          failed,
          currentRow: i + 1,
        })

        try {
          // Encrypt transaction data
          const encrypted = await encryptForCreate(
            accountId,
            row.date,
            row.amount,
            row.paid_to_from,
            row.narration
          )

          // Create transaction
          await transactionsAPI.create({
            account_id: accountId,
            ...encrypted,
          })

          successful++
        } catch (err) {
          console.error(`Failed to import row ${row.rowNumber}:`, err)
          failed++
        }
      }

      setImportProgress({
        total: validRows.length,
        successful,
        failed,
        currentRow: validRows.length,
      })
      setImportComplete(true)

      // If all successful, auto-close after 2 seconds
      if (failed === 0) {
        setTimeout(() => {
          handleClose()
          onSuccess()
        }, 2000)
      }
    } catch (err) {
      console.error('Import failed:', err)
      setError('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    if (!importing) {
      // Reset state
      setSelectedFile(null)
      setFileError(null)
      setParsedData([])
      setExcelHeaders([])
      setHeaderRowIndex(0)
      setDateColumn('')
      setAmountColumn('')
      setPaidToFromColumn('')
      setNarrationColumn('')
      setCurrentStep(1)
      setImporting(false)
      setImportProgress(null)
      setImportComplete(false)
      setError(null)
      onClose()
    }
  }

  const validRowCount = parsedData.filter((row) => row.errors.length === 0).length
  const invalidRowCount = parsedData.length - validRowCount

  return (
    <CModal visible={visible} onClose={handleClose} backdrop="static" size="xl">
      <CModalHeader>
        <CModalTitle>Import Transactions from Excel</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <div>
            <CFormLabel htmlFor="excelFile">Select Excel File (.xlsx, .xls, .csv)</CFormLabel>
            <input
              type="file"
              id="excelFile"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="form-control"
            />
            {fileError && (
              <div className="text-danger mt-2">
                <small>{fileError}</small>
              </div>
            )}
            {selectedFile && !fileError && (
              <div className="mt-3">
                <CBadge color="success">File loaded: {selectedFile.name}</CBadge>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {currentStep === 2 && (
          <div>
            <CAlert color="info">
              Map Excel columns to transaction fields. The system has auto-detected some columns,
              but please verify they are correct.
            </CAlert>

            <CForm>
              <div className="mb-3">
                <CFormLabel htmlFor="dateColumn">
                  Date Column <span className="text-danger">*</span>
                </CFormLabel>
                <CFormSelect
                  id="dateColumn"
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                >
                  <option value="">-- Select Column --</option>
                  {excelHeaders.map((header, idx) => (
                    <option key={idx} value={header}>
                      {header}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="amountColumn">
                  Amount Column <span className="text-danger">*</span>
                </CFormLabel>
                <CFormSelect
                  id="amountColumn"
                  value={amountColumn}
                  onChange={(e) => setAmountColumn(e.target.value)}
                >
                  <option value="">-- Select Column --</option>
                  {excelHeaders.map((header, idx) => (
                    <option key={idx} value={header}>
                      {header}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="paidToFromColumn">
                  Paid To/From Column <span className="text-danger">*</span>
                </CFormLabel>
                <CFormSelect
                  id="paidToFromColumn"
                  value={paidToFromColumn}
                  onChange={(e) => setPaidToFromColumn(e.target.value)}
                >
                  <option value="">-- Select Column --</option>
                  {excelHeaders.map((header, idx) => (
                    <option key={idx} value={header}>
                      {header}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="narrationColumn">Narration Column (Optional)</CFormLabel>
                <CFormSelect
                  id="narrationColumn"
                  value={narrationColumn}
                  onChange={(e) => setNarrationColumn(e.target.value)}
                >
                  <option value="">-- Select Column --</option>
                  {excelHeaders.map((header, idx) => (
                    <option key={idx} value={header}>
                      {header}
                    </option>
                  ))}
                </CFormSelect>
              </div>
            </CForm>
          </div>
        )}

        {/* Step 3: Preview */}
        {currentStep === 3 && (
          <div>
            <div className="mb-3">
              <CBadge color="info" className="me-2">
                Total Rows: {parsedData.length}
              </CBadge>
              <CBadge color="success" className="me-2">
                Valid: {validRowCount}
              </CBadge>
              {invalidRowCount > 0 && (
                <CBadge color="danger">Invalid: {invalidRowCount}</CBadge>
              )}
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <CTable striped small hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Row #</CTableHeaderCell>
                    <CTableHeaderCell>Date</CTableHeaderCell>
                    <CTableHeaderCell>Amount</CTableHeaderCell>
                    <CTableHeaderCell>Paid To/From</CTableHeaderCell>
                    <CTableHeaderCell>Narration</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {parsedData.map((row, idx) => (
                    <CTableRow
                      key={idx}
                      color={row.errors.length > 0 ? 'danger' : undefined}
                    >
                      <CTableDataCell>{row.rowNumber}</CTableDataCell>
                      <CTableDataCell>{row.date || '-'}</CTableDataCell>
                      <CTableDataCell>{row.amount !== 0 ? row.amount : '-'}</CTableDataCell>
                      <CTableDataCell>{row.paid_to_from || '-'}</CTableDataCell>
                      <CTableDataCell>{row.narration || '-'}</CTableDataCell>
                      <CTableDataCell>
                        {row.errors.length > 0 ? (
                          <CBadge color="danger">{row.errors.join(', ')}</CBadge>
                        ) : (
                          <CBadge color="success">Valid</CBadge>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>

            {invalidRowCount > 0 && (
              <CAlert color="warning" className="mt-3">
                {invalidRowCount} row(s) have errors and will be skipped during import.
              </CAlert>
            )}
          </div>
        )}

        {/* Import Progress */}
        {importing && importProgress && (
          <div>
            <div className="mb-3">
              <div className="d-flex justify-content-between mb-2">
                <span>
                  Importing... ({importProgress.currentRow} of {importProgress.total})
                </span>
                <span>
                  {Math.round((importProgress.currentRow / importProgress.total) * 100)}%
                </span>
              </div>
              <CProgress>
                <CProgress
                  value={(importProgress.currentRow / importProgress.total) * 100}
                  color="primary"
                />
              </CProgress>
            </div>
            <div>
              <CBadge color="success" className="me-2">
                Successful: {importProgress.successful}
              </CBadge>
              {importProgress.failed > 0 && (
                <CBadge color="danger">Failed: {importProgress.failed}</CBadge>
              )}
            </div>
          </div>
        )}

        {/* Import Complete */}
        {importComplete && importProgress && (
          <CAlert color={importProgress.failed === 0 ? 'success' : 'warning'}>
            <strong>Import Complete!</strong>
            <div className="mt-2">
              Successfully imported {importProgress.successful} of {importProgress.total}{' '}
              transactions.
              {importProgress.failed > 0 && (
                <div className="text-danger mt-1">
                  {importProgress.failed} transaction(s) failed to import.
                </div>
              )}
            </div>
          </CAlert>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={handleClose} disabled={importing}>
          {importComplete ? 'Close' : 'Cancel'}
        </CButton>
        {currentStep === 2 && (
          <CButton
            color="primary"
            onClick={handleMapColumns}
            disabled={!dateColumn || !amountColumn || !paidToFromColumn}
          >
            Preview Data
          </CButton>
        )}
        {currentStep === 3 && !importing && !importComplete && (
          <>
            <CButton color="secondary" onClick={() => setCurrentStep(2)}>
              Back to Mapping
            </CButton>
            <CButton
              color="success"
              onClick={handleImport}
              disabled={validRowCount === 0 || !accountId}
            >
              Import {validRowCount} Transaction{validRowCount !== 1 ? 's' : ''}
            </CButton>
          </>
        )}
        {importComplete && importProgress && importProgress.failed === 0 && (
          <CButton
            color="success"
            onClick={() => {
              handleClose()
              onSuccess()
            }}
          >
            Done
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  )
}

export default ExcelImportModal
