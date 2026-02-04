/**
 * Utility Functions for Formatting and Validation
 * Centralized functions for data formatting, validation, and transformation
 */

/**
 * Format date for API calls (YYYY-MM-DD)
 * @param dateStr - Date string from input or Date object
 * @returns Formatted date string in YYYY-MM-DD format or undefined
 */
export const formatDateForAPI = (dateStr: string | Date | null | undefined): string | undefined => {
  if (!dateStr) return undefined

  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr

    // Check if date is valid
    if (isNaN(date.getTime())) return undefined

    // Format as YYYY-MM-DD
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  } catch (error) {
    console.error('Error formatting date:', error)
    return undefined
  }
}

/**
 * Format date for display (localized)
 * @param dateString - ISO date string
 * @param locale - Locale string (default: 'en-IN')
 * @returns Formatted date string
 */
export const formatDateForDisplay = (
  dateString: string,
  locale: string = 'en-IN'
): string => {
  try {
    return new Date(dateString).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch (error) {
    return dateString
  }
}

/**
 * Format currency amount
 * @param amount - Amount as string or number
 * @param currency - Currency code (default: 'INR')
 * @param locale - Locale string (default: 'en-IN')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: string | number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return '₹0.00'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Get color class based on amount
 * @param amount - Amount as string or number
 * @returns CSS class name for text color
 */
export const getAmountColorClass = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return 'text-muted'

  return num < 0 ? 'text-danger' : num > 0 ? 'text-success' : 'text-muted'
}

/**
 * Get badge color based on amount
 * @param amount - Amount as string or number
 * @returns CoreUI badge color name
 */
export const getAmountBadgeColor = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return 'secondary'

  return num < 0 ? 'danger' : num > 0 ? 'success' : 'secondary'
}

/**
 * Validate file size
 * @param file - File object
 * @param maxSizeInMB - Maximum size in megabytes (default: 10)
 * @returns Object with isValid boolean and error message
 */
export const validateFileSize = (
  file: File,
  maxSizeInMB: number = 10
): { isValid: boolean; error?: string } => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024

  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${maxSizeInMB} MB. Your file is ${(
        file.size /
        1024 /
        1024
      ).toFixed(2)} MB.`,
    }
  }

  return { isValid: true }
}

/**
 * Validate Excel file extension
 * @param filename - File name
 * @returns Object with isValid boolean and error message
 */
export const validateExcelFile = (
  filename: string
): { isValid: boolean; error?: string } => {
  const validExtensions = ['.xlsx', '.xls']
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))

  if (!validExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `Invalid file format. Please upload an Excel file (.xlsx or .xls). You uploaded: ${extension}`,
    }
  }

  return { isValid: true }
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Parse and validate decimal amount
 * @param value - Value to parse
 * @returns Parsed decimal as string or null if invalid
 */
export const parseDecimalAmount = (value: string | number): string | null => {
  if (typeof value === 'number') return value.toFixed(2)

  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = parseFloat(trimmed)
  if (isNaN(parsed)) return null

  return parsed.toFixed(2)
}

/**
 * Get file size display string
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export const getFileSizeDisplay = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Sanitize filename for download
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 255) // Limit length
}

/**
 * Check if date is valid
 * @param dateString - Date string to validate
 * @returns True if valid, false otherwise
 */
export const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false

  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export const getRelativeTimeString = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

    return formatDateForDisplay(dateString)
  } catch (error) {
    return dateString
  }
}

/**
 * Convert object to query string
 * @param params - Object with query parameters
 * @returns Query string
 */
export const objectToQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * Debounce function
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}
