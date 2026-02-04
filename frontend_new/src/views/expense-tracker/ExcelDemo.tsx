/**
 * Expense Tracker - Style D (CoreUI Pro Optimized)
 * Modern gradient design with glass-morphism effects
 */

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type {
  ColDef,
  GridReadyEvent,
  CellEditingStoppedEvent,
  GridApi,
} from 'ag-grid-community'
import { CCard, CCardBody, CCardHeader, CButton } from '@coreui/react-pro'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// Sample transaction data
interface Transaction {
  id: string | number
  date: string
  amount: number | null
  paidToFrom: string
  narration: string
  balance: number | null
  isEmpty?: boolean  // Flag to identify empty rows
}

// Auto-tracker summary
interface PersonSummary {
  person: string
  total: number
  count: number
}

const OPENING_BALANCE = 0.10

const SAMPLE_DATA: Transaction[] = [
  { id: '1', date: '2024-01-15', amount: -810000, paidToFrom: 'Dinesh Limbasia', narration: 'Vehicle Purchase', balance: 0 },
  { id: '2', date: '2024-01-18', amount: -452400, paidToFrom: 'Tejas Jain', narration: 'Insurance Premium', balance: 0 },
  { id: '3', date: '2024-01-20', amount: 500000, paidToFrom: 'Cash Deposit', narration: 'Capital Investment', balance: 0 },
  { id: '4', date: '2024-01-22', amount: -6500, paidToFrom: 'Hamza', narration: 'Parts Purchase', balance: 0 },
  { id: '5', date: '2024-01-25', amount: -3500, paidToFrom: 'Hamza', narration: 'Maintenance', balance: 0 },
  { id: '6', date: '2024-01-28', amount: -125000, paidToFrom: 'Ravi Kumar', narration: 'Workshop Rent', balance: 0 },
  { id: '7', date: '2024-02-01', amount: 85000, paidToFrom: 'Customer Payment', narration: 'Service Revenue', balance: 0 },
  { id: '8', date: '2024-02-05', amount: -45000, paidToFrom: 'Amit Patel', narration: 'Spare Parts', balance: 0 },
  { id: '9', date: '2024-02-08', amount: -12500, paidToFrom: 'Priya Sharma', narration: 'Office Supplies', balance: 0 },
  { id: '10', date: '2024-02-10', amount: 150000, paidToFrom: 'Vehicle Sale', narration: 'Maruti Swift Sale', balance: 0 },
  { id: '11', date: '2024-02-12', amount: -8500, paidToFrom: 'Electricity Bill', narration: 'Monthly Utility', balance: 0 },
  { id: '12', date: '2024-02-15', amount: -25000, paidToFrom: 'Suresh Yadav', narration: 'Labor Charges', balance: 0 },
  { id: '13', date: '2024-02-18', amount: 95000, paidToFrom: 'Customer Payment', narration: 'Repair Work', balance: 0 },
  { id: '14', date: '2024-02-20', amount: -18000, paidToFrom: 'Fuel Expense', narration: 'Monthly Fuel', balance: 0 },
  { id: '15', date: '2024-02-22', amount: -35000, paidToFrom: 'Vikram Singh', narration: 'Tool Purchase', balance: 0 },
]

