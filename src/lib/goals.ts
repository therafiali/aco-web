import { endOfDay, endOfMonth, endOfWeek } from 'date-fns'
import type { Goal, GoalPeriod } from '@/lib/types'

export function periodEnd(date: Date, period: GoalPeriod) {
  if (period === 'daily') return endOfDay(date)
  if (period === 'weekly') return endOfWeek(date, { weekStartsOn: 1 })
  return endOfMonth(date)
}

export function hasPeriodRolled(anchorIso: string, period: GoalPeriod, now = new Date()) {
  return now.getTime() > periodEnd(new Date(anchorIso), period).getTime()
}

export function textId(prefix: string) {
  const id = crypto.randomUUID()
  return `${prefix}-${id}`
}
