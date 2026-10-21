import { format } from 'date-fns'
import { ref } from 'vue'
import {
  deleteTransaction,
  fetchGoalProgress,
  fetchGoals,
  fetchProfile,
  fetchReminders,
  fetchTransactions,
  saveGoal,
  saveGoalProgress,
  saveProfile,
  saveReminder,
  upsertTransaction,
} from '@/lib/api'
import { hasPeriodRolled, textId } from '@/lib/goals'
import {
  fireAtFromDateKey,
  PETROL_REFUEL_REMINDER_ID,
  PETROL_REFUEL_TIME,
} from '@/lib/fuel'
import { clampIntervalDays, clampMonthDay } from '@/lib/schedule'
import type {
  ExpensePrompt,
  Goal,
  GoalPeriod,
  GoalReminderSlot,
  Reminder,
  ReminderKind,
  Transaction,
  UserProfile,
} from '@/lib/types'

const PROMPT_KEY = 'aco-web-expense-prompts'

export const transactions = ref<Transaction[]>([])
export const goals = ref<Goal[]>([])
export const goalProgress = ref<import('@/lib/types').GoalProgressEntry[]>([])
export const reminders = ref<Reminder[]>([])
export const prompts = ref<ExpensePrompt[]>([])
export const profile = ref<UserProfile>({ name: '', currency: 'USD' })
export const financeLoading = ref(false)
export const financeError = ref<string | null>(null)

function todayKey(date = new Date()) {
  return format(date, 'yyyy-MM-dd')
}

function loadPrompts() {
  try {
    const raw = localStorage.getItem(PROMPT_KEY)
    prompts.value = raw ? (JSON.parse(raw) as ExpensePrompt[]) : []
  } catch {
    prompts.value = []
  }
}

function persistPrompts() {
  localStorage.setItem(PROMPT_KEY, JSON.stringify(prompts.value))
}

