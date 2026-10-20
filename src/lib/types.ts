export type Category = string

export type PaidWith = 'cash' | 'online'

export interface Transaction {
  id: string
  amount: number
  date: string
  note?: string
  category?: Category
  type: 'income' | 'expense'
  paidWith?: PaidWith
}

export interface UserProfile {
  name: string
  email?: string
  currency: string
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly'

export interface GoalReminderSlot {
  id: string
  label?: string
  time: string
}

export interface Goal {
  id: string
  title: string
  emoji?: string
  targetCount: number
  completedCount: number
  period: GoalPeriod
  reminderEnabled: boolean
  remindersPerPeriod: number
  reminderTime: string
  reminderSlots?: GoalReminderSlot[]
  periodAnchor: string
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export interface GoalProgressEntry {
  id: string
  goalId: string
  dateKey: string
  count: number
  updatedAt: string
}

export type ReminderKind = 'once' | 'monthly' | 'interval'

export interface Reminder {
  id: string
  title: string
  note?: string
  kind: ReminderKind
  time: string
  fireAt?: string
  monthDay?: number
  intervalDays?: number
  intervalStartAt?: string
  lastCompletedAt?: string
  enabled: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ExpensePrompt {
  id: string
  title: string
  time: string
  category?: string
  enabled: boolean
  isActive: boolean
  lastHandledOn?: string
  createdAt: string
  updatedAt: string
}

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
] as const

export const DEFAULT_CATEGORIES = [
  { id: 'Petrol', label: 'Petrol', color: '#3B82F6' },
  { id: 'Food', label: 'Food', color: '#F59E0B' },
  { id: 'Repair', label: 'Repair', color: '#6366F1' },
  { id: 'Shopping', label: 'Shopping', color: '#EC4899' },
  { id: 'Course', label: 'Course', color: '#8B5CF6' },
  { id: 'Education', label: 'Education', color: '#C14EE4' },
  { id: 'Other', label: 'Other', color: '#6B7280' },
] as const
