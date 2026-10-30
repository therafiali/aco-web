<script setup lang="ts">
import {
  Banknote,
  BookOpen,
  CircleEllipsis,
  Fuel,
  GraduationCap,
  Plus,
  ShoppingBag,
  Smartphone,
  Tag,
  Utensils,
  Wallet,
  Wrench,
} from '@lucide/vue'
import { format, isSameDay, parseISO, subDays } from 'date-fns'
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { toast } from 'vue-sonner'
import DayCalendar from '@/components/DayCalendar.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { customCategories, rememberCategory } from '@/lib/device-options'
import {
  removeTransactionRecord,
  savePetrolRefuelReminder,
  saveTransactionRecord,
  transactions,
} from '@/lib/finance'
import {
  dateFromKey,
  formatDateKey,
  formatPetrolDays,
  isPetrolCategory,
  suggestedRefuelDate,
  toDateKey,
} from '@/lib/fuel'
import { recentNoteSuggestions, resolvePaidWith } from '@/lib/money'
import { DEFAULT_CATEGORIES, type PaidWith, type Transaction } from '@/lib/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ transaction: Transaction | null; defaultDate: string }>()

const CATEGORY_ICONS: Record<string, Component> = {
  Petrol: Fuel,
  Food: Utensils,
  Repair: Wrench,
  Shopping: ShoppingBag,
  Course: BookOpen,
  Education: GraduationCap,
  Other: CircleEllipsis,
}
const CUSTOM_COLOR = '#8B5CF6'

const type = ref<Transaction['type']>('expense')
const category = ref('')
const paidWith = ref<PaidWith>('cash')
const note = ref('')
const amount = ref('')
const txDate = ref(new Date())
const today = ref(new Date())
const saving = ref(false)
const saveAction = ref<'exit' | 'add' | null>(null)
const addingCategory = ref(false)
const newCategory = ref('')
const refuelDate = ref('')
const refuelTouched = ref(false)
const noteFocused = ref(false)
const showDatePicker = ref(false)
const showRefuelPicker = ref(false)
function focusField(id: string) {
  document.getElementById(id)?.focus()
}

type CategoryOption = { label: string; color: string }

const categories = computed(() => {
  const items: CategoryOption[] = DEFAULT_CATEGORIES.map((item) => ({
    label: item.label,
    color: item.color,
  }))
  const seen = new Set(items.map((item) => item.label.toLowerCase()))
  const extras = [...customCategories.value]
  for (const tx of transactions.value) {
    if (tx.type === 'expense' && tx.category?.trim()) extras.push(tx.category.trim())
  }
  if (category.value.trim()) extras.push(category.value.trim())
  for (const name of extras) {
    const clean = name.trim()
    const key = clean.toLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    items.push({ label: clean, color: CUSTOM_COLOR })
  }
  return items
})

const suggestions = computed(() =>
  recentNoteSuggestions(transactions.value, type.value, category.value, note.value),
)

const showSuggestions = computed(() => {
  const categoryHistory =
    type.value === 'expense' && !!category.value.trim() && note.value.trim().length === 0
  return (noteFocused.value || categoryHistory) && suggestions.value.length > 0
})

const petrolHint = computed(() => {
  if (type.value !== 'expense' || !isPetrolCategory(category.value)) return ''
  return formatPetrolDays(Number(amount.value))
})

const canSave = computed(() => {
  const parsed = Number(amount.value)
  if (!parsed || Number.isNaN(parsed) || parsed <= 0) return false
  if (type.value === 'expense' && !category.value.trim()) return false
  return true
})

const quickDates = computed(() => {
  const now = today.value
  return [
    { label: format(subDays(now, 2), 'd - MMM'), date: subDays(now, 2) },
    { label: 'Today', date: now },
    { label: 'Yesterday', date: subDays(now, 1) },
  ]
})

const refuelSelected = computed(() => dateFromKey(refuelDate.value) ?? txDate.value)

function categoryIcon(label: string) {
  return CATEGORY_ICONS[label] ?? Tag
}

function categorySelected(label: string) {
  return category.value.trim().toLowerCase() === label.toLowerCase()
}

function applyTimeFrom(isoSource: string, calendarDate: Date) {
  const source = parseISO(isoSource)
  const result = new Date(calendarDate)
  if (Number.isNaN(source.getTime())) return result
  result.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds())
  return result
}

function knownCategory(name: string) {
  const key = name.trim().toLowerCase()
  return categories.value.find((item) => item.label.toLowerCase() === key)?.label ?? name.trim()
}

function applySuggestedRefuel() {
  if (type.value !== 'expense' || !isPetrolCategory(category.value)) {
    refuelTouched.value = false
    refuelDate.value = ''
    return
  }
  if (refuelTouched.value) return
  const suggested = suggestedRefuelDate(Number(amount.value), txDate.value)
  refuelDate.value = suggested ? toDateKey(suggested) : ''
}

function selectCategory(label: string) {
  category.value = label
  nextTick(() => focusField('note'))
}

