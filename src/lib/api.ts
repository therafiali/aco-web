import { supabase } from '@/lib/supabase'
import type {
  Goal,
  GoalPeriod,
  GoalProgressEntry,
  GoalReminderSlot,
  Reminder,
  ReminderKind,
  Transaction,
  UserProfile,
} from '@/lib/types'

type Row = Record<string, unknown>

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getSession()
  fail(error)
  const id = data.session?.user.id
  if (!id) throw new Error('Sign in to continue.')
  return id
}

function asNumber(value: unknown, fallback = 0) {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : fallback
}

function asString(value: unknown, fallback = '') {
  return value == null ? fallback : String(value)
}

function optionalString(value: unknown) {
  if (value == null || value === '') return undefined
  return String(value)
}

let paidWithColumn: boolean | null = null

function missingPaidColumn(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === '42703' || /paid_with/i.test(error.message ?? '')
}

export function transactionFromRow(row: Row): Transaction {
  const type = row.type === 'income' ? 'income' : 'expense'
  const paidRaw = row.paid_with ?? row.paidWith
  return {
    id: asString(row.id),
    amount: asNumber(row.amount),
    type,
    category: optionalString(row.category),
    note: optionalString(row.note),
    date: asString(row.date),
    paidWith: paidRaw === 'online' || paidRaw === 'cash' ? paidRaw : undefined,
  }
}

export function goalFromRow(row: Row): Goal {
  const periodRaw = asString(row.period, 'daily')
  const period: GoalPeriod =
    periodRaw === 'weekly' || periodRaw === 'monthly' ? periodRaw : 'daily'
  const slots = Array.isArray(row.reminder_slots) ? (row.reminder_slots as GoalReminderSlot[]) : []
  return {
    id: asString(row.id),
    title: asString(row.title),
    emoji: optionalString(row.emoji),
    targetCount: asNumber(row.target_count, 1),
    completedCount: asNumber(row.completed_count),
    period,
    reminderEnabled: Boolean(row.reminder_enabled),
    remindersPerPeriod: asNumber(row.reminders_per_period, 1),
    reminderTime: asString(row.reminder_time, '09:00'),
    reminderSlots: slots,
    periodAnchor: asString(row.period_anchor, new Date().toISOString()),
    createdAt: asString(row.created_at, new Date().toISOString()),
    updatedAt: asString(row.updated_at, new Date().toISOString()),
    isActive: Boolean(row.is_active),
  }
}

export function progressFromRow(row: Row): GoalProgressEntry {
  return {
    id: asString(row.id),
    goalId: asString(row.goal_id),
    dateKey: asString(row.date_key),
    count: asNumber(row.count),
    updatedAt: asString(row.updated_at, new Date().toISOString()),
  }
}

export function reminderFromRow(row: Row): Reminder {
  const kindRaw = asString(row.kind, 'once')
  const kind: ReminderKind = kindRaw === 'monthly' || kindRaw === 'interval' ? kindRaw : 'once'
  return {
    id: asString(row.id),
    title: asString(row.title),
    note: optionalString(row.note),
    kind,
    time: asString(row.reminder_time, '09:00'),
    fireAt: optionalString(row.fire_at),
    monthDay: row.month_day == null ? undefined : asNumber(row.month_day),
    intervalDays: row.interval_days == null ? undefined : asNumber(row.interval_days),
    intervalStartAt: optionalString(row.interval_start_at),
    lastCompletedAt: optionalString(row.last_completed_at),
    enabled: Boolean(row.enabled),
    isActive: Boolean(row.is_active),
    createdAt: asString(row.created_at, new Date().toISOString()),
    updatedAt: asString(row.updated_at, new Date().toISOString()),
  }
}

export function goalToRow(userId: string, goal: Goal) {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    emoji: goal.emoji ?? null,
    target_count: goal.targetCount,
    completed_count: goal.completedCount,
    period: goal.period,
    reminder_enabled: goal.reminderEnabled,
    reminders_per_period: goal.remindersPerPeriod,
    reminder_time: goal.reminderTime,
    reminder_slots: goal.reminderSlots ?? [],
    period_anchor: goal.periodAnchor,
    is_active: goal.isActive,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
  }
}

