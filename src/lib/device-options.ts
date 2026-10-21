import { ref } from 'vue'
import type { PaidWith, Transaction } from '@/lib/types'

const CATEGORY_KEY = 'aco-web-categories'
const PAID_KEY = 'aco-web-paid-with'
const RECONCILE_KEY = 'aco-web-reconciliation'
const CARRY_SKIP_KEY = 'aco-web-carry-skip'
const CHECK_PROMPT_KEY = 'aco-web-check-prompt'

export interface MonthReconciliation {
  monthKey: string
  appBalance: number
  actualBalance: number
  difference: number
  reconciledAt: string
  adjustmentCreated: boolean
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const customCategories = ref<string[]>(readJson<string[]>(CATEGORY_KEY, []))

export function rememberCategory(name: string) {
  const clean = name.trim()
  if (!clean) return
  const exists = customCategories.value.some((item) => item.toLowerCase() === clean.toLowerCase())
  if (exists) return
  customCategories.value = [...customCategories.value, clean]
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(customCategories.value))
}

function paidMap() {
  return readJson<Record<string, PaidWith>>(PAID_KEY, {})
}

function writePaidMap(map: Record<string, PaidWith>) {
  localStorage.setItem(PAID_KEY, JSON.stringify(map))
}

export function rememberPaidWith(id: string, paidWith?: PaidWith) {
  const map = paidMap()
  if (paidWith === 'cash' || paidWith === 'online') map[id] = paidWith
  else delete map[id]
  writePaidMap(map)
}

export function forgetPaidWith(id: string) {
  const map = paidMap()
  delete map[id]
  writePaidMap(map)
}

/** Fills cash or online from this browser when the shared row does not have it yet. */
export function applyPaidWithOverlay(rows: Transaction[]) {
  const map = paidMap()
  let changed = false
  const next = rows.map((tx) => {
    if (tx.type !== 'expense') return tx
    if (tx.paidWith === 'cash' || tx.paidWith === 'online') {
      if (map[tx.id] !== tx.paidWith) {
        map[tx.id] = tx.paidWith
        changed = true
      }
      return tx
    }
    const saved = map[tx.id]
    if (saved === 'cash' || saved === 'online') return { ...tx, paidWith: saved }
    return tx
  })
  if (changed) writePaidMap(map)
  return next
}

export const reconciliations = ref<Record<string, MonthReconciliation>>(
  readJson<Record<string, MonthReconciliation>>(RECONCILE_KEY, {}),
)

export function reconciliationFor(monthKey: string) {
  return reconciliations.value[monthKey] ?? null
}

export function saveReconciliation(rec: MonthReconciliation) {
  reconciliations.value = { ...reconciliations.value, [rec.monthKey]: rec }
  localStorage.setItem(RECONCILE_KEY, JSON.stringify(reconciliations.value))
}

export const carrySkips = ref<string[]>(readJson<string[]>(CARRY_SKIP_KEY, []))

export function isCarrySkipped(monthKey: string) {
  return carrySkips.value.includes(monthKey)
}

export function skipCarry(monthKey: string) {
  if (carrySkips.value.includes(monthKey)) return
  carrySkips.value = [...carrySkips.value, monthKey]
  localStorage.setItem(CARRY_SKIP_KEY, JSON.stringify(carrySkips.value))
}

export function lastCheckPromptMonth() {
  return localStorage.getItem(CHECK_PROMPT_KEY)
}

export function setLastCheckPromptMonth(monthKey: string) {
  localStorage.setItem(CHECK_PROMPT_KEY, monthKey)
}
