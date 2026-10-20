<script setup lang="ts">
import { format } from 'date-fns'
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { profile, transactions } from '@/lib/finance'
import {
  applyAnalyticsFilters,
  categoryBreakdown,
  collectCategories,
  countMissingDetails,
  FOOD_SNACKING_CATEGORIES,
  formatMoney,
  incomeBreakdown,
  monthlyTrend,
  rangeForPreset,
  sumByCategories,
  VEHICLE_CATEGORIES,
  type DatePreset,
  type NoteFilter,
  type TypeFilter,
} from '@/lib/money'

const preset = ref<DatePreset>('thisMonth')
const customFrom = ref('')
const customTo = ref('')
const type = ref<TypeFilter>('all')
const noteFilter = ref<NoteFilter>('all')
const search = ref('')
const selectedCategories = ref<string[]>([])

const range = computed(() => rangeForPreset(preset.value, customFrom.value, customTo.value))
const ranged = computed(() =>
  transactions.value.filter((tx) => {
    const time = new Date(tx.date).getTime()
    return time >= range.value.from.getTime() && time <= range.value.to.getTime()
  }),
)
const filtered = computed(() =>
  applyAnalyticsFilters(ranged.value, {
    categories: selectedCategories.value,
    type: type.value,
    search: search.value,
    noteFilter: noteFilter.value,
  }),
)
const expenses = computed(() => filtered.value.filter((tx) => tx.type === 'expense'))
const income = computed(() => filtered.value.filter((tx) => tx.type === 'income'))
const categories = computed(() => collectCategories(transactions.value))
const breakdown = computed(() => categoryBreakdown(expenses.value))
const sources = computed(() => incomeBreakdown(income.value))
const trend = computed(() => monthlyTrend(transactions.value, new Date(), 6))
const missing = computed(() => countMissingDetails(filtered.value))
const maxTrend = computed(() => Math.max(1, ...trend.value.map((point) => Math.max(point.totalIncome, point.totalExpenses))))

function money(amount: number) {
  return formatMoney(amount, profile.value.currency || 'USD')
}

function toggleCategory(name: string) {
  selectedCategories.value = selectedCategories.value.includes(name)
    ? selectedCategories.value.filter((item) => item !== name)
    : [...selectedCategories.value, name]
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Charts</h1>
      <p class="text-sm text-muted-foreground">
        {{ format(range.from, 'd MMM') }} to {{ format(range.to, 'd MMM yyyy') }}
      </p>
    </div>

    <div class="grid gap-3 md:grid-cols-4">
      <Select v-model="preset">
        <SelectTrigger class="w-full"><SelectValue placeholder="Range" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="thisMonth">This month</SelectItem>
          <SelectItem value="lastMonth">Last month</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="type">
        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="expense">Expenses</SelectItem>
          <SelectItem value="income">Income</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="noteFilter">
        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any note</SelectItem>
          <SelectItem value="hasNote">Has a note</SelectItem>
          <SelectItem value="missingNote">Missing note</SelectItem>
        </SelectContent>
      </Select>
      <Input v-model="search" placeholder="Search" />
    </div>
    <div v-if="preset === 'custom'" class="grid gap-3 md:grid-cols-2">
      <Input v-model="customFrom" type="date" />
      <Input v-model="customTo" type="date" />
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="name in categories" :key="name" type="button" @click="toggleCategory(name)">
        <Badge :variant="selectedCategories.includes(name) ? 'default' : 'outline'">{{ name }}</Badge>
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-4">
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Income</CardTitle></CardHeader><CardContent class="text-xl font-semibold">{{ money(income.reduce((sum, tx) => sum + tx.amount, 0)) }}</CardContent></Card>
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Expenses</CardTitle></CardHeader><CardContent class="text-xl font-semibold">{{ money(expenses.reduce((sum, tx) => sum + tx.amount, 0)) }}</CardContent></Card>
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Food and craving</CardTitle></CardHeader><CardContent class="text-xl font-semibold">{{ money(sumByCategories(expenses, FOOD_SNACKING_CATEGORIES)) }}</CardContent></Card>
      <Card><CardHeader class="pb-2"><CardTitle class="text-sm text-muted-foreground">Petrol and repair</CardTitle></CardHeader><CardContent class="text-xl font-semibold">{{ money(sumByCategories(expenses, VEHICLE_CATEGORIES)) }}</CardContent></Card>
    </div>

    <Card v-if="missing.missingNote || missing.uncategorizedExpense">
      <CardContent class="pt-6 text-sm text-muted-foreground">
        {{ missing.missingNote }} missing notes, {{ missing.uncategorizedExpense }} expenses without a category.
      </CardContent>
    </Card>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Spending by category</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p v-if="!breakdown.length" class="text-sm text-muted-foreground">No expenses in this range.</p>
          <div v-for="row in breakdown" :key="row.label">
            <div class="mb-1 flex justify-between text-sm">
              <span>{{ row.label }}</span>
              <span>{{ money(row.amount) }} · {{ row.percentage.toFixed(0) }}%</span>
            </div>
            <div class="h-2 rounded-full bg-muted">
              <div class="h-2 rounded-full" :style="{ width: `${row.percentage}%`, background: row.color }" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Income sources</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <p v-if="!sources.length" class="text-sm text-muted-foreground">No income in this range.</p>
          <div v-for="row in sources" :key="row.label">
            <div class="mb-1 flex justify-between text-sm">
              <span>{{ row.label }}</span>
              <span>{{ money(row.amount) }} · {{ row.percentage.toFixed(0) }}%</span>
            </div>
            <div class="h-2 rounded-full bg-muted">
              <div class="h-2 rounded-full bg-primary" :style="{ width: `${row.percentage}%` }" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Last 6 months</CardTitle></CardHeader>
      <CardContent>
        <div class="flex h-48 items-end gap-3">
          <div v-for="point in trend" :key="point.label" class="flex flex-1 flex-col items-center gap-2">
            <div class="flex h-36 w-full items-end justify-center gap-1">
              <div class="w-3 rounded-t bg-emerald-600" :style="{ height: `${(point.totalIncome / maxTrend) * 100}%` }" />
              <div class="w-3 rounded-t bg-destructive" :style="{ height: `${(point.totalExpenses / maxTrend) * 100}%` }" />
            </div>
            <p class="text-xs text-muted-foreground">{{ point.label }}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">Green is income. Red is expenses.</p>
      </CardContent>
    </Card>
  </div>
</template>
