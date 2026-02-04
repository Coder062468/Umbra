/**
 * ExcelGridView.tsx - Premium Financial Application Grid
 *
 * Design Philosophy: Modern fintech aesthetic (Stripe, Mercury Bank, Linear)
 * All styles inline with AG Grid customization via injected CSS
 *
 * Features:
 * - Full E2EE encryption (all sensitive data encrypted client-side)
 * - AG Grid with inline editing
 * - Auto-save on cell blur
 * - Client-side balance calculation
 * - Person-wise summary sidebar
 * - Premium glassmorphism UI with micro-interactions
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

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// AG Grid base styles - Using legacy v32 theme system
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
// CUSTOM DATE PICKER CELL EDITOR
// ═══════════════════════════════════════════════════════════

const DatePickerEditor = forwardRef((props: any, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
    }
  }, [])

  return (
    <input
      ref={inputRef}
      type="date"
      value={props.value || new Date().toISOString().split('T')[0]}
      onChange={(e) => props.onValueChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') props.stopEditing()
        if (e.key === 'Escape') props.stopEditing(true)
      }}
      style={{
        width: '100%',
        height: '100%',
        border: '2px solid #6366f1',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '13px',
        fontFamily: 'inherit',
        outline: 'none',
        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
      }}
    />
  )
})

DatePickerEditor.displayName = 'DatePickerEditor'

// ═══════════════════════════════════════════════════════════
// PREMIUM INLINE STYLES - FINTECH AESTHETIC
// ═══════════════════════════════════════════════════════════

const styles = {
  // CONTAINER
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    padding: '0',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    minHeight: '100vh'
  },

  // HEADER CARD - GLASSMORPHISM
  headerCard: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.6)'
  },

  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },

  accountTitle: {
    fontSize: '32px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.02em',
    margin: 0
  },

  // BUTTON - GRADIENT WITH RIPPLE EFFECT
  btnAdd: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    letterSpacing: '0.01em'
  },

  // STATS GRID - 4 COLUMNS
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px'
  },

  statBox: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)'
  },

  statLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '12px'
  },

  statAmount: {
    fontSize: '28px',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
    fontVariantNumeric: 'tabular-nums' as const,
    letterSpacing: '-0.01em'
  },

  // MAIN LAYOUT
  mainLayout: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start'
  },

  // GRID SECTION - 78% WIDTH
  gridSection: {
    flex: '0 0 calc(78% - 12px)',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    display: 'flex',
    flexDirection: 'column' as const
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },

  sectionTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
    letterSpacing: '-0.01em'
  },

  // GRID CONTAINER
  gridContainer: {
    position: 'relative' as const,
    flex: 1,
    borderRadius: '16px',
    overflow: 'hidden',
    height: '700px',
    width: '100%',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05) inset',
    backgroundColor: '#ffffff'
  },

  // SIDEBAR - 22% WIDTH
  sidebar: {
    flex: '0 0 calc(22% - 12px)',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    maxHeight: '800px',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'sticky' as const,
    top: '24px'
  },

  sidebarTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
    letterSpacing: '-0.01em'
  },

  sidebarSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '24px',
    fontWeight: 500
  },

  // PEOPLE LIST - SCROLLABLE
  peopleList: {
    flex: 1,
    overflowY: 'auto' as const,
    marginBottom: '24px',
    paddingRight: '4px',
    scrollbarWidth: 'thin' as const,
    scrollbarColor: '#cbd5e0 transparent'
  },

  // PERSON ITEM - PROFILE CARD AESTHETIC
  personItem: {
    background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
    padding: '16px 20px',
    borderRadius: '12px',
    marginBottom: '12px',
    border: '2px solid transparent',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer'
  },

  personTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },

  personName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#111827',
    letterSpacing: '-0.01em'
  },

  personCount: {
    background: 'white',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em'
  },

  personTotal: {
    fontSize: '18px',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
    fontVariantNumeric: 'tabular-nums' as const
  },

  // SUMMARY FOOTER - DISTINCT TREATMENT
  summaryFooter: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    padding: '20px 24px',
    borderRadius: '16px',
    border: '2px solid #fca5a5'
  },

  footerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#991b1b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px'
  },

  footerTotal: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#dc2626',
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
    fontVariantNumeric: 'tabular-nums' as const
  },

  // LOADING STATE - SKELETON
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '600px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500
  },

  // SAVING INDICATOR - TOAST
  savingIndicator: {
    position: 'fixed' as const,
    top: '24px',
    right: '24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
    zIndex: 1000,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  }
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface ExcelGridViewProps {
  accountId: string
  openingBalance: number
  accountName: string
}

interface RowData extends Partial<DecryptedTransaction> {
  id: string
  date: string
  amount: string | number
  paid_to_from: string
  narration?: string
  balance_after?: number
  serialNumber?: number
  isNew?: boolean
  isDirty?: boolean
}

interface PersonSummary {
  person: string
  total: number
  count: number
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const ExcelGridView: React.FC<ExcelGridViewProps> = ({
  accountId,
  openingBalance,
  accountName
}) => {
  // ─────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────

  const [rowData, setRowData] = useState<RowData[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ─────────────────────────────────────────────────────────
  // REFS
  // ─────────────────────────────────────────────────────────

  const gridApiRef = useRef<GridApi | null>(null)
  const savingRowsRef = useRef<Set<string>>(new Set())
  const dekLoadedRef = useRef<boolean>(false)

  // ─────────────────────────────────────────────────────────
  // INJECT AG GRID PREMIUM CSS
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    const styleId = 'ag-grid-premium-styles'

    if (!document.getElementById(styleId)) {
      const styleTag = document.createElement('style')
      styleTag.id = styleId
      styleTag.textContent = `
        /* ═══ AG GRID PREMIUM FINTECH STYLING ═══ */

        .premium-grid.ag-theme-alpine {
          --ag-background-color: #ffffff;
          --ag-header-background-color: #f8fafc;
          --ag-odd-row-background-color: #ffffff;
          --ag-row-hover-color: #f0f4ff;
          --ag-border-color: #e5e7eb;
          --ag-row-border-color: #f1f5f9;
          --ag-header-foreground-color: #1e293b;
          --ag-foreground-color: #334155;
          --ag-font-size: 13px;
          --ag-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
          font-variant-numeric: tabular-nums;
        }

        /* HEADERS - MODERN GRADIENT */
        .premium-grid.ag-theme-alpine .ag-header {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
          border-bottom: 2px solid #e5e7eb !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        }

        .premium-grid.ag-theme-alpine .ag-header-cell {
          background: transparent !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 0 24px !important;
          color: #64748b !important;
        }

        .premium-grid.ag-theme-alpine .ag-header-cell:hover {
          background: rgba(99, 102, 241, 0.04) !important;
        }

        /* ROWS - CLEAN MINIMAL BORDERS */
        .premium-grid.ag-theme-alpine .ag-row {
          border: none !important;
          border-bottom: 1px solid #f1f5f9 !important;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative !important;
        }

        /* ROW HOVER - LEFT ACCENT BORDER */
        .premium-grid.ag-theme-alpine .ag-row::before {
          content: '' !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 4px !important;
          background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%) !important;
          transform: scaleY(0) !important;
          transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1) !important;
          border-radius: 0 4px 4px 0 !important;
        }

        .premium-grid.ag-theme-alpine .ag-row:hover {
          background: linear-gradient(90deg, #f0f4ff 0%, #ffffff 100%) !important;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08) !important;
          transform: translateX(2px) !important;
        }

        .premium-grid.ag-theme-alpine .ag-row:hover::before {
          transform: scaleY(1) !important;
        }

        /* ZEBRA STRIPING - ULTRA SUBTLE */
        .premium-grid.ag-theme-alpine .ag-row-even {
          background-color: #fafbfc !important;
        }

        .premium-grid.ag-theme-alpine .ag-row-odd {
          background-color: #ffffff !important;
        }

        /* SELECTED ROW */
        .premium-grid.ag-theme-alpine .ag-row-selected {
          background: linear-gradient(90deg, #e0e7ff 0%, #f5f3ff 100%) !important;
          border-left: 4px solid #6366f1 !important;
        }

        .premium-grid.ag-theme-alpine .ag-row-selected::before {
          transform: scaleY(1) !important;
        }

        /* CELLS - GENEROUS PADDING */
        .premium-grid.ag-theme-alpine .ag-cell {
          padding: 0 24px !important;
          display: flex !important;
          align-items: center !important;
          line-height: 1.5 !important;
          border-right: 1px solid #f5f7fa !important;
          color: #334155 !important;
          font-size: 13px !important;
        }

        .premium-grid.ag-theme-alpine .ag-cell:last-child {
          border-right: none !important;
        }

        /* CELL FOCUS - PURPLE RING */
        .premium-grid.ag-theme-alpine .ag-cell-focus {
          border: 2px solid #6366f1 !important;
          border-radius: 8px !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        }

        /* EDITING MODE - DRAMATIC EFFECT */
        .premium-grid.ag-theme-alpine .ag-cell-inline-editing {
          background: #ffffff !important;
          border: 2px solid #6366f1 !important;
          border-radius: 8px !important;
          padding: 14px 20px !important;
          box-shadow: 0 12px 24px rgba(99, 102, 241, 0.15), 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
          animation: cellEditPop 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          z-index: 100 !important;
        }

        @keyframes cellEditPop {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(-4px);
          }
          50% {
            transform: scale(1.02);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* INPUT FIELDS */
        .premium-grid.ag-theme-alpine .ag-cell-inline-editing input,
        .premium-grid.ag-theme-alpine .ag-cell-inline-editing select,
        .premium-grid.ag-theme-alpine .ag-cell-inline-editing textarea {
          border: none !important;
          outline: none !important;
          background: transparent !important;
          font-size: 13px !important;
          font-family: inherit !important;
          color: #1e293b !important;
          width: 100% !important;
        }

        /* SCROLLBARS - CUSTOM GRADIENT */
        .premium-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar,
        .premium-grid.ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
          width: 8px !important;
          height: 8px !important;
        }

        .premium-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track,
        .premium-grid.ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .premium-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb,
        .premium-grid.ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #cbd5e0 0%, #94a3b8 100%) !important;
          border-radius: 8px !important;
          transition: all 200ms ease !important;
        }

        .premium-grid.ag-theme-alpine .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover,
        .premium-grid.ag-theme-alpine .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%) !important;
        }

        /* SORT INDICATORS */
        .premium-grid.ag-theme-alpine .ag-header-cell-sorted-asc,
        .premium-grid.ag-theme-alpine .ag-header-cell-sorted-desc {
          background: rgba(99, 102, 241, 0.05) !important;
        }

        .premium-grid.ag-theme-alpine .ag-icon-asc,
        .premium-grid.ag-theme-alpine .ag-icon-desc {
          color: #6366f1 !important;
        }

        /* FILTER ICONS - HIDDEN BY DEFAULT */
        .premium-grid.ag-theme-alpine .ag-header-cell-menu-button,
        .premium-grid.ag-theme-alpine .ag-header-icon {
          opacity: 0 !important;
          transition: opacity 200ms ease !important;
        }

        .premium-grid.ag-theme-alpine .ag-header-cell:hover .ag-header-cell-menu-button,
        .premium-grid.ag-theme-alpine .ag-header-cell:hover .ag-header-icon {
          opacity: 0.6 !important;
        }

        /* LOADING OVERLAY */
        .premium-grid.ag-theme-alpine .ag-overlay-loading-wrapper {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border-radius: 16px !important;
          padding: 32px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
        }

        /* SIDEBAR SCROLLBAR */
        .peopleList::-webkit-scrollbar {
          width: 6px;
        }

        .peopleList::-webkit-scrollbar-track {
          background: transparent;
        }

        .peopleList::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #cbd5e0 0%, #94a3b8 100%);
          border-radius: 6px;
        }

        .peopleList::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
        }
      `
      document.head.appendChild(styleTag)
    }

    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) existingStyle.remove()
    }
  }, [])

  // ─────────────────────────────────────────────────────────
  // DATA LOADING (E2EE)
  // ─────────────────────────────────────────────────────────

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

      const emptyRow: RowData = {
        id: `new_${Date.now()}`,
        date: '',
        amount: '',
        paid_to_from: '',
        narration: '',
        isNew: true
      }

      setRowData([...decrypted, emptyRow] as RowData[])
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId, openingBalance])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    if (loading) return

    const hasEmptyRow = rowData.some(row =>
      row.isNew &&
      (!row.date || row.date === '') &&
      (!row.amount || row.amount === '') &&
      (!row.paid_to_from || row.paid_to_from === '')
    )

    if (!hasEmptyRow) {
      const emptyRow: RowData = {
        id: `new_${Date.now()}`,
        date: '',
        amount: '',
        paid_to_from: '',
        narration: '',
        isNew: true
      }
      setRowData([...rowData, emptyRow])
    }
  }, [rowData, loading])

  // ─────────────────────────────────────────────────────────
  // AUTO-SAVE (E2EE)
  // ─────────────────────────────────────────────────────────

  const autoSaveRow = async (row: RowData) => {
    if (!row.date || row.date === '') return
    if (!row.amount || row.amount === '') return
    if (!row.paid_to_from || row.paid_to_from === '') return

    if (savingRowsRef.current.has(row.id)) return

    savingRowsRef.current.add(row.id)
    setSaving(true)

    try {
      const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
      const paidToFrom = row.paid_to_from.trim()
      const narration = row.narration?.trim() || null

      if (row.isNew) {
        const existingRows = rowData.filter(r => !r.isNew) as DecryptedTransaction[]
        if (isDuplicate(existingRows, row.date, amount, paidToFrom, narration, 5000)) {
          console.warn('Duplicate transaction detected')
          savingRowsRef.current.delete(row.id)
          setSaving(false)
          return
        }

        const payload = await encryptForCreate(accountId, row.date, amount, paidToFrom, narration)
        const response = await transactionsAPI.create(payload)

        const updatedRows = rowData.map(r =>
          r.id === row.id
            ? { ...r, id: response.data.id, created_at: response.data.created_at, isNew: false, isDirty: false }
            : r
        )

        const recalculated = recalculateBalances(updatedRows as DecryptedTransaction[], openingBalance)

        const newEmptyRow: RowData = {
          id: `new_${Date.now()}`,
          date: '',
          amount: '',
          paid_to_from: '',
          narration: '',
          isNew: true
        }

        setRowData([...recalculated, newEmptyRow] as RowData[])

      } else {
        const payload = await encryptForUpdate(accountId, row.date, amount, paidToFrom, narration)
        await transactionsAPI.update(row.id, payload)

        const recalculated = recalculateBalances(rowData as DecryptedTransaction[], openingBalance)
        setRowData(recalculated as RowData[])
      }

    } catch (err) {
      console.error('Auto-save failed:', err)
    } finally {
      savingRowsRef.current.delete(row.id)
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  // PERSON SUMMARIES
  // ─────────────────────────────────────────────────────────

  const personSummaries = useMemo<PersonSummary[]>(() => {
    const personMap = new Map<string, PersonSummary>()

    rowData.forEach(row => {
      if (row.isNew || !row.paid_to_from) return

      const person = row.paid_to_from
      const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount || 0)

      if (!personMap.has(person)) {
        personMap.set(person, { person, total: 0, count: 0 })
      }

      const summary = personMap.get(person)!
      summary.total += amount
      summary.count += 1
    })

    return Array.from(personMap.values())
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [rowData])

  // ─────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const validRows = rowData.filter(r => !r.isNew)
    const currentBalance = validRows.length > 0
      ? validRows[validRows.length - 1].balance_after || openingBalance
      : openingBalance

    const netTotal = personSummaries.reduce((sum, p) => sum + p.total, 0)

    return {
      currentBalance,
      transactionCount: validRows.length,
      netChange: currentBalance - openingBalance,
      netTotal
    }
  }, [rowData, personSummaries, openingBalance])

  // ─────────────────────────────────────────────────────────
  // COLUMN DEFINITIONS
  // ─────────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Date',
      field: 'date',
      width: 140,
      editable: true,
      cellEditor: DatePickerEditor,
      cellStyle: { fontWeight: '500', color: '#475569' },
      valueFormatter: (p) => {
        if (!p.value) return ''
        const date = new Date(p.value)
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 160,
      editable: true,
      valueFormatter: (p) => {
        if (p.value == null) return ''
        const num = typeof p.value === 'string' ? parseFloat(p.value) : p.value
        if (isNaN(num)) return ''
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(num)
      },
      cellStyle: (p) => {
        if (!p.value && p.value !== 0) return {}
        const amt = typeof p.value === 'string' ? parseFloat(p.value) : p.value
        return amt < 0
          ? { color: '#ef4444', fontWeight: '700', fontSize: '14px' }
          : { color: '#10b981', fontWeight: '700', fontSize: '14px' }
      }
    },
    {
      headerName: 'Paid To/From',
      field: 'paid_to_from',
      flex: 1,
      minWidth: 200,
      editable: true,
      cellStyle: { fontWeight: '600', color: '#1e293b' }
    },
    {
      headerName: 'Description',
      field: 'narration',
      flex: 2,
      minWidth: 280,
      editable: true,
      cellStyle: { color: '#64748b', fontStyle: 'normal' }
    },
    {
      headerName: 'Balance',
      field: 'balance_after',
      width: 160,
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
        if (!p.value && p.value !== 0) return {}
        return p.value < 0
          ? {
              color: '#ef4444',
              fontWeight: '700',
              backgroundColor: '#fef2f2',
              fontSize: '14px',
              borderRadius: '8px',
              padding: '6px 12px'
            }
          : {
              color: '#10b981',
              fontWeight: '700',
              backgroundColor: '#f0fdf4',
              fontSize: '14px',
              borderRadius: '8px',
              padding: '6px 12px'
            }
      }
    }
  ], [])

  // Debug logging
  useEffect(() => {
    console.log('=== AG GRID DEBUG ===')
    console.log('Loading:', loading)
    console.log('RowData length:', rowData.length)
    console.log('RowData sample:', rowData.slice(0, 2))
    console.log('ColumnDefs length:', columnDefs.length)
  }, [loading, rowData, columnDefs])

  // ─────────────────────────────────────────────────────────
  // CALLBACKS
  // ─────────────────────────────────────────────────────────

  const onGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api
  }

  const onCellValueChanged = (event: CellValueChangedEvent) => {
    const row = event.data as RowData
    row.isDirty = true
    autoSaveRow(row)
  }

  const addTransaction = () => {
    const newRows: RowData[] = []
    for (let i = 0; i < 5; i++) {
      newRows.push({
        id: `new_${Date.now()}_${i}`,
        date: '',
        amount: '',
        paid_to_from: '',
        narration: '',
        isNew: true
      })
    }
    setRowData([...rowData, ...newRows])
  }

  // ─────────────────────────────────────────────────────────
  // RENDER - PREMIUM FINTECH UI
  // ─────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      {/* HEADER CARD - GLASSMORPHISM */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <h1 style={styles.accountTitle}>{accountName}</h1>
          <button
            style={styles.btnAdd}
            onClick={addTransaction}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.3)'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
          >
            + Add 5 Rows
          </button>
        </div>

        {/* STATS GRID */}
        <div style={styles.statsGrid}>
          <div
            style={styles.statBox}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={styles.statLabel}>Opening Balance</div>
            <div style={{...styles.statAmount, color: '#10b981'}}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(openingBalance)}
            </div>
          </div>
          <div
            style={styles.statBox}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={styles.statLabel}>Current Balance</div>
            <div style={{...styles.statAmount, color: stats.currentBalance < 0 ? '#ef4444' : '#10b981'}}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.currentBalance)}
            </div>
          </div>
          <div
            style={styles.statBox}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={styles.statLabel}>Transactions</div>
            <div style={{...styles.statAmount, color: '#6366f1'}}>{stats.transactionCount}</div>
          </div>
          <div
            style={styles.statBox}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={styles.statLabel}>Net Change</div>
            <div style={{...styles.statAmount, color: stats.netChange < 0 ? '#ef4444' : '#10b981'}}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.netChange)}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={styles.mainLayout}>
        {/* GRID SECTION */}
        <div style={styles.gridSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>💳 Transaction History</div>
          </div>
          <div style={styles.gridContainer}>
            {loading ? (
              <div style={styles.loadingState}>Loading transactions...</div>
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <AgGridReact
                  className="ag-theme-alpine premium-grid"
                  theme="legacy"
                  rowData={rowData}
                  columnDefs={columnDefs}
                  onGridReady={onGridReady}
                  onCellValueChanged={onCellValueChanged}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                    suppressMovable: true
                  }}
                  selection={{ mode: 'singleRow' }}
                  animateRows={true}
                  rowHeight={56}
                  headerHeight={48}
                  singleClickEdit={true}
                  stopEditingWhenCellsLoseFocus={true}
                  suppressRowHoverHighlight={false}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  suppressCellFocus={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>📊 By Person</div>
          <div style={styles.sidebarSubtitle}>{personSummaries.length} persons</div>

          <div style={styles.peopleList} className="peopleList">
            {personSummaries.map((summary, idx) => (
              <div
                key={idx}
                style={styles.personItem}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.transform = 'translateX(4px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.transform = 'translateX(0) scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={styles.personTop}>
                  <div style={styles.personName}>{summary.person}</div>
                  <div style={styles.personCount}>{summary.count} txn</div>
                </div>
                <div style={{...styles.personTotal, color: summary.total < 0 ? '#ef4444' : '#10b981'}}>
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0
                  }).format(summary.total)}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.summaryFooter}>
            <div style={styles.footerLabel}>Net Total</div>
            <div style={styles.footerTotal}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.netTotal)}
            </div>
          </div>
        </div>
      </div>

      {saving && <div style={styles.savingIndicator}>💾 Saving...</div>}
    </div>
  )
}

export default ExcelGridView