const ExcelDemo: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)

  // Initialize with data + 3 empty rows
  const [rowData, setRowData] = useState<Transaction[]>(() => {
    const calculated = calculateBalances(SAMPLE_DATA)
    return [...calculated, ...createEmptyRows(3)]
  })

  // Create empty rows for Excel-like experience
  function createEmptyRows(count: number): Transaction[] {
    const emptyRows: Transaction[] = []
    for (let i = 0; i < count; i++) {
      emptyRows.push({
        id: -(Date.now() + i), // Negative ID for empty rows
        date: '',
        amount: null,
        paidToFrom: '',
        narration: '',
        balance: null,
        isEmpty: true
      })
    }
    return emptyRows
  }

  // Ensure we always have 2-3 empty rows at the bottom
  const ensureEmptyRows = useCallback((transactions: Transaction[]) => {
    const emptyRowCount = transactions.filter(t => t.isEmpty).length

    if (emptyRowCount < 2) {
      const rowsToAdd = 3 - emptyRowCount
      return [...transactions, ...createEmptyRows(rowsToAdd)]
    }
    return transactions
  }, [])

  // Calculate running balances (skip empty rows)
  function calculateBalances(transactions: Transaction[]): Transaction[] {
    // Separate real and empty transactions
    const realTransactions = transactions.filter(t => !t.isEmpty)
    const emptyTransactions = transactions.filter(t => t.isEmpty)

    // Sort real transactions by date
    const sorted = [...realTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    // Calculate balances for real transactions
    let runningBalance = OPENING_BALANCE
    const calculated = sorted.map(t => {
      runningBalance += (t.amount || 0)
      return { ...t, balance: runningBalance }
    })

    // Return real transactions + empty ones at the end
    return [...calculated, ...emptyTransactions]
  }

  // Recalculate all balances when data changes
  const recalculateAllBalances = useCallback(() => {
    setRowData(prevData => {
      const updated = calculateBalances(prevData)
      return ensureEmptyRows(updated)
    })
  }, [ensureEmptyRows])

  // Auto-tracker: Calculate person summaries (exclude empty rows)
  const personSummaries = useMemo((): PersonSummary[] => {
    const summaryMap = new Map<string, { total: number; count: number }>()

    // Only process non-empty rows
    rowData
      .filter(row => !row.isEmpty)
      .forEach(row => {
        const person = row.paidToFrom.trim()
        if (!person) return

        const existing = summaryMap.get(person) || { total: 0, count: 0 }
        summaryMap.set(person, {
          total: existing.total + (row.amount || 0),
          count: existing.count + 1,
        })
      })

    return Array.from(summaryMap.entries())
      .map(([person, data]) => ({ person, total: data.total, count: data.count }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [rowData])

  // Current balance (from last real transaction)
  const currentBalance = useMemo(() => {
    const realTransactions = rowData.filter(t => !t.isEmpty && t.balance !== null)
    if (realTransactions.length === 0) return OPENING_BALANCE

    // Get the last balance from sorted real transactions
    const sorted = [...realTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return sorted[0].balance || OPENING_BALANCE
  }, [rowData])

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}.${month}.${year}`
  }

  // Column definitions
  const columnDefs: ColDef<Transaction>[] = useMemo(
    () => [
      {
        field: 'date',
        headerName: 'Date',
        editable: true,
        width: 120,
        cellEditor: 'agDateStringCellEditor',
        valueFormatter: params => params.value ? formatDate(params.value) : '',
        cellStyle: { fontWeight: '500', textAlign: 'center' },
      },
      {
        field: 'amount',
        headerName: 'Amount (₹)',
        editable: true,
        width: 180,
        cellEditor: 'agNumberCellEditor',
        valueFormatter: params => {
          if (params.value == null) return ''
          return new Intl.NumberFormat('en-IN').format(params.value)
        },
        cellStyle: params => {
          if (params.value < 0) {
            return { color: '#DC2626', fontWeight: '600', textAlign: 'right' }
          }
          return { color: '#16A34A', fontWeight: '600', textAlign: 'right' }
        },
      },
      {
        field: 'paidToFrom',
        headerName: 'Paid To/From',
        editable: true,
        flex: 1.5,
        minWidth: 180,
        cellEditor: 'agTextCellEditor',
      },
      {
        field: 'narration',
        headerName: 'Narration',
        editable: true,
        flex: 3,
        minWidth: 250,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3,
          cols: 50,
        },
      },
      {
        field: 'balance',
        headerName: 'Balance (₹)',
        editable: false,
        width: 180,
        valueFormatter: params => {
          if (params.value == null) return ''
          return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(params.value)
        },
        cellStyle: params => {
          if (params.value < 0) {
            return {
              color: '#DC2626',
              fontWeight: '700',
              textAlign: 'right',
              backgroundColor: '#FEF2F2'
            }
          }
          return {
            color: '#16A34A',
            fontWeight: '700',
            textAlign: 'right',
            backgroundColor: '#F0FDF4'
          }
        },
      },
    ],
    []
  )

  // Default column properties
  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      cellClass: (params: any) => {
        return params.data.isEmpty ? 'empty-row' : ''
      }
    }),
    []
  )

  // Grid ready callback
  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api)
  }

  // Cell value changed - detect empty row conversion and recalculate
  const onCellValueChanged = useCallback((event: any) => {
    const row = event.data as Transaction

    // Check if this was an empty row that now has data
    if (row.isEmpty && (row.date || row.amount || row.paidToFrom)) {
      // Convert empty row to real transaction
      row.isEmpty = false
      row.id = `txn-${Date.now()}` // Assign proper ID

      // Get all current rows
      const allRows: Transaction[] = []
      gridApi?.forEachNode(node => allRows.push(node.data))

      // Recalculate and ensure empty rows
      setRowData(prevData => {
        const updated = calculateBalances(allRows)
        return ensureEmptyRows(updated)
      })
    } else if (!row.isEmpty) {
      // Regular transaction edited - just recalculate
      const allRows: Transaction[] = []
      gridApi?.forEachNode(node => allRows.push(node.data))
      setRowData(calculateBalances(allRows))
    }
  }, [gridApi, ensureEmptyRows])

  // Keep the old handler for compatibility (redirects to new one)
  const onCellEditingStopped = useCallback((event: CellEditingStoppedEvent) => {
    if (event.valueChanged) {
      onCellValueChanged(event)
    }
  }, [onCellValueChanged])

  // Add 10 empty rows for bulk entry
  const handleAddTransaction = () => {
    const newEmptyRows = createEmptyRows(10)
    setRowData([...rowData, ...newEmptyRows])

    // Focus the first new empty row
    setTimeout(() => {
      const firstEmptyRowIndex = rowData.filter(t => !t.isEmpty).length
      gridApi?.setFocusedCell(firstEmptyRowIndex, 'date')
      gridApi?.startEditingCell({ rowIndex: firstEmptyRowIndex, colKey: 'date' })
    }, 100)
  }

  return (
    <>
      {/* Page wrapper with gradient background - fits within CoreUI content area */}
      <div style={{
        width: '100%',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        margin: '0',
        boxSizing: 'border-box'
      }}>

        {/* Header Card */}
        <CCard style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: 'none',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <CCardHeader style={{
            background: 'transparent',
            border: 'none',
            padding: '20px 24px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h1 style={{
                fontSize: '22px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0
              }}>
                BHARAT AUTO HUB TRACKER
              </h1>

              <CButton
                onClick={handleAddTransaction}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
              >
                + Add 10 Rows
              </CButton>
            </div>

            <div style={{ display: 'flex', gap: '32px', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  color: '#6B7280',
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Opening Balance
                </div>
                <div style={{
                  fontWeight: '700',
                  fontSize: '18px',
                  fontFamily: "'SF Mono', 'Monaco', monospace",
                  color: '#10B981'
                }}>
                  {formatCurrency(OPENING_BALANCE)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  color: '#6B7280',
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Current Balance
                </div>
                <div style={{
                  fontWeight: '700',
                  fontSize: '18px',
                  fontFamily: "'SF Mono', 'Monaco', monospace",
                  color: currentBalance < 0 ? '#EF4444' : '#10B981'
                }}>
                  {formatCurrency(currentBalance)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  color: '#6B7280',
                  fontSize: '11px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Total Transactions
                </div>
                <div style={{
                  fontWeight: '700',
                  fontSize: '18px',
                  fontFamily: "'SF Mono', 'Monaco', monospace",
                  color: '#667eea'
                }}>
                  {rowData.length}
                </div>
              </div>
            </div>
          </CCardHeader>
        </CCard>

        {/* Main Content Row */}
        <div style={{
          display: 'flex',
          gap: '20px',
          height: 'calc(100vh - 280px)', // Adjust for header and padding
        }}>

          {/* Transaction Grid Card - 82% */}
          <CCard style={{
            flex: '0 0 82%',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}>
            <CCardHeader style={{
              background: 'transparent',
              border: 'none',
              padding: '16px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📊 Transaction History
            </CCardHeader>
            <CCardBody style={{
              padding: '0 16px 16px 16px',
              height: 'calc(100% - 60px)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div
                className="ag-theme-alpine"
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <AgGridReact
                  ref={gridRef}
                  rowData={rowData}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  onGridReady={onGridReady}
                  onCellValueChanged={onCellValueChanged}
                  onCellEditingStopped={onCellEditingStopped}
                  singleClickEdit={true}
                  stopEditingWhenCellsLoseFocus={true}
                  rowSelection="single"
                  animateRows={true}
                  domLayout="normal"
                />
              </div>
            </CCardBody>
          </CCard>

          {/* Auto-Tracker Sidebar Card - 18% */}
          <CCard style={{
            flex: '0 0 18%',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            overflowY: 'auto'
          }}>
            <CCardBody style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '4px'
                }}>
                  📈 Summary
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#6B7280'
                }}>
                  {personSummaries.length} unique persons
                </div>
              </div>

              {/* Person Summary Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {personSummaries.map((summary) => (
                  <div
                    key={summary.person}
                    style={{
                      padding: '12px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.15)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: '#111827',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {summary.person}
                      </div>
                      <div style={{
                        fontSize: '9px',
                        color: '#6B7280',
                        background: '#F3F4F6',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: '500'
                      }}>
                        {summary.count} txn{summary.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: '700',
                      fontFamily: "'SF Mono', 'Monaco', monospace",
                      fontSize: '15px',
                      color: summary.total < 0 ? '#EF4444' : '#10B981'
                    }}>
                      {new Intl.NumberFormat('en-IN').format(summary.total)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Footer */}
              <div style={{
                marginTop: '16px',
                padding: '14px',
                background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                borderRadius: '10px',
                border: '1px solid #FCA5A5'
              }}>
                <div style={{
                  fontSize: '10px',
                  color: '#991B1B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>
                  Total Expenses
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#DC2626',
                  fontFamily: "'SF Mono', 'Monaco', monospace"
                }}>
                  {formatCurrency(personSummaries.reduce((sum, p) => sum + p.total, 0))}
                </div>
              </div>
            </CCardBody>
          </CCard>
        </div>
      </div>

      {/* Custom AG Grid Styling */}
      <style>{`
        .ag-theme-alpine {
          --ag-border-radius: 8px;
          --ag-header-background-color: #F9FAFB;
          --ag-odd-row-background-color: #FFFFFF;
          --ag-row-hover-color: #F3F4F6;
        }

        /* Empty row styling for Excel-like experience */
        .ag-theme-alpine .empty-row {
          background-color: #FAFBFC !important;
          color: #9CA3AF !important;
          font-style: italic;
        }

        .ag-theme-alpine .empty-row:hover {
          background-color: #F3F4F6 !important;
          cursor: text;
        }

        /* Remove special background for balance column in empty rows */
        .ag-theme-alpine .empty-row[col-id="balance"] {
          background-color: #FAFBFC !important;
        }

        .ag-theme-alpine .empty-row:hover[col-id="balance"] {
          background-color: #F3F4F6 !important;
        }
      `}</style>
    </>
  )
}

export default ExcelDemo
