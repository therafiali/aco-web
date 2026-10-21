<script setup lang="ts">
import { addMonths, format, isToday, isYesterday, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'
import BalanceCheckDialog from '@/components/BalanceCheckDialog.vue'
import TransactionDialog from '@/components/TransactionDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  isCarrySkipped,
  lastCheckPromptMonth,
  reconciliationFor,
  setLastCheckPromptMonth,
  skipCarry,
} from '@/lib/device-options'
import { financeLoading, profile, removeTransactionRecord, saveTransactionRecord, transactions } from '@/lib/finance'
import { dayKey, formatMoney, inMonth, matchesSearch, resolvePaidWith, summarize } from '@/lib/money'
import type { PaidWith, Transaction } from '@/lib/types'

const current = ref(startOfMonth(new Date()))
const search = ref('')
const paidFilter = ref<'all' | PaidWith>('all')
const fromDate = ref('')
const toDate = ref('')
const dialogOpen = ref(false)
const editing = ref<Transaction | null>(null)
const checkOpen = ref(false)
const checkMonth = ref(startOfMonth(new Date()))
const promptedCheck = ref(false)

const monthRows = computed(() =>
  inMonth(transactions.value, current.value)
    .filter((tx) => {
      if (paidFilter.value !== 'all') {
        if (tx.type !== 'expense' || resolvePaidWith(tx) !== paidFilter.value) return false
      }
      const key = dayKey(tx.date)
      if (fromDate.value && key < fromDate.value) return false
      if (toDate.value && key > toDate.value) return false
      return matchesSearch(tx, search.value)
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
)
const summary = computed(() => summarize(inMonth(transactions.value, current.value)))
const matched = computed(() => reconciliationFor(format(current.value, 'yyyy_MM')))
const filtersOn = computed(
  () => paidFilter.value !== 'all' || !!fromDate.value || !!toDate.value || !!search.value.trim(),
)
const groups = computed(() => {
  const map = new Map<string, Transaction[]>()
  for (const tx of monthRows.value) {
    const key = dayKey(tx.date)
    const list = map.get(key)
    if (list) list.push(tx)
    else map.set(key, [tx])
  }
  return [...map.entries()]
})

const carry = computed(() => {
  const previous = subMonths(current.value, 1)
  const previousSummary = summarize(inMonth(transactions.value, previous))
  const label = format(previous, 'MMMM yyyy')
  const targetKey = format(current.value, 'yyyy_MM')
  const already = inMonth(transactions.value, current.value).some((tx) => tx.note?.startsWith('Balance from '))
  return {
    show: !already && !isCarrySkipped(targetKey) && previousSummary.balance > 0,
    amount: previousSummary.balance,
    label,
    targetKey,
  }
})

const carryNext = computed(() => {
  const next = addMonths(current.value, 1)
  const targetKey = format(next, 'yyyy_MM')
  const already = inMonth(transactions.value, next).some((tx) => tx.note?.startsWith('Balance from '))
  return {
    show: !already && !isCarrySkipped(targetKey) && summary.value.balance > 0,
    amount: summary.value.balance,
    label: format(current.value, 'MMMM yyyy'),
    target: next,
    targetKey,
  }
})

function money(amount: number) {
  return formatMoney(amount, profile.value.currency || 'USD')
}

function dayLabel(key: string) {
  const date = parseISO(key)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, d MMM')
}

const defaultDate = computed(() => {
  const now = new Date()
  if (format(now, 'yyyy-MM') === format(current.value, 'yyyy-MM')) return format(now, 'yyyy-MM-dd')
  return format(current.value, 'yyyy-MM-dd')
})

function openNew() {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(tx: Transaction) {
  editing.value = tx
  dialogOpen.value = true
}

async function remove(tx: Transaction) {
  if (!window.confirm('Delete this transaction?')) return
  try {
    await removeTransactionRecord(tx.id)
    toast.success('Transaction deleted.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not delete it.')
  }
}

async function carryForward(target: Date, sourceLabel: string, amount: number) {
  try {
    await saveTransactionRecord({
      type: 'income',
      amount,
      note: `Balance from ${sourceLabel}`,
      date: startOfMonth(target).toISOString(),
    })
    toast.success('Opening balance added.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not carry the balance.')
  }
}

function clearFilters() {
  paidFilter.value = 'all'
  fromDate.value = ''
  toDate.value = ''
  search.value = ''
}

function openCheck(month: Date) {
  checkMonth.value = startOfMonth(month)
  checkOpen.value = true
}

watch(financeLoading, (loading, wasLoading) => {
  if (loading || !wasLoading || promptedCheck.value) return
  promptedCheck.value = true
  const now = new Date()
  const thisKey = format(now, 'yyyy_MM')
  if (lastCheckPromptMonth() === thisKey) return
  const previous = subMonths(startOfMonth(now), 1)
  if (reconciliationFor(format(previous, 'yyyy_MM'))) return
  if (summarize(inMonth(transactions.value, previous)).totalExpenses <= 0) return
  setLastCheckPromptMonth(thisKey)
  openCheck(previous)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Home</h1>
        <p class="text-sm text-muted-foreground">Income, expenses, and the month balance.</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="current = subMonths(current, 1)">
          <ChevronLeft />
        </Button>
        <p class="min-w-32 text-center text-sm font-medium">{{ format(current, 'MMMM yyyy') }}</p>
        <Button variant="outline" size="icon" @click="current = addMonths(current, 1)">
          <ChevronRight />
        </Button>
        <Button @click="openNew">
          <Plus />
          Add
        </Button>
      </div>
    </div>

    <Card v-if="!profile.name" class="print:hidden">
      <CardContent class="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p class="text-sm">Add your name and currency so amounts match the phone app.</p>
        <Button as-child variant="outline"><RouterLink to="/profile">Open profile</RouterLink></Button>
      </CardContent>
    </Card>

    <div v-if="financeLoading" class="grid gap-3 md:grid-cols-3">
      <Skeleton v-for="item in 3" :key="item" class="h-24" />
    </div>
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Income</CardTitle></CardHeader>
        <CardContent class="text-2xl font-semibold text-emerald-700">{{ money(summary.totalIncome) }}</CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Expenses</CardTitle></CardHeader>
        <CardContent class="text-2xl font-semibold text-destructive">{{ money(summary.totalExpenses) }}</CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Cash</CardTitle></CardHeader>
        <CardContent class="text-2xl font-semibold">{{ money(summary.cashExpenses) }}</CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Online</CardTitle></CardHeader>
        <CardContent class="text-2xl font-semibold">{{ money(summary.onlineExpenses) }}</CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Balance</CardTitle></CardHeader>
        <CardContent class="text-2xl font-semibold" :class="summary.balance < 0 ? 'text-destructive' : ''">{{ money(summary.balance) }}</CardContent>
      </Card>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <p v-if="matched" class="text-sm text-muted-foreground">Matched {{ money(matched.actualBalance) }}</p>
      <Button variant="outline" @click="openCheck(current)">Check balance</Button>
    </div>

    <Card v-if="carry.show">
      <CardContent class="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p class="text-sm">You had {{ money(carry.amount) }} left in {{ carry.label }}. Add it to this month?</p>
        <div class="flex gap-2">
          <Button variant="outline" @click="skipCarry(carry.targetKey)">Start fresh</Button>
          <Button variant="outline" @click="carryForward(current, carry.label, carry.amount)">Carry forward</Button>
        </div>
      </CardContent>
    </Card>

    <Card v-if="carryNext.show">
      <CardContent class="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p class="text-sm">Move {{ money(carryNext.amount) }} to {{ format(carryNext.target, 'MMMM yyyy') }}?</p>
        <div class="flex gap-2">
          <Button variant="outline" @click="skipCarry(carryNext.targetKey)">No thanks</Button>
          <Button variant="outline" @click="carryForward(carryNext.target, carryNext.label, carryNext.amount)">Carry forward</Button>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap items-center gap-2">
      <Button size="sm" :variant="paidFilter === 'all' ? 'default' : 'outline'" @click="paidFilter = 'all'">All</Button>
      <Button size="sm" :variant="paidFilter === 'cash' ? 'default' : 'outline'" @click="paidFilter = 'cash'">Cash</Button>
      <Button size="sm" :variant="paidFilter === 'online' ? 'default' : 'outline'" @click="paidFilter = 'online'">Online</Button>
      <Input v-model="fromDate" class="w-40" type="date" aria-label="From date" />
      <Input v-model="toDate" class="w-40" type="date" aria-label="To date" />
      <Button v-if="filtersOn" size="sm" variant="ghost" @click="clearFilters">Clear</Button>
    </div>

    <Input v-model="search" placeholder="Search notes, categories, amounts, or cash / online" />

    <Card>
      <CardContent class="pt-6">
        <p v-if="!monthRows.length" class="text-sm text-muted-foreground">No transactions for this month.</p>
        <div v-for="[day, items] in groups" :key="day" class="mb-6 last:mb-0">
          <p class="mb-2 text-sm font-medium">{{ dayLabel(day) }}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Details</TableHead>
                <TableHead>Type</TableHead>
                <TableHead class="text-right">Amount</TableHead>
                <TableHead class="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="tx in items" :key="tx.id">
                <TableCell>
                  <p class="font-medium">{{ tx.note || tx.category || 'Untitled' }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ tx.type === 'expense' ? (resolvePaidWith(tx) === 'online' ? 'Online' : 'Cash') : 'Income' }}
                    · {{ tx.category || (tx.type === 'income' ? 'Income' : 'Uncategorized') }}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge :variant="tx.type === 'income' ? 'secondary' : 'outline'">{{ tx.type }}</Badge>
                </TableCell>
                <TableCell class="text-right font-medium" :class="tx.type === 'income' ? 'text-emerald-700' : ''">
                  {{ tx.type === 'income' ? '+' : '-' }}{{ money(tx.amount) }}
                </TableCell>
                <TableCell>
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit transaction" @click="openEdit(tx)"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete transaction" @click="remove(tx)"><Trash2 /></Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <TransactionDialog v-model:open="dialogOpen" :transaction="editing" :default-date="defaultDate" />
    <BalanceCheckDialog v-model:open="checkOpen" :month="checkMonth" />
  </div>
</template>
