import {
  addDays,
  addMonths,
  format,
  isValid,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
} from 'date-fns'
import type { Reminder, ReminderKind } from '@/lib/types'

export function parseReminderTime(value: string) {
  const parts = value.split(':')
  const hourPart = Number(parts[0])
  const minutePart = Number(parts[1])
  const hour = Number.isFinite(hourPart) ? Math.min(23, Math.max(0, hourPart)) : 9
  const minute = Number.isFinite(minutePart) ? Math.min(59, Math.max(0, minutePart)) : 0
  return { hour, minute }
}

export function applyTime(date: Date, time: string) {
  const { hour, minute } = parseReminderTime(time)
  let next = setHours(date, hour)
  next = setMinutes(next, minute)
  next = setSeconds(next, 0)
  next = setMilliseconds(next, 0)
  return next
}

function safeDate(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  return isValid(parsed) ? parsed : null
}

export function clampMonthDay(day?: number) {
  if (!Number.isFinite(day)) return 1
  return Math.min(31, Math.max(1, Math.floor(day as number)))
}

export function clampIntervalDays(days?: number) {
  if (!Number.isFinite(days)) return 1
  return Math.min(365, Math.max(1, Math.floor(days as number)))
}

function intervalAnchor(reminder: Reminder) {
  return (
    safeDate(reminder.lastCompletedAt) ??
    safeDate(reminder.intervalStartAt) ??
    safeDate(reminder.createdAt) ??
    new Date()
  )
}

export function getReminderDueAt(reminder: Reminder, now = new Date()): Date | null {
  if (reminder.kind === 'once') return safeDate(reminder.fireAt)

  if (reminder.kind === 'monthly') {
    const day = clampMonthDay(reminder.monthDay)
    const withTime = (base: Date) =>
      applyTime(new Date(base.getFullYear(), base.getMonth(), day), reminder.time)
    let candidate = withTime(now)
    if (candidate.getDate() !== day) candidate = withTime(addMonths(now, 1))
    if (candidate.getTime() <= now.getTime()) {
      candidate = withTime(addMonths(now, 1))
      if (candidate.getDate() !== day) candidate = withTime(addMonths(now, 2))
    }
    return candidate
  }

  const days = clampIntervalDays(reminder.intervalDays)
  return applyTime(addDays(intervalAnchor(reminder), days), reminder.time)
}

export function isReminderOverdue(reminder: Reminder, now = new Date()) {
  if (reminder.kind === 'monthly') return false
  const due = getReminderDueAt(reminder, now)
  if (!due) return false
  return due.getTime() <= now.getTime()
}

export function reminderKindLabel(kind: ReminderKind) {
  if (kind === 'once') return 'One time'
  if (kind === 'monthly') return 'Every month'
  return 'Every few days'
}

export function formatReminderTime(time: string) {
  return format(applyTime(new Date(), time), 'h:mm a')
}

export function ordinalDay(day: number) {
  const n = clampMonthDay(day)
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  if (n % 10 === 1) return `${n}st`
  if (n % 10 === 2) return `${n}nd`
  if (n % 10 === 3) return `${n}rd`
  return `${n}th`
}

export function formatReminderSchedule(reminder: Reminder, now = new Date()) {
  const due = getReminderDueAt(reminder, now)
  const timeLabel = formatReminderTime(reminder.time)
  if (reminder.kind === 'once') {
    if (!due) return 'No date set'
    return format(due, "EEE, d MMM yyyy 'at' h:mm a")
  }
  if (reminder.kind === 'monthly') {
    return `Every month on the ${ordinalDay(reminder.monthDay ?? 1)} at ${timeLabel}`
  }
  const days = reminder.intervalDays ?? 1
  const every = `Every ${days} day${days === 1 ? '' : 's'}`
  if (due && due.getTime() <= now.getTime()) return `${every}. Overdue since ${format(due, 'd MMM')}`
  return `${every}. Next ${due ? format(due, 'd MMM') : ''} at ${timeLabel}`
}

export function sortReminders(reminders: Reminder[]) {
  return [...reminders].sort((a, b) => {
    const aOverdue = isReminderOverdue(a) ? 0 : 1
    const bOverdue = isReminderOverdue(b) ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    const aDue = getReminderDueAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const bDue = getReminderDueAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return aDue - bDue
  })
}
