<script setup lang="ts">
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ selected: Date }>()
const emit = defineEmits<{ select: [day: Date]; close: [] }>()

const month = ref(startOfMonth(props.selected))
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const weeks = computed(() => {
  const start = startOfWeek(startOfMonth(month.value), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month.value), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })
  const rows: Date[][] = []
  for (let index = 0; index < days.length; index += 7) rows.push(days.slice(index, index + 7))
  return rows
})
</script>

<template>
  <div class="rounded-xl border bg-card p-3">
    <div class="mb-3 flex items-center justify-between">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" @click="month = addMonths(month, -1)">
        <ChevronLeft />
      </Button>
      <p class="text-sm font-semibold">{{ format(month, 'MMMM yyyy') }}</p>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" @click="month = addMonths(month, 1)">
        <ChevronRight />
      </Button>
    </div>
    <div class="mb-1 grid grid-cols-7">
      <span v-for="(day, index) in weekdays" :key="index" class="text-center text-[11px] font-semibold text-muted-foreground">
        {{ day }}
      </span>
    </div>
    <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="grid grid-cols-7">
      <button
        v-for="(day, dayIndex) in week"
        :key="dayIndex"
        type="button"
        class="flex aspect-square max-h-10 items-center justify-center rounded-md text-sm font-semibold"
        :class="[
          isSameDay(day, selected) ? 'bg-accent font-extrabold text-foreground' : '',
          isSameMonth(day, month) ? '' : 'text-muted-foreground/35',
        ]"
        @click="emit('select', day)"
      >
        {{ format(day, 'd') }}
      </button>
    </div>
    <Button type="button" variant="ghost" class="mt-2 w-full" @click="emit('close')">Cancel</Button>
  </div>
</template>
