/**
 * ExcelGridView.tsx - Clean AG Grid Implementation
 * Rebuilt from scratch with focus on proper column layout
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  CellValueChangedEvent
} from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

// E2EE utilities
import {
  decryptAndCalculateBalances,
  encryptForCreate,
  encryptForUpdate,
  recalculateBalances,
  isDuplicate,
  DecryptedTransaction,
  RawTransaction
} from '../../../utils/e2eService'
import { loadAccountDEK } from '../../../utils/keyManager'
import { transactionsAPI, accountsAPI } from '../../../services/api'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface RowData {
  id: string
  date: string
  amount: number | string
  paid_to_from: string
  narration?: string
  balance?: number | string
  isNew?: boolean
  isDirty?: boolean
  isPlaceholder?: boolean
}

interface PersonSummary {
  name: string
  total: number
}

interface ExcelGridViewProps {
  accountId: string
  openingBalance: number
}

// ═══════════════════════════════════════════════════════════
// DATE PICKER EDITOR
// ═══════════════════════════════════════════════════════════

const DatePickerEditor = forwardRef((props: any, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const defaultDate = new Date().toISOString().split('T')[0]
  const initialValue = props.value || defaultDate

  useEffect(() => {
    // Set today's date as default if no value provided
    if (!props.value && props.onValueChange) {
      props.onValueChange(defaultDate)
    }

    // Focus and open date picker
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (props.onValueChange) {
      props.onValueChange(newValue)
    }
  }

  return (
    <input
      ref={inputRef}
      type="date"
      value={props.value || initialValue}
      onChange={handleChange}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          // Stop editing to allow AG Grid to handle Tab navigation
          props.stopEditing()
        }
        if (e.key === 'Enter') {
          e.stopPropagation()
          props.stopEditing()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          props.stopEditing(true)
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        border: '2px solid #6366f1',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '14px',
        outline: 'none',
        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
        backgroundColor: '#ffffff'
      }}
    />
  )
})

DatePickerEditor.displayName = 'DatePickerEditor'

// ═══════════════════════════════════════════════════════════
// AUTOCOMPLETE EDITOR FOR PAID TO/FROM
// ═══════════════════════════════════════════════════════════

const AutocompleteEditor = forwardRef((props: any, ref) => {
  const [inputValue, setInputValue] = useState(props.value || '')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get all unique persons from existing data
  const allPersons = useMemo(() => {
    const gridApi = props.api
    if (!gridApi) return []

    const persons = new Set<string>()
    gridApi.forEachNode((node: any) => {
      const person = node.data?.paid_to_from
      if (person && typeof person === 'string' && person.trim()) {
        persons.add(person.trim())
      }
    })

    return Array.from(persons).sort()
  }, [props.api])

  // Fuzzy match function
  const fuzzyMatch = (str: string, pattern: string): boolean => {
    const strLower = str.toLowerCase()
    const patternLower = pattern.toLowerCase()

    // Exact match or contains
    if (strLower.includes(patternLower)) return true

    // Fuzzy match - all characters in pattern must appear in order
    let patternIdx = 0
    for (let i = 0; i < strLower.length && patternIdx < patternLower.length; i++) {
      if (strLower[i] === patternLower[patternIdx]) {
        patternIdx++
      }
    }
    return patternIdx === patternLower.length
  }

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim().length > 0) {
      const filtered = allPersons.filter(person =>
        fuzzyMatch(person, inputValue)
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setHighlightedIndex(0)
    } else {
      setSuggestions(allPersons.slice(0, 10)) // Show first 10 when empty
      setShowSuggestions(allPersons.length > 0)
      setHighlightedIndex(0)
    }
  }, [inputValue, allPersons])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSelect = (value: string) => {
    setInputValue(value)
    if (props.onValueChange) {
      props.onValueChange(value)
    }
    setShowSuggestions(false)
    props.stopEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showSuggestions && suggestions.length > 0) {
        handleSelect(suggestions[highlightedIndex])
      } else {
        if (props.onValueChange) {
          props.onValueChange(inputValue)
        }
        props.stopEditing()
      }
    } else if (e.key === 'Tab') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault()
        handleSelect(suggestions[highlightedIndex])
      } else {
        if (props.onValueChange) {
          props.onValueChange(inputValue)
        }
        props.stopEditing()
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      props.stopEditing(true)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          if (props.onValueChange) {
            props.onValueChange(e.target.value)
          }
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #6366f1',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '14px',
          outline: 'none',
          boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
          backgroundColor: '#ffffff',
          fontWeight: '700',
          color: '#0f172a'
        }}
        placeholder="Type to search or add new..."
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '2px solid #6366f1',
            borderRadius: '8px',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10000
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                backgroundColor: index === highlightedIndex ? '#eef2ff' : '#ffffff',
                fontWeight: '600',
                fontSize: '14px',
                color: '#0f172a',
                borderBottom: index < suggestions.length - 1 ? '1px solid #e2e8f0' : 'none',
                transition: 'background-color 0.1s'
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

AutocompleteEditor.displayName = 'AutocompleteEditor'

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ExcelGridView({ accountId, openingBalance }: ExcelGridViewProps) {
  const [rowData, setRowData] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const dekLoadedRef = useRef(false)
  const savingRowsRef = useRef(new Set<string>())

  // ═══════════════════════════════════════════════════════════
  // COLUMN DEFINITIONS - OPTIMIZED FOR 75% GRID WIDTH
  // ═══════════════════════════════════════════════════════════

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Date',
      field: 'date',
      width: 130,
      editable: true,
      cellEditor: DatePickerEditor,
      tooltipField: 'date',
      cellEditorPopup: false,
      cellStyle: {
        fontWeight: '700',
        color: '#334155',
        fontSize: '15px',
        display: 'flex',
        alignItems: 'center'
      },
      valueFormatter: (p) => {
        if (!p.value) return ''
        const date = new Date(p.value)
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 130,
      editable: true,
      valueFormatter: (p) => {
        if (p.value == null || p.value === '') return ''
        const num = typeof p.value === 'string' ? parseFloat(p.value) : p.value
        if (isNaN(num)) return ''
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(num)
      },
      cellStyle: (p) => {
        if (!p.value && p.value !== 0) return { display: 'flex', alignItems: 'center' }
        const amt = typeof p.value === 'string' ? parseFloat(p.value) : p.value
        return amt < 0
          ? {
              color: '#ef4444',
              fontWeight: '900',
              fontSize: '16px',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center'
            }
          : {
              color: '#10b981',
              fontWeight: '900',
              fontSize: '16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center'
            }
      }
    },
    {
      headerName: 'Paid To/From',
      field: 'paid_to_from',
      flex: 1,
      minWidth: 140,
      editable: true,
      cellEditor: AutocompleteEditor,
      cellEditorPopup: false,
      cellStyle: {
        fontWeight: '700',
        color: '#0f172a',
        fontSize: '15px',
        display: 'flex',
        alignItems: 'center'
      }
    },
    {
      headerName: 'Description',
      field: 'narration',
      flex: 2,
      minWidth: 180,
      editable: true,
      cellStyle: {
        color: '#64748b',
        fontStyle: 'italic',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center'
      }
    },
    {
      headerName: 'Balance',
      field: 'balance_after',
      width: 130,
      editable: false,
      valueFormatter: (p) => {
        if (p.value == null) return ''
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(p.value)
      },
      cellStyle: (p) => {
        if (!p.value && p.value !== 0) return { display: 'flex', alignItems: 'center' }
        return p.value < 0
          ? {
              color: '#ef4444',
              fontWeight: '900',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center'
            }
          : {
              color: '#10b981',
              fontWeight: '900',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center'
            }
      }
    }
  ], [])

  // ═══════════════════════════════════════════════════════════
  // LOAD TRANSACTIONS
  // ═══════════════════════════════════════════════════════════

  const loadTransactions = useCallback(async () => {
    if (!accountId) return

    setLoading(true)
    try {
      if (!dekLoadedRef.current) {
        const accountResponse = await accountsAPI.getById(accountId)
        await loadAccountDEK(accountId, accountResponse.data.encrypted_dek)
        dekLoadedRef.current = true
      }

      const response = await transactionsAPI.getAll({ account_id: accountId })
      const rawTransactions: RawTransaction[] = response.data.transactions

      const decrypted = await decryptAndCalculateBalances(
        rawTransactions,
        accountId,
        openingBalance
      )

      // Add 15+ placeholder rows
      const emptyRowsCount = Math.max(15 - decrypted.length, 5)
      const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => ({
        id: `empty_${Date.now()}_${i}`,
        date: '',
        amount: '',
        paid_to_from: '',
        narration: '',
        balance_after: null,
        isNew: true,
        isPlaceholder: true
      }))

      setRowData([...decrypted, ...emptyRows])
    } catch (error) {
      // Silent error - grid will show empty
    } finally {
      setLoading(false)
    }
  }, [accountId, openingBalance])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Premium fintech grid styling
  useEffect(() => {
    const styleId = 'premium-fintech-grid-style'
    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style')
      styleTag.id = styleId
      styleTag.innerHTML = `
        /* Premium grid background */
        .ag-theme-alpine {
          --ag-background-color: rgba(255, 255, 255, 0.98);
          --ag-foreground-color: #1e293b;
          --ag-odd-row-background-color: rgba(248, 250, 252, 0.5);
          --ag-row-hover-color: rgba(99, 102, 241, 0.08);
          --ag-border-color: #e2e8f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Header styling - premium fintech look */
        .ag-theme-alpine .ag-header {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 2px solid #6366f1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .ag-theme-alpine .ag-header-cell {
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
          border-right: 1px solid #e2e8f0 !important;
          padding: 0 20px;
        }

        .ag-theme-alpine .ag-header-cell:last-child {
          border-right: none !important;
        }

        /* Cell styling - clean and modern */
        .ag-theme-alpine .ag-cell {
          border-right: 1px solid #f1f5f9 !important;
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 0 20px;
          line-height: 56px;
          font-size: 15px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ag-theme-alpine .ag-cell:last-child {
          border-right: none !important;
        }

        /* Row styling - subtle stripes with hover */
        .ag-theme-alpine .ag-row {
          border: none;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ag-theme-alpine .ag-row-odd {
          background: rgba(248, 250, 252, 0.3);
        }

        .ag-theme-alpine .ag-row-even {
          background: #ffffff;
        }

        .ag-theme-alpine .ag-row:hover {
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%) !important;
          transform: translateX(2px);
          box-shadow: inset 3px 0 0 #6366f1;
        }

        /* Cell focus - premium accent */
        .ag-theme-alpine .ag-cell-focus,
        .ag-theme-alpine .ag-cell-focus:not(.ag-cell-range-selected) {
          border: 2px solid #6366f1 !important;
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
          background: #ffffff !important;
        }

        /* Edit mode - elevated */
        .ag-theme-alpine .ag-cell-inline-editing {
          background: #ffffff !important;
          border: 2px solid #6366f1 !important;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
          padding: 0 18px;
          z-index: 10;
        }

        /* Scrollbar styling - minimalist */
        .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
        .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
        .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
          background: transparent;
        }

        .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
        .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
        .ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `
      document.head.appendChild(styleTag)
    }

    return () => {
      const el = document.getElementById(styleId)
      if (el) el.remove()
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // AUTO-SAVE ROW
  // ═══════════════════════════════════════════════════════════

  const autoSaveRow = useCallback(async (rowNode: any) => {
    const data = rowNode.data as RowData

    // Check if this row is already being saved
    if (savingRowsRef.current.has(data.id)) {
      return
    }

    if (!data.date || !data.amount || !data.paid_to_from) {
      return
    }

    // Add row to saving set
    savingRowsRef.current.add(data.id)

    const dateStr = typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().split('T')[0]
    const amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount

    if (isNaN(amountNum)) {
      savingRowsRef.current.delete(data.id)
      return
    }

    const realTransactions = rowData.filter(r => !r.isNew && !r.isPlaceholder)

    if (isDuplicate(realTransactions, dateStr, amountNum, data.paid_to_from, data.narration || null)) {

      // Clear the row back to placeholder state
      const clearedRow = {
        id: data.id,
        date: '',
        amount: '',
        paid_to_from: '',
        narration: '',
        balance_after: null,
        isNew: true,
        isPlaceholder: true
      }

      // Update the row directly in the grid
      rowNode.setData(clearedRow)

      // Also update the state
      setRowData(prevRows =>
        prevRows.map(row =>
          row.id === data.id ? clearedRow : row
        )
      )

      // Remove from saving set
      savingRowsRef.current.delete(data.id)

      return
    }

    try {
      if (data.isNew) {
        const encrypted = await encryptForCreate(
          accountId,
          dateStr,
          amountNum,
          data.paid_to_from,
          data.narration || ''
        )

        const response = await transactionsAPI.create({
          account_id: accountId,
          ...encrypted
        })

        const savedTransaction = response.data
        const allRealTransactions = [...realTransactions, {
          id: savedTransaction.id,
          account_id: accountId,
          date: dateStr,
          amount: amountNum,
          paid_to_from: data.paid_to_from,
          narration: data.narration || '',
          created_at: savedTransaction.created_at,
          updated_at: savedTransaction.updated_at
        }]

        const recalculated = recalculateBalances(allRealTransactions, openingBalance)

        // Use AG Grid transactions for smooth, non-disruptive updates
        if (gridApi) {
          // Get the currently editing cell to avoid updating it
          const editingCells = gridApi.getEditingCells()
          const editingRowId = editingCells.length > 0 ? editingCells[0].rowIndex : null

          // Update all existing real transactions with new balances
          // But skip the row currently being edited to avoid disruption
          const rowsToUpdate = recalculated.filter((row, index) => {
            if (editingRowId !== null) {
              const rowNode = gridApi.getDisplayedRowAtIndex(index)
              return rowNode ? rowNode.id !== String(editingRowId) : true
            }
            return true
          })

          if (rowsToUpdate.length > 0) {
            gridApi.applyTransaction({ update: rowsToUpdate })
          }

          // Add new placeholder rows if needed
          const placeholderRows = rowData.filter(r => r.isPlaceholder && r.id !== data.id)
          const minPlaceholders = Math.max(5 - placeholderRows.length, 0)
          if (minPlaceholders > 0) {
            const newPlaceholders = Array.from({ length: minPlaceholders }, (_, i) => ({
              id: `empty_${Date.now()}_${i}`,
              date: '',
              amount: '',
              paid_to_from: '',
              narration: '',
              balance_after: null,
              isNew: true,
              isPlaceholder: true
            }))
            gridApi.applyTransaction({ add: newPlaceholders })
          }

          // Remove the old placeholder row that was just saved
          const oldPlaceholder = rowData.find(r => r.id === data.id)
          if (oldPlaceholder) {
            gridApi.applyTransaction({ remove: [oldPlaceholder] })
          }
        } else {
          // Fallback to full update if gridApi not available
          const placeholderRows = rowData.filter(r => r.isPlaceholder && r.id !== data.id)
          const minPlaceholders = Math.max(5 - placeholderRows.length, 0)
          const newPlaceholders = Array.from({ length: minPlaceholders }, (_, i) => ({
            id: `empty_${Date.now()}_${i}`,
            date: '',
            amount: '',
            paid_to_from: '',
            narration: '',
            balance_after: null,
            isNew: true,
            isPlaceholder: true
          }))
          setRowData([...recalculated, ...placeholderRows, ...newPlaceholders])
        }
      } else {
        const encrypted = await encryptForUpdate(
          accountId,
          dateStr,
          amountNum,
          data.paid_to_from,
          data.narration || ''
        )

        await transactionsAPI.update(data.id, encrypted)

        const updatedTransactions = realTransactions.map(t =>
          t.id === data.id
            ? { ...t, date: dateStr, amount: amountNum, paid_to_from: data.paid_to_from, narration: data.narration || '' }
            : t
        )

        const recalculated = recalculateBalances(updatedTransactions, openingBalance)

        // Use AG Grid transactions for smooth updates
        if (gridApi) {
          gridApi.applyTransaction({ update: recalculated })
        } else {
          const placeholderRows = rowData.filter(r => r.isPlaceholder)
          setRowData([...recalculated, ...placeholderRows])
        }
      }
    } catch (error) {
      // Silent error - row will remain in edit state
    } finally {
      // Remove row from saving set
      savingRowsRef.current.delete(data.id)
    }
  }, [rowData, accountId, openingBalance])

  const lastEditedRowRef = useRef<string | null>(null)

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const field = event.colDef.field
    const rowNode = event.node
    const data = rowNode.data as RowData

    // Mark this row as edited
    lastEditedRowRef.current = data.id
  }, [])

  const onCellEditingStopped = useCallback((event: any) => {
    const rowNode = event.node
    const data = rowNode.data as RowData

    // Only auto-save if moving to a different row or losing focus entirely
    setTimeout(() => {
      if (lastEditedRowRef.current === data.id) {
        const editingCells = gridApi?.getEditingCells() || []
        const isStillEditingSameRow = editingCells.some(cell => {
          const node = gridApi?.getDisplayedRowAtIndex(cell.rowIndex)
          return node?.data?.id === data.id
        })

        if (!isStillEditingSameRow) {
          // User has left the row, trigger auto-save
          if (data.date && data.amount && data.paid_to_from) {
            autoSaveRow(rowNode)
          }
        }
      }
    }, 50)
  }, [autoSaveRow, gridApi])

  // ═══════════════════════════════════════════════════════════
  // GRID READY
  // ═══════════════════════════════════════════════════════════

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api)
  }, [])

  const tabToNextCell = useCallback((params: any) => {
    const previousCell = params.previousCellPosition
    const nextCell = params.nextCellPosition

    // If nextCellPosition is null, we're at the end of the row
    if (!nextCell) {
      return null
    }

    return nextCell
  }, [])

  const getRowId = useCallback((params: any) => {
    return params.data.id
  }, [])

  // ═══════════════════════════════════════════════════════════
  // ADD ROWS BUTTON
  // ═══════════════════════════════════════════════════════════

  const addTransaction = useCallback(() => {
    const newRows = Array.from({ length: 5 }, (_, i) => ({
      id: `empty_${Date.now()}_${i}`,
      date: '',
      amount: '',
      paid_to_from: '',
      narration: '',
      balance_after: null,
      isNew: true,
      isPlaceholder: true
    }))
    setRowData(prev => [...prev, ...newRows])
  }, [])

  // ═══════════════════════════════════════════════════════════
  // STATS CALCULATION
  // ═══════════════════════════════════════════════════════════

  const stats = useMemo(() => {
    // Get only saved transactions (not placeholder, not new)
    const savedTransactions = rowData.filter(r => !r.isPlaceholder && !r.isNew)
    const transactionCount = savedTransactions.length

    // Get current balance from last saved transaction
    const lastSavedTransaction = savedTransactions[savedTransactions.length - 1]
    let currentBalance = openingBalance

    if (lastSavedTransaction) {
      const balance = typeof lastSavedTransaction.balance_after === 'string'
        ? parseFloat(lastSavedTransaction.balance_after)
        : lastSavedTransaction.balance_after
      if (typeof balance === 'number' && !isNaN(balance)) {
        currentBalance = balance
      }
    }

    // Calculate net change
    const netChange = currentBalance - openingBalance

    return {
      openingBalance,
      currentBalance,
      transactionCount,
      netChange
    }
  }, [rowData, openingBalance])

  // ═══════════════════════════════════════════════════════════
  // PERSON SUMMARIES
  // ═══════════════════════════════════════════════════════════

  const personSummaries = useMemo(() => {
    const realTransactions = rowData.filter(r => !r.isNew && !r.isPlaceholder)
    const summaryMap = new Map<string, number>()

    realTransactions.forEach(row => {
      if (row.paid_to_from && typeof row.amount === 'number') {
        const current = summaryMap.get(row.paid_to_from) || 0
        summaryMap.set(row.paid_to_from, current + row.amount)
      }
    })

    return Array.from(summaryMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [rowData])

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      padding: '20px',
      gap: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.12)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            {accountId}
          </h1>
          <button
            onClick={addTransaction}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
            }}
          >
            Add 5 Rows
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'rgba(255, 255, 255, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '6px'
            }}>
              OPENING BALANCE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 900,
              color: stats.openingBalance >= 0 ? '#10b981' : '#ef4444'
            }}>
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 2
              }).format(stats.openingBalance)}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'rgba(255, 255, 255, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '6px'
            }}>
              CURRENT BALANCE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 900,
              color: stats.currentBalance >= 0 ? '#10b981' : '#ef4444'
            }}>
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 2
              }).format(stats.currentBalance)}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'rgba(255, 255, 255, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '6px'
            }}>
              TRANSACTIONS
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#60a5fa'
            }}>
              {stats.transactionCount}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'rgba(255, 255, 255, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '6px'
            }}>
              NET CHANGE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 900,
              color: stats.netChange >= 0 ? '#10b981' : '#ef4444'
            }}>
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 2
              }).format(stats.netChange)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        gap: '16px',
        flex: 1,
        minHeight: 0
      }}>
        {/* Grid Section */}
        <div style={{
          flex: '1 1 75%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '16px',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: '16px',
                color: '#94a3b8',
                fontWeight: 600
              }}>
                Loading transactions...
              </div>
            ) : (
              <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
                <AgGridReact
                  rowData={rowData}
                  columnDefs={columnDefs}
                  getRowId={getRowId}
                  onGridReady={onGridReady}
                  onCellValueChanged={onCellValueChanged}
                  onCellEditingStopped={onCellEditingStopped}
                  tabToNextCell={tabToNextCell}
                  rowHeight={56}
                  headerHeight={56}
                  animateRows={true}
                  rowSelection="single"
                  suppressRowClickSelection={true}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  suppressMovableColumns={true}
                  suppressColumnVirtualisation={false}
                  suppressCellFocus={false}
                  stopEditingWhenCellsLoseFocus={false}
                  enterNavigatesVertically={true}
                  enterNavigatesVerticallyAfterEdit={true}
                  singleClickEdit={true}
                  suppressAnimationFrame={false}
                  suppressFlash={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{
          flex: '0 0 25%',
          minWidth: '280px',
          maxWidth: '350px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.98)',
              marginBottom: '8px',
              marginTop: 0
            }}>
              People
            </h2>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.35)',
              marginBottom: '20px',
              fontWeight: 700
            }}>
              Summary by person
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flex: 1,
              overflowY: 'auto'
            }}>
              {personSummaries.map(person => (
                <div
                  key={person.name}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '15px'
                  }}>
                    {person.name}
                  </span>
                  <span style={{
                    color: person.total >= 0 ? '#10b981' : '#ef4444',
                    fontWeight: 900,
                    fontSize: '15px'
                  }}>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      maximumFractionDigits: 0
                    }).format(person.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