export function reminderToRow(userId: string, reminder: Reminder) {
  return {
    id: reminder.id,
    user_id: userId,
    title: reminder.title,
    note: reminder.note ?? null,
    kind: reminder.kind,
    reminder_time: reminder.time,
    fire_at: reminder.fireAt ?? null,
    month_day: reminder.monthDay ?? null,
    interval_days: reminder.intervalDays ?? null,
    interval_start_at: reminder.intervalStartAt ?? null,
    last_completed_at: reminder.lastCompletedAt ?? null,
    enabled: reminder.enabled,
    is_active: reminder.isActive,
    created_at: reminder.createdAt,
    updated_at: reminder.updatedAt,
  }
}

export async function fetchProfile(): Promise<UserProfile> {
  const userId = await requireUserId()
  const { data: userData } = await supabase.auth.getUser()
  const email = userData.user?.email
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, currency')
    .eq('id', userId)
    .maybeSingle()
  fail(error)
  return {
    name: asString(data?.full_name),
    email,
    currency: asString(data?.currency, 'USD') || 'USD',
  }
}

export async function saveProfile(profile: UserProfile) {
  const userId = await requireUserId()
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: profile.name.trim(),
    currency: profile.currency || 'USD',
    updated_at: new Date().toISOString(),
  })
  fail(error)
}

const TX_COLUMNS = 'id, amount, type, category, note, date'
const TX_COLUMNS_WITH_PAID = `${TX_COLUMNS}, paid_with`

function transactionQuery(userId: string, columns: string) {
  return supabase
    .from('transactions')
    .select(columns as 'id, amount, type, category, note, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
}

export async function fetchTransactions() {
  const userId = await requireUserId()
  const columns: string = paidWithColumn === false ? TX_COLUMNS : TX_COLUMNS_WITH_PAID
  const first = await transactionQuery(userId, columns)
  if (first.error && paidWithColumn !== false && missingPaidColumn(first.error)) {
    paidWithColumn = false
    const second = await transactionQuery(userId, TX_COLUMNS)
    fail(second.error)
    return (second.data ?? []).map((row) => transactionFromRow(row as unknown as Row))
  }
  fail(first.error)
  paidWithColumn = true
  return (first.data ?? []).map((row) => transactionFromRow(row as unknown as Row))
}

function transactionRow(userId: string, tx: Transaction, includePaid: boolean) {
  const row: Record<string, unknown> = {
    id: tx.id,
    user_id: userId,
    amount: tx.amount,
    type: tx.type,
    category: tx.category ?? null,
    note: tx.note ?? null,
    date: tx.date,
    updated_at: new Date().toISOString(),
  }
  if (includePaid) {
    row.paid_with = tx.type === 'expense' ? (tx.paidWith === 'online' ? 'online' : 'cash') : null
  }
  return row
}

export async function upsertTransaction(tx: Transaction) {
  const userId = await requireUserId()
  if (paidWithColumn === false) {
    const { error } = await supabase
      .from('transactions')
      .upsert(transactionRow(userId, tx, false), { onConflict: 'id' })
    fail(error)
    return
  }
  const { error } = await supabase
    .from('transactions')
    .upsert(transactionRow(userId, tx, true), { onConflict: 'id' })
  if (error && missingPaidColumn(error)) {
    paidWithColumn = false
    const retry = await supabase
      .from('transactions')
      .upsert(transactionRow(userId, tx, false), { onConflict: 'id' })
    fail(retry.error)
    return
  }
  fail(error)
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId()
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
  fail(error)
}

export async function fetchGoals() {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  fail(error)
  return (data ?? []).map((row) => goalFromRow(row))
}

export async function saveGoal(goal: Goal) {
  const userId = await requireUserId()
  const { error } = await supabase.from('goals').upsert(goalToRow(userId, goal), { onConflict: 'id' })
  fail(error)
}

export async function fetchGoalProgress() {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('goal_progress')
    .select('*')
    .eq('user_id', userId)
  fail(error)
  return (data ?? []).map((row) => progressFromRow(row))
}

export async function saveGoalProgress(entry: GoalProgressEntry) {
  const userId = await requireUserId()
  const { error } = await supabase.from('goal_progress').upsert(
    {
      id: entry.id,
      user_id: userId,
      goal_id: entry.goalId,
      date_key: entry.dateKey,
      count: entry.count,
      updated_at: entry.updatedAt,
    },
    { onConflict: 'id' },
  )
  fail(error)
}

export async function fetchReminders() {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  fail(error)
  return (data ?? []).map((row) => reminderFromRow(row))
}

export async function saveReminder(reminder: Reminder) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('reminders')
    .upsert(reminderToRow(userId, reminder), { onConflict: 'id' })
  fail(error)
}
