/**
 * TypeScript types matching backend Pydantic schemas
 */

// User Types
export interface User {
  id: string
  email: string
  created_at: string
  is_system_admin?: boolean
}

export interface UserCreate {
  email: string
  password: string
}

export interface UserLogin {
  email: string
  password: string
}

// Token Types
export interface Token {
  access_token: string
  token_type: string
}

// Account Types
export interface Account {
  id: string
  user_id: string
  name: string
  opening_balance: string
  currency: string
  created_at: string
  updated_at: string
}

export interface AccountCreate {
  name: string
  opening_balance: string
  currency?: string
}

export interface AccountUpdate {
  name?: string
  opening_balance?: string
}

export interface AccountSummary extends Account {
  current_balance: string
  total_income: string
  total_expense: string
  transaction_count: number
  unique_persons: number
}

// Transaction Types
export interface Transaction {
  id: string
  account_id: string
  date: string
  amount: string
  paid_to_from: string
  narration: string | null
  balance_after: string
  created_at: string
  updated_at: string
}

export interface TransactionCreate {
  account_id: string
  date: string
  amount: number
  paid_to_from: string
  narration?: string
}

export interface TransactionUpdate {
  date?: string
  amount?: number
  paid_to_from?: string
  narration?: string
}

export interface TransactionList {
  transactions: Transaction[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Person Summary Types
export interface PersonSummary {
  person: string
  total_amount: string
  transaction_count: number
}

export interface PersonSummaryList {
  summaries: PersonSummary[]
  total_persons: number
}

// Analytics Types
export interface DailySummary {
  date: string
  income: string
  expense: string
  net: string
}

export interface MonthlySummary {
  month: string
  year: number
  income: string
  expense: string
  net: string
}

export interface AnalyticsResponse {
  daily_summaries: DailySummary[]
  top_expenses: PersonSummary[]
  total_income: string
  total_expense: string
  net_total: string
}

// Import/Export Types
export interface ImportPreview {
  account_name: string
  opening_balance: string
  transactions: Omit<Transaction, 'id' | 'account_id' | 'balance_after' | 'created_at' | 'updated_at'>[]
  total_transactions: number
}

export interface ImportResult {
  status: string
  account_id: string
  account_name: string
  transactions_imported: number
}

// Error Types
export interface ErrorResponse {
  detail: string
  error_code?: string
}

export interface ValidationError {
  detail: string
  errors: Array<{
    type: string
    loc: string[]
    msg: string
    input?: string
  }>
}