function addCategory() {
  const name = newCategory.value.trim()
  if (!name) return
  const existing = categories.value.find((item) => item.label.toLowerCase() === name.toLowerCase())
  if (!existing) rememberCategory(name)
  selectCategory(existing?.label ?? name)
  newCategory.value = ''
  addingCategory.value = false
}

function applySuggestion(item: { note: string; amount: number }) {
  note.value = item.note
  amount.value = String(item.amount)
  noteFocused.value = false
  nextTick(() => focusField('amount'))
}

function pickDate(day: Date) {
  const clock = props.transaction?.date ?? new Date().toISOString()
  txDate.value = applyTimeFrom(clock, day)
  showDatePicker.value = false
}

function pickRefuel(day: Date) {
  refuelTouched.value = true
  refuelDate.value = toDateKey(day)
  showRefuelPicker.value = false
}

function openDatePicker() {
  showRefuelPicker.value = false
  showDatePicker.value = !showDatePicker.value
}

function openRefuelPicker() {
  showDatePicker.value = false
  showRefuelPicker.value = !showRefuelPicker.value
}

function formatSuggestionAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

watch(
  () => [open.value, props.transaction, props.defaultDate] as const,
  () => {
    if (!open.value) return
    const current = props.transaction
    today.value = new Date()
    type.value = current?.type ?? 'expense'
    category.value = current?.type === 'income' ? '' : knownCategory(current?.category ?? '')
    paidWith.value = current ? resolvePaidWith(current) : 'cash'
    note.value = current?.note ?? ''
    amount.value = current ? String(current.amount) : ''
    const clock = current?.date ?? new Date().toISOString()
    const parsed = current?.date ? parseISO(current.date) : new Date(`${props.defaultDate || clock.slice(0, 10)}T12:00:00`)
    txDate.value = applyTimeFrom(clock, Number.isNaN(parsed.getTime()) ? new Date() : parsed)
    addingCategory.value = false
    newCategory.value = ''
    noteFocused.value = false
    showDatePicker.value = false
    showRefuelPicker.value = false
    refuelTouched.value = false
    applySuggestedRefuel()
  },
)

watch(type, (value) => {
  if (!open.value || value !== 'income') return
  category.value = ''
})

watch([type, category, amount, txDate], () => {
  if (!open.value) return
  applySuggestedRefuel()
})

async function persist() {
  const parsed = Number(amount.value)
  if (!parsed || Number.isNaN(parsed) || parsed <= 0) return false
  if (type.value === 'expense' && !category.value.trim()) return false
  const clock = props.transaction?.date ?? new Date().toISOString()
  const dateValue = applyTimeFrom(clock, txDate.value)
  await saveTransactionRecord({
    id: props.transaction?.id,
    amount: parsed,
    type: type.value,
    category: category.value,
    note: note.value,
    date: dateValue.toISOString(),
    paidWith: type.value === 'expense' ? paidWith.value : undefined,
  })
  if (type.value === 'expense' && isPetrolCategory(category.value) && refuelDate.value) {
    try {
      await savePetrolRefuelReminder(refuelDate.value)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Expense saved, but the refuel date was not.')
      return true
    }
  }
  return true
}

async function save(addAnother = false) {
  if (saving.value || !canSave.value) return
  saveAction.value = addAnother ? 'add' : 'exit'
  saving.value = true
  try {
    const saved = await persist()
    if (!saved) return
    if (addAnother && !props.transaction) {
      note.value = ''
      amount.value = ''
      refuelTouched.value = false
      applySuggestedRefuel()
      toast.success('Transaction added.')
      nextTick(() => focusField('amount'))
      return
    }
    toast.success(props.transaction ? 'Transaction updated.' : 'Transaction added.')
    open.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the transaction.')
  } finally {
    saving.value = false
    saveAction.value = null
  }
}

