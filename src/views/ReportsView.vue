<script setup lang="ts">
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Printer } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { goalProgress, goals, profile, transactions } from '@/lib/finance'
import { formatMoney, inMonth, summarize } from '@/lib/money'

const current = ref(startOfMonth(new Date()))
const rows = computed(() =>
  inMonth(transactions.value, current.value).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
)
const summary = computed(() => summarize(rows.value))
const monthPrefix = computed(() => format(current.value, 'yyyy-MM'))
const goalRows = computed(() =>
  goals.value.map((goal) => {
    const done = goalProgress.value
      .filter((entry) => entry.goalId === goal.id && entry.dateKey.startsWith(monthPrefix.value))
      .reduce((sum, entry) => sum + entry.count, 0)
    return {
      ...goal,
      done,
      percent: goal.targetCount > 0 ? Math.min(100, Math.round((done / goal.targetCount) * 100)) : 0,
    }
  }),
)

function money(amount: number) {
  return formatMoney(amount, profile.value.currency || 'USD')
}

function printReport() {
  window.print()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Reports</h1>
        <p class="text-sm text-muted-foreground">Monthly statement for {{ profile.name || 'your account' }}.</p>
      </div>
      <div class="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="icon" @click="current = subMonths(current, 1)"><ChevronLeft /></Button>
        <p class="min-w-32 text-center text-sm font-medium">{{ format(current, 'MMMM yyyy') }}</p>
        <Button variant="outline" size="icon" @click="current = addMonths(current, 1)"><ChevronRight /></Button>
        <Button variant="outline" @click="printReport"><Printer /> Print</Button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Income</CardTitle></CardHeader><CardContent class="text-2xl font-semibold">{{ money(summary.totalIncome) }}</CardContent></Card>
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Expenses</CardTitle></CardHeader><CardContent class="text-2xl font-semibold">{{ money(summary.totalExpenses) }}</CardContent></Card>
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Balance</CardTitle></CardHeader><CardContent class="text-2xl font-semibold">{{ money(summary.balance) }}</CardContent></Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Goals this month</CardTitle></CardHeader>
      <CardContent>
        <p v-if="!goalRows.length" class="text-sm text-muted-foreground">No active goals.</p>
        <div v-else class="grid gap-3 md:grid-cols-2">
          <div v-for="goal in goalRows" :key="goal.id" class="rounded-lg border p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="font-medium">{{ goal.emoji }} {{ goal.title }}</p>
              <Badge variant="secondary">{{ goal.percent }}%</Badge>
            </div>
            <p class="text-sm text-muted-foreground">{{ goal.done }} logged this month · target {{ goal.targetCount }} per {{ goal.period }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
      <CardContent>
        <p v-if="!rows.length" class="text-sm text-muted-foreground">Nothing recorded this month.</p>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Type</TableHead>
              <TableHead class="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="tx in rows" :key="tx.id">
              <TableCell>{{ format(new Date(tx.date), 'd MMM') }}</TableCell>
              <TableCell>
                <p>{{ tx.note || tx.category || 'Untitled' }}</p>
                <p class="text-xs text-muted-foreground">{{ tx.category }}</p>
              </TableCell>
              <TableCell class="capitalize">{{ tx.type }}</TableCell>
              <TableCell class="text-right">{{ tx.type === 'income' ? '+' : '-' }}{{ money(tx.amount) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
