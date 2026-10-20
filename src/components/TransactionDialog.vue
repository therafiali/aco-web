<script setup lang="ts">
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
import { saveTransactionRecord } from '@/lib/finance'
import { collectCategories } from '@/lib/money'
import { transactions } from '@/lib/finance'
import type { Transaction } from '@/lib/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ transaction: Transaction | null; defaultDate: string }>()

const type = ref<Transaction['type']>('expense')
const category = ref('Food')
const note = ref('')
const amount = ref('')
const date = ref('')
const saving = ref(false)

const categories = computed(() => collectCategories(transactions.value))

watch(
  () => [open.value, props.transaction, props.defaultDate] as const,
  () => {
    if (!open.value) return
    const current = props.transaction
    type.value = current?.type ?? 'expense'
    category.value = current?.category || 'Food'
    note.value = current?.note ?? ''
    amount.value = current ? String(current.amount) : ''
    date.value = (current?.date ?? props.defaultDate ?? new Date().toISOString()).slice(0, 10)
  },
)

async function save() {
  const parsed = Number(amount.value)
  if (!parsed || Number.isNaN(parsed)) {
    toast.error('Enter an amount.')
    return
  }
  if (type.value === 'expense' && !category.value) {
    toast.error('Choose a category.')
    return
  }
  saving.value = true
  try {
    const dateValue = new Date(`${date.value}T12:00:00`)
    await saveTransactionRecord({
      id: props.transaction?.id,
      amount: parsed,
      type: type.value,
      category: category.value,
      note: note.value,
      date: Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString(),
    })
    toast.success(props.transaction ? 'Transaction updated.' : 'Transaction added.')
    open.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the transaction.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ transaction ? 'Edit transaction' : 'Add transaction' }}</DialogTitle>
        <DialogDescription>Saved to the same Supabase account as the phone app.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="save">
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
        </div>
        <div class="grid gap-2">
          <Label for="note">Note</Label>
          <Input id="note" v-model="note" placeholder="Lunch, salary, transfer" />
        </div>
        <div class="grid gap-2">
          <Label for="date">Date</Label>
          <Input id="date" v-model="date" type="date" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