async function remove() {
  if (!props.transaction || saving.value) return
  if (!window.confirm('Delete this transaction? This cannot be undone.')) return
  saving.value = true
  try {
    await removeTransactionRecord(props.transaction.id)
    toast.success('Transaction deleted.')
    open.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not delete it.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ transaction ? 'Edit transaction' : 'Add transaction' }}</DialogTitle>
        <DialogDescription>Saved to the same Supabase account as the phone app.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-5" @submit.prevent="save(false)">
        <div class="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            class="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground"
            :class="type === 'expense' ? 'bg-red-500/15 font-extrabold text-red-600 dark:text-red-400' : ''"
            @click="type = 'expense'"
          >
            Expense
          </button>
          <button
            type="button"
            class="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground"
            :class="type === 'income' ? 'bg-emerald-500/15 font-extrabold text-emerald-700 dark:text-emerald-400' : ''"
            @click="type = 'income'"
          >
            Income
          </button>
        </div>

        <div v-if="type === 'expense'" class="grid gap-2">
          <Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Category</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="item in categories"
              :key="item.label"
              type="button"
              class="flex min-w-0 items-center gap-2 rounded-lg border border-transparent bg-card px-2 py-2 text-left"
              :style="categorySelected(item.label) ? { borderColor: item.color, color: item.color } : undefined"
              @click="selectCategory(item.label)"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"
                :style="categorySelected(item.label) ? { backgroundColor: `${item.color}15` } : undefined"
              >
                <component
                  :is="categoryIcon(item.label)"
                  class="size-4 text-muted-foreground"
                  :style="categorySelected(item.label) ? { color: item.color } : undefined"
                />
              </span>
              <span class="truncate text-xs" :class="categorySelected(item.label) ? 'font-bold' : 'text-muted-foreground'">
                {{ item.label }}
              </span>
            </button>
            <button
              v-if="!addingCategory"
              type="button"
              class="flex items-center gap-2 rounded-lg border border-dashed px-2 py-2 text-left text-muted-foreground"
              @click="addingCategory = true"
            >
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Plus class="size-4" />
              </span>
              <span class="truncate text-xs">Add New</span>
            </button>
            <div v-else class="col-span-2 flex items-center gap-1 rounded-lg border px-2">
              <Input
                v-model="newCategory"
                class="border-0 px-1 shadow-none focus-visible:ring-0"
                placeholder="Name..."
                @keydown.enter.prevent="addCategory"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Add category" @click="addCategory">
                <Plus />
              </Button>
            </div>
          </div>
          <div v-if="petrolHint" class="grid gap-2">
            <p class="text-sm text-muted-foreground">{{ petrolHint }}</p>
            <div v-if="refuelDate" class="grid gap-2">
              <Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next refuel</Label>
              <button
                type="button"
                class="flex h-11 items-center rounded-lg border px-3 text-left text-sm"
                @click="openRefuelPicker"
              >
                {{ formatDateKey(refuelDate) }}
              </button>
              <DayCalendar
                v-if="showRefuelPicker"
                :selected="refuelSelected"
                @select="pickRefuel"
                @close="showRefuelPicker = false"
              />
            </div>
          </div>
        </div>

        <div v-if="type === 'expense'" class="grid gap-2">
          <Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Paid with</Label>
          <div class="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground"
              :class="paidWith === 'cash' ? 'bg-accent font-extrabold text-foreground' : ''"
              @click="paidWith = 'cash'"
            >
              <Banknote class="size-4" />
              Cash
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground"
              :class="paidWith === 'online' ? 'bg-accent font-extrabold text-foreground' : ''"
              @click="paidWith = 'online'"
            >
              <Smartphone class="size-4" />
              Online
            </button>
          </div>
        </div>

        <div v-if="type === 'income'" class="flex flex-col items-center gap-2 py-2 text-center">
          <span class="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Wallet class="size-7" />
          </span>
          <p class="text-sm text-muted-foreground">Add your income amount below</p>
        </div>

        <div class="grid gap-2">
          <Label for="note" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Note (optional)</Label>
          <Input
            id="note"
            v-model="note"
            class="h-11"
            :placeholder="type === 'expense' ? 'e.g. Filled up tank' : 'e.g. Monthly salary'"
            @focus="noteFocused = true"
            @blur="noteFocused = false"
            @keydown.enter.prevent="focusField('amount')"
          />
          <div v-if="showSuggestions" class="grid gap-2">
            <p class="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {{ type === 'expense' && category ? 'Recent in this category' : 'Suggested notes' }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="item in suggestions"
                :key="`${item.category}-${item.note}`"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                @mousedown.prevent="applySuggestion(item)"
              >
                {{ item.note }}: {{ formatSuggestionAmount(item.amount) }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="amount" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Amount</Label>
          <Input
            id="amount"
            v-model="amount"
            inputmode="decimal"
            class="h-16 text-3xl font-extrabold"
            placeholder="0"
            @keydown.enter.prevent="canSave && save(false)"
          />
        </div>

        <div class="grid gap-2">
          <Label class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Date</Label>
          <button
            type="button"
            class="flex h-11 items-center rounded-lg border px-3 text-left text-sm"
            @click="openDatePicker"
          >
            {{ format(txDate, 'EEEE, MMM d, yyyy') }}
          </button>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in quickDates"
              :key="item.label"
              type="button"
              class="rounded-full border px-3.5 py-1.5 text-sm font-semibold text-muted-foreground"
              :class="isSameDay(txDate, item.date) ? 'border-primary bg-accent font-extrabold text-foreground' : ''"
              @click="pickDate(item.date)"
            >
              {{ item.label }}
            </button>
          </div>
          <DayCalendar v-if="showDatePicker" :selected="txDate" @select="pickDate" @close="showDatePicker = false" />
        </div>

        <div class="grid gap-2" :class="transaction ? '' : 'grid-cols-2'">
          <Button
            v-if="!transaction"
            type="button"
            variant="outline"
            :disabled="!canSave || saving"
            @click="save(true)"
          >
            {{ saving && saveAction === 'add' ? 'Saving...' : 'Save and Add' }}
          </Button>
          <Button type="submit" :disabled="!canSave || saving">
            {{ saving && saveAction !== 'add' ? 'Saving...' : transaction ? 'Save changes' : 'Save' }}
          </Button>
        </div>
        <Button v-if="transaction" type="button" variant="outline" class="text-red-600" :disabled="saving" @click="remove">
          Delete transaction
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
