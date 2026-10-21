<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  archiveGoalRecord,
  archivePromptRecord,
  archiveReminderRecord,
  bumpGoalRecord,
  completeReminderRecord,
  goalSummary,
  goals,
  prompts,
  reminders,
  saveGoalRecord,
  savePromptRecord,
  saveReminderRecord,
  saveTransactionRecord,
} from '@/lib/finance'
import { customCategories } from '@/lib/device-options'
import { collectCategories } from '@/lib/money'
import { transactions } from '@/lib/finance'
import { formatReminderSchedule, reminderKindLabel, sortReminders } from '@/lib/schedule'
import type { ExpensePrompt, Goal, GoalPeriod, GoalReminderSlot, Reminder, ReminderKind } from '@/lib/types'

const NAMAZ_SLOTS = [
  { label: 'Fajr', time: '05:00' },
  { label: 'Dhuhr', time: '13:00' },
  { label: 'Asr', time: '16:30' },
  { label: 'Maghrib', time: '18:30' },
  { label: 'Isha', time: '20:00' },
]
const INTERVAL_PRESETS = [7, 14, 20, 30]

function blankSlot(): GoalReminderSlot {
  return { id: crypto.randomUUID(), label: '', time: '09:00' }
}

function applyNamaz() {
  goalSlots.value = NAMAZ_SLOTS.map((slot) => ({ id: crypto.randomUUID(), label: slot.label, time: slot.time }))
}

const tab = ref('goals')
const goalOpen = ref(false)
const reminderOpen = ref(false)
const promptOpen = ref(false)
const editingGoal = ref<Goal | null>(null)
const editingReminder = ref<Reminder | null>(null)
const editingPrompt = ref<ExpensePrompt | null>(null)

const goalTitle = ref('')
const goalEmoji = ref('💧')
const goalTarget = ref('1')
const goalPeriod = ref<GoalPeriod>('daily')
const goalReminders = ref(true)
const goalTime = ref('09:00')
const goalPerPeriod = ref('1')
const useCustomTimes = ref(false)
const goalSlots = ref<GoalReminderSlot[]>([blankSlot()])

watch(goalPeriod, (value) => {
  if (value !== 'daily') useCustomTimes.value = false
})

const reminderTitle = ref('')
const reminderNote = ref('')
const reminderKind = ref<ReminderKind>('once')
const reminderTime = ref('09:00')
const reminderDate = ref('')
const reminderMonthDay = ref('1')
const reminderInterval = ref('20')
const reminderEnabled = ref(true)

const promptTitle = ref('')
const promptTime = ref('14:00')
const promptCategory = ref('Food')
const promptEnabled = ref(true)
const promptAmounts = ref<Record<string, string>>({})

const orderedReminders = computed(() => sortReminders(reminders.value))
const activePrompts = computed(() => prompts.value.filter((item) => item.isActive))
const categories = computed(() => {
  const names = new Set<string>([...collectCategories(transactions.value), ...customCategories.value])
  return [...names].sort((a, b) => a.localeCompare(b))
})

function openGoal(goal?: Goal) {
  editingGoal.value = goal ?? null
  goalTitle.value = goal?.title ?? ''
  goalEmoji.value = goal?.emoji ?? '💧'
  goalTarget.value = String(goal?.targetCount ?? 1)
  goalPeriod.value = goal?.period ?? 'daily'
  goalReminders.value = goal?.reminderEnabled ?? true
  goalTime.value = goal?.reminderTime ?? '09:00'
  goalPerPeriod.value = String(goal?.remindersPerPeriod ?? 1)
  useCustomTimes.value = goal?.period === 'daily' && (goal.reminderSlots?.length ?? 0) > 0
  goalSlots.value = goal?.reminderSlots?.length ? goal.reminderSlots.map((slot) => ({ ...slot })) : [blankSlot()]
  goalOpen.value = true
}

