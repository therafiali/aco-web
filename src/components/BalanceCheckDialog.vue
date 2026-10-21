<script setup lang="ts">
import { endOfMonth, format } from 'date-fns'
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
import { Switch } from '@/components/ui/switch'
import { reconciliationFor, saveReconciliation } from '@/lib/device-options'
import { profile, saveTransactionRecord, transactions } from '@/lib/finance'
import { formatMoney, inMonth, summarize } from '@/lib/money'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ month: Date }>()

const actual = ref('')
const adjust = ref(true)
const saving = ref(false)

const monthKey = computed(() => format(props.month, 'yyyy_MM'))
const monthLabel = computed(() => format(props.month, 'MMMM'))
const appExpenses = computed(() => summarize(inMonth(transactions.value, props.month)).totalExpenses)
const parsedActual = computed(() => Number(String(actual.value).replace(',', '.')))
const hasInput = computed(() => actual.value.trim() !== '' && Number.isFinite(parsedActual.value))
const difference = computed(() => parsedActual.value - appExpenses.value)
const hasDiff = computed(() => hasInput.value && Math.abs(difference.value) >= 0.01)
const missed = computed(() => hasDiff.value && difference.value > 0)

function money(amount: number) {
  return formatMoney(amount, profile.value.currency || 'USD')
}

watch(
  () => [open.value, monthKey.value] as const,
  () => {
    if (!open.value) return
    const existing = reconciliationFor(monthKey.value)
    actual.value = existing ? String(existing.actualBalance) : ''
    adjust.value = true
  },
)

async function save() {
  if (!hasInput.value || saving.value) return
  saving.value = true
  try {
    const rec = {
      monthKey: monthKey.value,
      appBalance: appExpenses.value,
      actualBalance: parsedActual.value,
      difference: difference.value,
      reconciledAt: new Date().toISOString(),
      adjustmentCreated: false,
    }
    if (hasDiff.value && adjust.value) {
      await saveTransactionRecord({
        type: 'expense',
        amount: Math.abs(difference.value),
        category: 'Other',
        note: missed.value ? 'Missed expense' : 'Over-recorded adjustment',
        date: endOfMonth(props.month).toISOString(),
        paidWith: 'cash',
      })
      rec.adjustmentCreated = true
      rec.appBalance = appExpenses.value + Math.abs(difference.value)
    }
    saveReconciliation(rec)
    toast.success(hasDiff.value ? 'Balance check saved.' : 'This month matches.')
    open.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the balance check.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Check {{ monthLabel }}</DialogTitle>
        <DialogDescription>Compare the app total with what the bank or wallet actually spent.</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="save">
        <div class="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span class="text-muted-foreground">App recorded expenses</span>
          <span class="font-medium">{{ money(appExpenses) }}</span>
        </div>
        <div class="grid gap-2">
          <Label for="actual-spent">Bank / actual total spent</Label>
          <Input id="actual-spent" v-model="actual" inputmode="decimal" placeholder="0.00" />
        </div>
        <p v-if="hasInput && !hasDiff" class="text-sm text-emerald-700">All good. Everything matches.</p>
        <p v-else-if="missed" class="text-sm text-destructive">
          {{ money(Math.abs(difference)) }} in missed expenses. The bank shows more spending than the app.
        </p>
        <p v-else-if="hasDiff" class="text-sm text-emerald-700">
          {{ money(Math.abs(difference)) }} extra recorded in the app. There may be a duplicate.
        </p>
        <div v-if="hasDiff" class="flex items-center justify-between gap-3">
          <Label for="adjust">
            {{ missed ? `Add ${money(Math.abs(difference))} as a missed expense` : `Add ${money(Math.abs(difference))} as an over-recorded adjustment` }}
          </Label>
          <Switch id="adjust" v-model="adjust" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Skip for now</Button>
          <Button type="submit" :disabled="!hasInput || saving">{{ saving ? 'Saving...' : 'Save' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
