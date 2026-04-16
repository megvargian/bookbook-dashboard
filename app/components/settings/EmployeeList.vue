<script setup lang="ts">
import type { Employee } from '~/types'

const props = defineProps<{
  employees: Employee[]
}>()

const emit = defineEmits<{
  removeEmployee: [id: string]
  editEmployee: [employee: Employee]
}>()

function formatHour(t?: string) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${suffix}`
}

function workingDaysArray(days?: string | string[]): string[] {
  if (!days) return []
  if (Array.isArray(days)) return days
  return days.split(',').map(s => s.trim()).filter(Boolean)
}

const dayAbbr: Record<string, string> = {
  Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th',
  Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su'
}
</script>

<template>
  <div v-if="employees?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="employee in employees"
      :key="employee.id"
      class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
    >
      <!-- Top accent -->
      <div class="h-2 w-full bg-gradient-to-r from-navy-500 to-navy-400" />

      <div class="flex-1 p-5 flex flex-col items-center gap-3 text-center">
        <!-- Avatar -->
        <div class="relative">
          <img
            v-if="employee.profile_picture"
            :src="employee.profile_picture"
            :alt="employee.full_name"
            class="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-gray-700"
          >
          <div
            v-else
            class="w-16 h-16 rounded-full bg-navy-500 flex items-center justify-center text-white text-xl font-bold"
          >
            {{ employee.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'E' }}
          </div>
          <!-- Active indicator -->
          <span
            class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900"
            :class="employee.is_active ? 'bg-green-400' : 'bg-slate-300 dark:bg-gray-600'"
          />
        </div>

        <!-- Name + role -->
        <div>
          <h3 class="font-semibold text-slate-900 dark:text-white text-base leading-tight">
            {{ employee.full_name }}
          </h3>
          <span
            class="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="employee.role === 'admin'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
              : 'bg-navy-50 dark:bg-navy-900/30 text-navy-600 dark:text-navy-300'"
          >
            {{ employee.role === 'admin' ? 'Admin' : 'Employee' }}
          </span>
        </div>

        <!-- Contact -->
        <div class="w-full space-y-1">
          <div class="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <UIcon name="i-lucide-mail" class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">{{ employee.email }}</span>
          </div>
          <div v-if="employee.phone_number" class="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <UIcon name="i-lucide-phone" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ employee.phone_number }}</span>
          </div>
        </div>

        <!-- Hours -->
        <div v-if="employee.start_working_hour || employee.end_working_hours" class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <UIcon name="i-lucide-clock" class="w-3.5 h-3.5 shrink-0" />
          <span>{{ formatHour(employee.start_working_hour) }} – {{ formatHour(employee.end_working_hours) }}</span>
        </div>

        <!-- Working days -->
        <div v-if="workingDaysArray(employee.working_week_days).length" class="flex flex-wrap justify-center gap-1">
          <span
            v-for="day in workingDaysArray(employee.working_week_days)"
            :key="day"
            class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium bg-navy-50 dark:bg-navy-900/30 text-navy-600 dark:text-navy-300"
          >
            {{ dayAbbr[day] || day.slice(0, 2) }}
          </span>
        </div>
      </div>

      <!-- Action row -->
      <div class="px-5 py-3 border-t border-slate-100 dark:border-gray-800 flex items-center gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
          @click="emit('editEmployee', employee)"
        >
          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          @click="emit('removeEmployee', employee.id)"
        >
          <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    </div>
  </div>

  <div v-else class="py-16 text-center">
    <UIcon name="i-lucide-users" class="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
    <p class="text-sm text-slate-500 dark:text-slate-400">No employees found</p>
  </div>
</template>