function openReminder(reminder?: Reminder) {
  editingReminder.value = reminder ?? null
  reminderTitle.value = reminder?.title ?? ''
  reminderNote.value = reminder?.note ?? ''
  reminderKind.value = reminder?.kind ?? 'once'
  reminderTime.value = reminder?.time ?? '09:00'
  reminderDate.value = reminder?.fireAt?.slice(0, 10) ?? ''
  reminderMonthDay.value = String(reminder?.monthDay ?? new Date().getDate())
  reminderInterval.value = String(reminder?.intervalDays ?? 20)
  reminderEnabled.value = reminder?.enabled ?? true
  reminderOpen.value = true
}

function openPrompt(prompt?: ExpensePrompt) {
  editingPrompt.value = prompt ?? null
  promptTitle.value = prompt?.title ?? ''
  promptTime.value = prompt?.time ?? '14:00'
  promptCategory.value = prompt?.category ?? 'Food'
  promptEnabled.value = prompt?.enabled ?? true
  promptOpen.value = true
}

async function saveGoal() {
  if (!goalTitle.value.trim()) {
    toast.error('Give this goal a name.')
    return
  }
  try {
    await saveGoalRecord({
      id: editingGoal.value?.id,
      title: goalTitle.value,
      emoji: goalEmoji.value,
      targetCount: Number(goalTarget.value) || 1,
      period: goalPeriod.value,
      reminderEnabled: goalReminders.value,
      remindersPerPeriod: Number(goalPerPeriod.value) || 1,
      reminderTime: goalTime.value,
      reminderSlots: goalPeriod.value === 'daily' && useCustomTimes.value ? goalSlots.value : [],
    })
    goalOpen.value = false
    toast.success('Goal saved.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the goal.')
  }
}

async function saveReminder() {
  if (!reminderTitle.value.trim()) {
    toast.error('Give this reminder a name.')
    return
  }
  const fireAt = reminderKind.value === 'once' && reminderDate.value
    ? new Date(`${reminderDate.value}T${reminderTime.value}`).toISOString()
    : undefined
  if (reminderKind.value === 'once' && (!fireAt || new Date(fireAt).getTime() <= Date.now())) {
    toast.error('One-time reminders need a date and time that is still ahead.')
    return
  }
  try {
    await saveReminderRecord({
      id: editingReminder.value?.id,
      title: reminderTitle.value,
      note: reminderNote.value,
      kind: reminderKind.value,
      time: reminderTime.value,
      fireAt,
      monthDay: Number(reminderMonthDay.value),
      intervalDays: Number(reminderInterval.value),
      enabled: reminderEnabled.value,
    })
    reminderOpen.value = false
    toast.success('Reminder saved.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save the reminder.')
  }
}

function savePrompt() {
  if (!promptTitle.value.trim()) {
    toast.error('Give this prompt a name.')
    return
  }
  savePromptRecord({
    id: editingPrompt.value?.id,
    title: promptTitle.value,
    time: promptTime.value,
    category: promptCategory.value,
    enabled: promptEnabled.value,
  })
  promptOpen.value = false
}

async function logPrompt(prompt: ExpensePrompt) {
  const amount = Number(promptAmounts.value[prompt.id] ?? '')
  if (!amount) {
    toast.error('Enter an amount to log.')
    return
  }
  try {
    const [hour, minute] = prompt.time.split(':')
    const date = new Date()
    date.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0)
    await saveTransactionRecord({
      amount,
      type: 'expense',
      category: prompt.category,
      note: prompt.title,
      date: date.toISOString(),
      paidWith: 'cash',
    })
    promptAmounts.value = { ...promptAmounts.value, [prompt.id]: '' }
    toast.success('Expense logged.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not log the expense.')
  }
}

