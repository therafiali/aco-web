<script setup lang="ts">
import { format, subDays } from 'date-fns'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { customCategories, rememberCategory } from '@/lib/device-options'
import {
  removeTransactionRecord,
  savePetrolRefuelReminder,
  saveTransactionRecord,
  transactions,
} from '@/lib/finance'
import {
  expenseDateFromInput,
  formatPetrolDays,
  isPetrolCategory,
  suggestedRefuelDate,
  toDateKey,
} from '@/lib/fuel'
import { collectCategories, recentNoteSuggestions, resolvePaidWith } from '@/lib/money'
import type { PaidWith, Transaction } from '@/lib/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ transaction: Transaction | null; defaultDate: string }>()

const type = ref<Transaction['type']>('expense')
const category = ref('Food')
const paidWith = ref<PaidWith>('cash')
const note = ref('')
const amount = ref('')
const date = ref('')
const saving = ref(false)
const addingCategory = ref(false)
const newCategory = ref('')
const refuelDate = ref('')
const refuelTouched = ref(false)

const categories = computed(() => {
  const names = new Set<string>([...collectCategories(transactions.value), ...customCategories.value])
  if (category.value.trim()) names.add(category.value.trim())
  return [...names].sort((a, b) => a.localeCompare(b))
})

const suggestions = computed(() =>
  recentNoteSuggestions(transactions.value, type.value, category.value, note.value),
)

const petrolHint = computed(() => {
  if (type.value !== 'expense' || !isPetrolCategory(category.value)) return ''
  return formatPetrolDays(Number(amount.value))
})

const today = computed(() => new Date())
const quickDates = computed(() => {
  const now = today.value
  return [
    { label: format(subDays(now, 2), 'd MMM'), date: subDays(now, 2) },
    { label: 'Today', date: now },
    { label: 'Yesterday', date: subDays(now, 1) },
  ]
})

function dateKey(value: Date) {
  return format(value, 'yyyy-MM-dd')
}

function selectedQuick(value: Date) {
  return date.value === dateKey(value)
}

function applySuggestedRefuel() {
  if (type.value !== 'expense' || !isPetrolCategory(category.value)) {
    refuelTouched.value = false
    refuelDate.value = ''
    return
  }
  if (refuelTouched.value) return
  const suggested = suggestedRefuelDate(Number(amount.value), expenseDateFromInput(date.value))
  refuelDate.value = suggested ? toDateKey(suggested) : ''
}

function onRefuelDate(value: string | number) {
  const next = String(value)
  if (!next || next === refuelDate.value) return
  refuelTouched.value = true
  refuelDate.value = next
}

function formatSuggestionAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function addCategory() {
  const name = newCategory.value.trim()
  if (!name) return
  const existing = categories.value.find((item) => item.toLowerCase() === name.toLowerCase())
  if (!existing) rememberCategory(name)
  category.value = existing ?? name
  newCategory.value = ''
  addingCategory.value = false
}

function applySuggestion(item: { note: string; amount: number }) {
  note.value = item.note
  amount.value = String(item.amount)
}

watch(
  () => [open.value, props.transaction, props.defaultDate] as const,
  () => {
    if (!open.value) return
    const current = props.transaction
    type.value = current?.type ?? 'expense'
    category.value = current?.type === 'income' ? '' : current?.category || 'Food'
    paidWith.value = current ? resolvePaidWith(current) : 'cash'
    note.value = current?.note ?? ''
    amount.value = current ? String(current.amount) : ''
    date.value = (current?.date ?? props.defaultDate ?? new Date().toISOString()).slice(0, 10)
    addingCategory.value = false
    newCategory.value = ''
    refuelTouched.value = false
    applySuggestedRefuel()
  },
)

watch(type, (value) => {
  if (!open.value || value !== 'income') return
  category.value = ''
})

watch([type, category, amount, date], () => {
  if (!open.value) return
  applySuggestedRefuel()
})

async function persist() {
  const parsed = Number(amount.value)
  if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
    toast.error('Enter an amount.')
    return false
  }
  if (type.value === 'expense' && !category.value.trim()) {
    toast.error('Choose a category.')
    return false
  }
  const dateValue = new Date(`${date.value}T12:00:00`)
  await saveTransactionRecord({
    id: props.transaction?.id,
    amount: parsed,
    type: type.value,
    category: category.value,
    note: note.value,
    date: Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString(),
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
  if (saving.value) return
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
      return
    }
    toast.success(props.transaction ? 'Transaction updated.' : 'Transaction added.')
    open.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the transaction.')
  } finally {
    saving.value = false
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
      <form class="grid gap-4" @submit.prevent="save(false)">
        <div class="grid grid-cols-2 gap-2">
          <Button type="button" :variant="type === 'expense' ? 'default' : 'outline'" @click="type = 'expense'">Expense</Button>
          <Button type="button" :variant="type === 'income' ? 'default' : 'outline'" @click="type = 'income'">Income</Button>
        </div>
        <div class="grid gap-2">
          <Label for="amount">Amount</Label>
          <Input id="amount" v-model="amount" inputmode="decimal" placeholder="0" />
        </div>
        <div v-if="type === 'expense'" class="grid gap-2">
          <Label>Category</Label>
          <Select v-model="category">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="item in categories" :key="item" :value="item">{{ item }}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" class="w-fit" @click="addingCategory = !addingCategory">
            Add new
          </Button>
          <div v-if="addingCategory" class="flex gap-2">
            <Input
              v-model="newCategory"
              placeholder="Category name"
              @keydown.enter.prevent="addCategory"
            />
            <Button type="button" variant="outline" @click="addCategory">Add</Button>
          </div>
          <p v-if="petrolHint" class="text-sm text-muted-foreground">{{ petrolHint }}</p>
          <div v-if="refuelDate" class="grid gap-2">
            <Label for="refuel-date">Next refuel</Label>
            <Input
              id="refuel-date"
              type="date"
              :model-value="refuelDate"
              @update:model-value="onRefuelDate"
            />
          </div>
        </div>
        <div v-if="type === 'expense'" class="grid gap-2">
          <Label>Paid with</Label>
          <div class="grid grid-cols-2 gap-2">
            <Button type="button" :variant="paidWith === 'cash' ? 'default' : 'outline'" @click="paidWith = 'cash'">Cash</Button>
            <Button type="button" :variant="paidWith === 'online' ? 'default' : 'outline'" @click="paidWith = 'online'">Online</Button>
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="note">Note</Label>
          <Input id="note" v-model="note" :placeholder="type === 'expense' ? 'Filled up tank' : 'Monthly salary'" />
          <div v-if="suggestions.length" class="flex flex-wrap gap-2">
            <Button
              v-for="item in suggestions"
              :key="`${item.category}-${item.note}`"
              type="button"
              size="sm"
              variant="outline"
              @click="applySuggestion(item)"
            >
              {{ item.note }}: {{ formatSuggestionAmount(item.amount) }}
            </Button>
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="date">Date</Label>
          <Input id="date" v-model="date" type="date" />
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="item in quickDates"
              :key="item.label"
              type="button"
              size="sm"
              :variant="selectedQuick(item.date) ? 'default' : 'outline'"
              @click="date = dateKey(item.date)"
            >
              {{ item.label }}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button v-if="transaction" type="button" variant="outline" :disabled="saving" @click="remove">Delete</Button>
          <Button v-if="!transaction" type="button" variant="outline" :disabled="saving" @click="save(true)">
            {{ saving ? 'Saving...' : 'Save and add' }}
          </Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Saving...' : transaction ? 'Save changes' : 'Save' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
