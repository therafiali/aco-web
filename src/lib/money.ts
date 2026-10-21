import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { CURRENCIES, DEFAULT_CATEGORIES, type PaidWith, type Transaction } from '@/lib/types'

export const CATEGORY_ALIASES: Record<string, string> = {
  Dept: 'Debt',
}

export const FOOD_SNACKING_CATEGORIES = ['Food', 'Craving'] as const
export const VEHICLE_CATEGORIES = ['Petrol', 'Repair'] as const

export type TypeFilter = 'all' | 'income' | 'expense'
export type NoteFilter = 'all' | 'hasNote' | 'missingNote'
export type DatePreset = 'thisMonth' | 'lastMonth' | 'custom'

export interface AnalyticsFilters {
  categories: string[]
  type: TypeFilter
  amountMin?: number
  amountMax?: number
  search: string
  noteFilter: NoteFilter
}

export function currencySymbol(code: string) {
  return CURRENCIES.find((item) => item.code === code)?.symbol ?? ''
}

export function formatMoney(amount: number, code: string) {
  const symbol = currencySymbol(code)
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol}${formatted}`
}

export function normalizeCategory(category?: string) {
  if (!category?.trim()) return 'Uncategorized'
  return CATEGORY_ALIASES[category.trim()] ?? category.trim()
}

export function categoryColor(category?: string) {
  const name = normalizeCategory(category)
  return DEFAULT_CATEGORIES.find((item) => item.label === name)?.color ?? '#6B7280'
}

/** Older expenses with no payment method count as cash, same as the phone app. */
export function resolvePaidWith(tx: Pick<Transaction, 'type' | 'paidWith'>): PaidWith {
  if (tx.type !== 'expense') return 'cash'
  return tx.paidWith === 'online' ? 'online' : 'cash'
}

export function summarize(transactions: Transaction[]) {
  let totalIncome = 0
  let cashExpenses = 0
  let onlineExpenses = 0
  for (const tx of transactions) {
    if (tx.type === 'income') totalIncome += tx.amount
    else if (resolvePaidWith(tx) === 'online') onlineExpenses += tx.amount
    else cashExpenses += tx.amount
  }
  const totalExpenses = cashExpenses + onlineExpenses
  return {
    totalIncome,
    totalExpenses,
    cashExpenses,
    onlineExpenses,
    balance: totalIncome - cashExpenses,
    count: transactions.length,
  }
}

export function inMonth(transactions: Transaction[], month: Date) {
  const start = startOfMonth(month).getTime()
  const end = endOfMonth(month).getTime()
  return transactions.filter((tx) => {
    const time = new Date(tx.date).getTime()
    return time >= start && time <= end
  })
}

export function matchesSearch(tx: Transaction, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const paid = tx.type === 'expense' ? resolvePaidWith(tx) : ''
  const hay = [tx.note, tx.category, normalizeCategory(tx.category), tx.type, tx.amount.toString(), paid]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export interface NoteSuggestion {
  note: string
  amount: number
  category?: string
}

export function recentNoteSuggestions(
  rows: Transaction[],
  type: Transaction['type'],
  category: string,
  query: string,
): NoteSuggestion[] {
  const q = query.trim().toLowerCase()
  const tokens = q.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const matches: NoteSuggestion[] = []
  for (const tx of rows) {
    if (tx.type !== type) continue
    if (type === 'expense') {
      if (!category) return []
      if (normalizeCategory(tx.category) !== normalizeCategory(category)) continue
    }
    const note = tx.note?.trim()
    if (!note || note.length < 2) continue
    const key = `${note.toLowerCase()}|${normalizeCategory(tx.category)}`
    if (seen.has(key)) continue
    if (q) {
      if (note.toLowerCase() === q) continue
      if (!tokens.every((token) => note.toLowerCase().includes(token))) continue
    }
    seen.add(key)
    matches.push({ note, amount: tx.amount, category: tx.category })
    if (matches.length >= 5) break
  }
  return matches
}

export function noteBreakdown(expenses: Transaction[]) {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const tx of expenses) {
    const note = tx.note?.trim()
    if (!note) continue
    const prev = totals.get(note) ?? { amount: 0, count: 0 }
    totals.set(note, { amount: prev.amount + tx.amount, count: prev.count + 1 })
  }
  const rows = [...totals.entries()]
    .map(([note, stats]) => ({ note, amount: stats.amount, count: stats.count }))
    .sort((a, b) => b.amount - a.amount)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return rows.slice(0, 8).map((row) => ({
    ...row,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
  }))
}

export function applyAnalyticsFilters(transactions: Transaction[], filters: AnalyticsFilters) {
  return transactions.filter((tx) => {
    if (filters.type !== 'all' && tx.type !== filters.type) return false
    if (filters.categories.length > 0) {
      if (tx.type === 'income') return false
      const selected = filters.categories.map(normalizeCategory)
      if (!selected.includes(normalizeCategory(tx.category))) return false
    }
    if (filters.amountMin != null && tx.amount < filters.amountMin) return false
    if (filters.amountMax != null && tx.amount > filters.amountMax) return false
    const hasNote = !!tx.note?.trim()
    if (filters.noteFilter === 'hasNote' && !hasNote) return false
    if (filters.noteFilter === 'missingNote' && hasNote) return false
    return matchesSearch(tx, filters.search)
  })
}

export function collectCategories(transactions: Transaction[]) {
  const set = new Set<string>(DEFAULT_CATEGORIES.map((item) => item.label))
  for (const tx of transactions) {
    if (tx.type === 'expense') set.add(normalizeCategory(tx.category))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function inferIncomeSource(note?: string) {
  const n = (note ?? '').trim().toLowerCase()
  if (!n) return 'Untagged'
  if (n.includes('salary')) return 'Salary'
  if (n.includes('uzma')) return 'Personal transfer'
  if (n.includes('transfer') || n.includes('raqami') || n.includes('online transfer')) return 'Transfer'
  if (n.includes('cash')) return 'Cash'
  if (n.includes('online')) return 'Online'
  return 'Other'
}

export interface BreakdownItem {
  label: string
  amount: number
  percentage: number
  count: number
  color: string
}

export function categoryBreakdown(expenses: Transaction[]): BreakdownItem[] {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const tx of expenses) {
    const label = normalizeCategory(tx.category)
    const prev = totals.get(label) ?? { amount: 0, count: 0 }
    totals.set(label, { amount: prev.amount + tx.amount, count: prev.count + 1 })
  }
  const rows = [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount)
  const total = rows.reduce((sum, row) => sum + row[1].amount, 0)
  return rows.map(([label, stats]) => ({
    label,
    amount: stats.amount,
    count: stats.count,
    percentage: total > 0 ? (stats.amount / total) * 100 : 0,
    color: categoryColor(label),
  }))
}

export function incomeBreakdown(income: Transaction[]): BreakdownItem[] {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const tx of income) {
    const label = inferIncomeSource(tx.note)
    const prev = totals.get(label) ?? { amount: 0, count: 0 }
    totals.set(label, { amount: prev.amount + tx.amount, count: prev.count + 1 })
  }
  const rows = [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount)
  const total = rows.reduce((sum, row) => sum + row[1].amount, 0)
  const colors = ['#2A6174', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#6B7280']
  return rows.map(([label, stats], index) => ({
    label,
    amount: stats.amount,
    count: stats.count,
    percentage: total > 0 ? (stats.amount / total) * 100 : 0,
    color: colors[index % colors.length] ?? '#6B7280',
  }))
}

export function monthlyTrend(transactions: Transaction[], end: Date, count = 6) {
  const endMonth = startOfMonth(end)
  return Array.from({ length: count }, (_, index) => {
    const month = subMonths(endMonth, count - 1 - index)
    const rows = inMonth(transactions, month)
    const summary = summarize(rows)
    return {
      label: format(month, 'MMM yy'),
      ...summary,
    }
  })
}

export function sumByCategories(expenses: Transaction[], categories: readonly string[]) {
  const selected = new Set(categories.map((item) => normalizeCategory(item)))
  return expenses
    .filter((tx) => selected.has(normalizeCategory(tx.category)))
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function countMissingDetails(transactions: Transaction[]) {
  let missingNote = 0
  let uncategorizedExpense = 0
  for (const tx of transactions) {
    if (!tx.note?.trim()) missingNote += 1
    if (tx.type === 'expense' && !tx.category?.trim()) uncategorizedExpense += 1
  }
  return { missingNote, uncategorizedExpense }
}

export function dayKey(iso: string) {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

export function rangeForPreset(preset: DatePreset, customFrom?: string, customTo?: string) {
  const now = new Date()
  if (preset === 'thisMonth') return { from: startOfMonth(now), to: endOfMonth(now) }
  if (preset === 'lastMonth') {
    const last = subMonths(now, 1)
    return { from: startOfMonth(last), to: endOfMonth(last) }
  }
  const from = customFrom ? parseISO(customFrom) : startOfMonth(now)
  const to = customTo ? parseISO(customTo) : endOfMonth(now)
  return from <= to ? { from, to } : { from: to, to: from }
}