async function run(action: () => Promise<void> | void) {
  try {
    await action()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Something went wrong.')
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Goals</h1>
      <p class="text-sm text-muted-foreground">Habits, reminders, and daily expense prompts.</p>
    </div>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="goals">Goals</TabsTrigger>
        <TabsTrigger value="reminders">Reminders</TabsTrigger>
        <TabsTrigger value="prompts">Expense prompts</TabsTrigger>
      </TabsList>

      <TabsContent value="goals" class="space-y-4">
        <div class="flex justify-end"><Button @click="openGoal()">New goal</Button></div>
        <p v-if="!goals.length" class="text-sm text-muted-foreground">No active goals yet.</p>
        <div class="grid gap-3 lg:grid-cols-2">
          <Card v-for="goal in goals" :key="goal.id">
            <CardHeader>
              <CardTitle>{{ goal.emoji }} {{ goal.title }}</CardTitle>
              <CardDescription>
                {{ goal.completedCount }} / {{ goal.targetCount }} this {{ goal.period === 'daily' ? 'day' : goal.period === 'weekly' ? 'week' : 'month' }}
                · {{ goalSummary(goal.id).totalDone }} total
                · {{ goalSummary(goal.id).thisMonthDone }} this month
              </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-2">
              <Button variant="outline" @click="run(() => bumpGoalRecord(goal.id, -1))">-</Button>
              <Button @click="run(() => bumpGoalRecord(goal.id, 1))">+</Button>
              <Button variant="ghost" @click="openGoal(goal)">Edit</Button>
              <Button variant="ghost" @click="run(() => archiveGoalRecord(goal.id))">Archive</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="reminders" class="space-y-4">
        <div class="flex justify-end"><Button @click="openReminder()">New reminder</Button></div>
        <p v-if="!orderedReminders.length" class="text-sm text-muted-foreground">No reminders yet.</p>
        <div class="grid gap-3 lg:grid-cols-2">
          <Card v-for="reminder in orderedReminders" :key="reminder.id">
            <CardHeader>
              <CardTitle>{{ reminder.title }}</CardTitle>
              <CardDescription>
                {{ reminderKindLabel(reminder.kind) }} · {{ formatReminderSchedule(reminder) }}
                <span v-if="!reminder.enabled"> · Off</span>
              </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-2">
              <Button v-if="reminder.kind === 'interval'" variant="outline" @click="run(() => completeReminderRecord(reminder.id))">Done</Button>
              <Button variant="ghost" @click="openReminder(reminder)">Edit</Button>
              <Button variant="ghost" @click="run(() => archiveReminderRecord(reminder.id))">Delete</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="prompts" class="space-y-4">
        <p class="text-sm text-muted-foreground">These prompts stay in this browser. Logging one writes the expense to Supabase.</p>
        <div class="flex justify-end"><Button @click="openPrompt()">New prompt</Button></div>
        <p v-if="!activePrompts.length" class="text-sm text-muted-foreground">No expense prompts yet.</p>
        <div class="grid gap-3 lg:grid-cols-2">
          <Card v-for="prompt in activePrompts" :key="prompt.id">
            <CardHeader>
              <CardTitle>{{ prompt.title }}</CardTitle>
              <CardDescription>{{ prompt.time }} · {{ prompt.category || 'No category' }} · {{ prompt.enabled ? 'On' : 'Off' }}</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap items-center gap-2">
              <Input v-model="promptAmounts[prompt.id]" class="max-w-28" placeholder="Amount" />
              <Button variant="outline" @click="logPrompt(prompt)">Log expense</Button>
              <Button variant="ghost" @click="openPrompt(prompt)">Edit</Button>
              <Button variant="ghost" @click="archivePromptRecord(prompt.id)">Delete</Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="goalOpen">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{{ editingGoal ? 'Edit goal' : 'Create goal' }}</DialogTitle></DialogHeader>
        <form class="grid gap-4" @submit.prevent="saveGoal">
          <div class="grid gap-2"><Label>Name</Label><Input v-model="goalTitle" placeholder="Drink water" /></div>
          <div class="grid gap-2"><Label>Emoji</Label><Input v-model="goalEmoji" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-2"><Label>Target</Label><Input v-model="goalTarget" inputmode="numeric" /></div>
            <div class="grid gap-2">
              <Label>Period</Label>
              <Select v-model="goalPeriod">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex items-center justify-between"><Label>Reminders</Label><Switch v-model="goalReminders" /></div>
          <div v-if="goalPeriod === 'daily'" class="flex items-center justify-between">
            <Label>Custom exact times</Label>
            <Switch v-model="useCustomTimes" />
          </div>
          <div v-if="goalPeriod === 'daily' && useCustomTimes" class="grid gap-2">
            <Button type="button" variant="outline" @click="applyNamaz">
              Namaz preset
            </Button>
            <div v-for="slot in goalSlots" :key="slot.id" class="grid grid-cols-[1fr_8rem_auto] gap-2">
              <Input v-model="slot.label" placeholder="Label" />
              <Input v-model="slot.time" type="time" />
              <Button type="button" variant="ghost" @click="goalSlots = goalSlots.length <= 1 ? goalSlots : goalSlots.filter((item) => item.id !== slot.id)">Remove</Button>
            </div>
            <Button type="button" variant="outline" @click="goalSlots = [...goalSlots, blankSlot()]">Add time</Button>
          </div>
          <div v-else class="grid grid-cols-2 gap-3">
            <div class="grid gap-2"><Label>Time</Label><Input v-model="goalTime" type="time" /></div>
            <div class="grid gap-2"><Label>Times per period</Label><Input v-model="goalPerPeriod" inputmode="numeric" /></div>
          </div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="reminderOpen">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{{ editingReminder ? 'Edit reminder' : 'Create reminder' }}</DialogTitle></DialogHeader>
        <form class="grid gap-4" @submit.prevent="saveReminder">
          <div class="grid gap-2"><Label>Name</Label><Input v-model="reminderTitle" placeholder="Bike oil" /></div>
          <div class="grid gap-2"><Label>Note</Label><Input v-model="reminderNote" /></div>
          <div class="grid gap-2">
            <Label>Schedule</Label>
            <Select v-model="reminderKind">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One time</SelectItem>
                <SelectItem value="monthly">Every month</SelectItem>
                <SelectItem value="interval">Every few days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2"><Label>Time</Label><Input v-model="reminderTime" type="time" /></div>
          <div v-if="reminderKind === 'once'" class="grid gap-2"><Label>Date</Label><Input v-model="reminderDate" type="date" /></div>
          <div v-if="reminderKind === 'monthly'" class="grid gap-2"><Label>Day of month</Label><Input v-model="reminderMonthDay" inputmode="numeric" /></div>
          <div v-if="reminderKind === 'interval'" class="grid gap-2">
            <Label>Every how many days</Label>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="days in INTERVAL_PRESETS"
                :key="days"
                type="button"
                size="sm"
                :variant="reminderInterval === String(days) ? 'default' : 'outline'"
                @click="reminderInterval = String(days)"
              >
                {{ days }}d
              </Button>
            </div>
            <Input v-model="reminderInterval" inputmode="numeric" />
          </div>
          <div class="flex items-center justify-between"><Label>Enabled</Label><Switch v-model="reminderEnabled" /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="promptOpen">
      <DialogContent>
        <DialogHeader><DialogTitle>{{ editingPrompt ? 'Edit prompt' : 'Create expense prompt' }}</DialogTitle></DialogHeader>
        <form class="grid gap-4" @submit.prevent="savePrompt">
          <div class="grid gap-2"><Label>Name</Label><Input v-model="promptTitle" placeholder="Lunch" /></div>
          <div class="grid gap-2"><Label>Time</Label><Input v-model="promptTime" type="time" /></div>
          <div class="grid gap-2">
            <Label>Category</Label>
            <Select v-model="promptCategory">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in categories" :key="item" :value="item">{{ item }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center justify-between"><Label>Enabled</Label><Switch v-model="promptEnabled" /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