export async function refreshFinance() {
  financeLoading.value = true
  financeError.value = null
  try {
    const [nextProfile, nextTransactions, nextGoals, nextProgress, nextReminders] = await Promise.all([
      fetchProfile(),
      fetchTransactions(),
      fetchGoals(),
      fetchGoalProgress(),
      fetchReminders(),
    ])
    profile.value = nextProfile
    transactions.value = nextTransactions
    goalProgress.value = nextProgress
    reminders.value = nextReminders.filter((item) => item.isActive)
    const now = new Date()
    const rolled = nextGoals.filter((goal) => goal.isActive && hasPeriodRolled(goal.periodAnchor, goal.period, now))
    for (const goal of rolled) {
      const next = {
        ...goal,
        completedCount: 0,
        periodAnchor: now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await saveGoal(next)
    }
    goals.value = nextGoals
      .map((goal) => rolled.find((item) => item.id === goal.id) ?? goal)
      .map((goal) => {
        const fresh = rolled.find((item) => item.id === goal.id)
        return fresh
          ? { ...goal, completedCount: 0, periodAnchor: now.toISOString(), updatedAt: now.toISOString() }
          : goal
      })
      .filter((goal) => goal.isActive)
    loadPrompts()
  } catch (error) {
    financeError.value = error instanceof Error ? error.message : 'Could not load your data.'
  } finally {
    financeLoading.value = false
  }
}

export async function saveTransactionRecord(input: {
  id?: string
  amount: number
  type: Transaction['type']
  category?: string
  note?: string
  date: string
}) {
  const tx: Transaction = {
    id: input.id ?? crypto.randomUUID(),
    amount: input.amount,
    type: input.type,
    category: input.type === 'expense' ? input.category : undefined,
    note: input.note?.trim() || undefined,
    date: input.date,
  }
  await upsertTransaction(tx)
  const index = transactions.value.findIndex((item) => item.id === tx.id)
  if (index >= 0) transactions.value[index] = tx
  else transactions.value = [tx, ...transactions.value]
}

export async function removeTransactionRecord(id: string) {
  await deleteTransaction(id)
  transactions.value = transactions.value.filter((item) => item.id !== id)
}

export async function saveGoalRecord(input: {
  id?: string
  title: string
  emoji?: string
  targetCount: number
  period: GoalPeriod
  reminderEnabled: boolean
  remindersPerPeriod: number
  reminderTime: string
  reminderSlots?: GoalReminderSlot[]
}) {
  const now = new Date().toISOString()
  const existing = input.id ? goals.value.find((goal) => goal.id === input.id) : undefined
  const goal: Goal = {
    id: existing?.id ?? textId('goal'),
    title: input.title.trim(),
    emoji: input.emoji?.trim() || undefined,
    targetCount: Math.max(1, Math.floor(input.targetCount) || 1),
    completedCount: existing?.completedCount ?? 0,
    period: input.period,
    reminderEnabled: input.reminderEnabled,
    remindersPerPeriod: Math.max(1, Math.floor(input.remindersPerPeriod) || 1),
    reminderTime: input.reminderTime || '09:00',
    reminderSlots: (input.reminderSlots ?? []).filter((slot) => slot.time.trim()),
    periodAnchor: existing?.periodAnchor ?? now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    isActive: true,
  }
  await saveGoal(goal)
  if (existing) goals.value = goals.value.map((item) => (item.id === goal.id ? goal : item))
  else goals.value = [goal, ...goals.value]
}

export async function bumpGoalRecord(goalId: string, delta: number) {
  const goal = goals.value.find((item) => item.id === goalId)
  if (!goal) return
  const now = new Date().toISOString()
  const nextCompleted = Math.max(0, Math.min(goal.targetCount, goal.completedCount + delta))
  const next = { ...goal, completedCount: nextCompleted, updatedAt: now }
  await saveGoal(next)
  goals.value = goals.value.map((item) => (item.id === goalId ? next : item))
  if (delta === 0) return
  const dateKey = todayKey()
  const id = `${goalId}:${dateKey}`
  const current = goalProgress.value.find((entry) => entry.id === id)
  const entry = {
    id,
    goalId,
    dateKey,
    count: Math.max(0, (current?.count ?? 0) + delta),
    updatedAt: now,
  }
  await saveGoalProgress(entry)
  if (current) goalProgress.value = goalProgress.value.map((item) => (item.id === id ? entry : item))
  else goalProgress.value = [...goalProgress.value, entry]
}

export async function archiveGoalRecord(goalId: string) {
  const goal = goals.value.find((item) => item.id === goalId)
  if (!goal) return
  const next = { ...goal, isActive: false, updatedAt: new Date().toISOString() }
  await saveGoal(next)
  goals.value = goals.value.filter((item) => item.id !== goalId)
}

export function goalSummary(goalId: string) {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
  const scoped = goalProgress.value.filter((entry) => entry.goalId === goalId)
  return {
    totalDone: scoped.reduce((sum, entry) => sum + entry.count, 0),
    thisMonthDone: scoped
      .filter((entry) => entry.dateKey.startsWith(monthPrefix))
      .reduce((sum, entry) => sum + entry.count, 0),
  }
}

export async function saveReminderRecord(input: {
  id?: string
  title: string
  note?: string
  kind: ReminderKind
  time: string
  fireAt?: string
  monthDay?: number
  intervalDays?: number
  enabled: boolean
}) {
  const now = new Date().toISOString()
  const existing = input.id ? reminders.value.find((item) => item.id === input.id) : undefined
  const reminder: Reminder = {
    id: input.id || existing?.id || textId('reminder'),
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    kind: input.kind,
    time: input.time || '09:00',
    fireAt: input.kind === 'once' ? input.fireAt : undefined,
    monthDay: input.kind === 'monthly' ? clampMonthDay(input.monthDay) : undefined,
    intervalDays: input.kind === 'interval' ? clampIntervalDays(input.intervalDays) : undefined,
    intervalStartAt: input.kind === 'interval' ? (existing?.intervalStartAt ?? now) : undefined,
    lastCompletedAt: input.kind === 'interval' ? existing?.lastCompletedAt : undefined,
    enabled: input.enabled,
    isActive: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await saveReminder(reminder)
  if (existing) reminders.value = reminders.value.map((item) => (item.id === reminder.id ? reminder : item))
  else reminders.value = [reminder, ...reminders.value]
}

/** Updates the single Refuel reminder to the date chosen on the petrol expense. */
export async function savePetrolRefuelReminder(dateKey: string) {
  const fireAt = fireAtFromDateKey(dateKey, PETROL_REFUEL_TIME)
  if (!fireAt) return
  await saveReminderRecord({
    id: PETROL_REFUEL_REMINDER_ID,
    title: 'Refuel',
    note: 'Next fuel refill',
    kind: 'once',
    time: PETROL_REFUEL_TIME,
    fireAt,
    enabled: true,
  })
}

export async function completeReminderRecord(id: string) {
  const existing = reminders.value.find((item) => item.id === id)
  if (!existing || existing.kind !== 'interval') return
  const now = new Date().toISOString()
  const next = { ...existing, lastCompletedAt: now, intervalStartAt: now, updatedAt: now }
  await saveReminder(next)
  reminders.value = reminders.value.map((item) => (item.id === id ? next : item))
}

export async function archiveReminderRecord(id: string) {
  const existing = reminders.value.find((item) => item.id === id)
  if (!existing) return
  const next = { ...existing, isActive: false, updatedAt: new Date().toISOString() }
  await saveReminder(next)
  reminders.value = reminders.value.filter((item) => item.id !== id)
}

export async function updateProfileRecord(next: UserProfile) {
  await saveProfile(next)
  profile.value = { ...profile.value, ...next, name: next.name.trim() }
}

export function savePromptRecord(input: {
  id?: string
  title: string
  time: string
  category?: string
  enabled: boolean
}) {
  const now = new Date().toISOString()
  const existing = input.id ? prompts.value.find((item) => item.id === input.id) : undefined
  const prompt: ExpensePrompt = {
    id: existing?.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    time: input.time || '12:00',
    category: input.category,
    enabled: input.enabled,
    isActive: true,
    lastHandledOn: existing?.lastHandledOn,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  if (existing) prompts.value = prompts.value.map((item) => (item.id === prompt.id ? prompt : item))
  else prompts.value = [prompt, ...prompts.value]
  persistPrompts()
}

export function archivePromptRecord(id: string) {
  prompts.value = prompts.value.map((item) =>
    item.id === id ? { ...item, isActive: false, updatedAt: new Date().toISOString() } : item,
  )
  persistPrompts()
}
