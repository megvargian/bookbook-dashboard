<script setup lang="ts">
import { useBookingFlow2 } from '~/composables/useBookingFlow2'

const { bookingState, updateServiceBooking } = useBookingFlow2()

const activeServiceIndex = ref(0)
const activeService = computed(() => bookingState.value.serviceBookings[activeServiceIndex.value])

// Services for display info
const { data: services } = await useLazyFetch('/api/public-services', {
  default: () => [],
  server: false
})

const getServiceDetails = (serviceId: string) =>
  services.value?.find((s: any) => s.id === serviceId)

const getDurationSeconds = (serviceId: string | undefined) => {
  if (!serviceId) return 3600
  return getServiceDetails(serviceId)?.duration_service_in_s || 3600
}

// ── Calendar state ──────────────────────────────────────────────────────
const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())

const formatDate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isToday = (date: Date) => date.toDateString() === new Date().toDateString()
const isPast = (date: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return date < today
}
const isDateSelected = (date: Date) => selectedDate.value?.toDateString() === date.toDateString()

const navigateMonth = (dir: number) => {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + dir)
  currentMonth.value = d
}

const monthYear = computed(() =>
  currentMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const daysInMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  return days
})

// ── Fetch time slots for selected employee + date ───────────────────────
// We snapshot query params to avoid refetching when user picks a time slot
const slotParams = ref({
  employee_id: activeService.value?.employeeId || '',
  date: '',
  duration: getDurationSeconds(activeService.value?.serviceId)
})

const { data: slotsResponse, pending: slotsPending, refresh: refreshSlots } = await useLazyFetch('/api/employee-timeslots', {
  default: () => ({ slots: [] }),
  server: false,
  query: slotParams,
  watch: false // manual refresh only
})

const slots = computed(() => slotsResponse.value?.slots || [])

// Refetch whenever we change date or active service
const loadSlots = () => {
  if (!selectedDate.value || !activeService.value?.employeeId) return
  slotParams.value = {
    employee_id: activeService.value.employeeId,
    date: formatDate(selectedDate.value),
    duration: getDurationSeconds(activeService.value.serviceId)
  }
  refreshSlots()
}

const selectDate = (date: Date) => {
  if (isPast(date)) return
  if (selectedDate.value && formatDate(selectedDate.value) !== formatDate(date)) {
    // Clear time selection when date changes
    if (activeService.value) updateServiceBooking(activeService.value.serviceId, { time: null })
  }
  selectedDate.value = date
  loadSlots()
}

const selectTime = (slot: { time: string; available: boolean }) => {
  if (!slot.available || !activeService.value || !selectedDate.value) return
  updateServiceBooking(activeService.value.serviceId, {
    date: formatDate(selectedDate.value),
    time: slot.time
  })
}

const isTimeSelected = (time: string) =>
  activeService.value?.time === time && activeService.value?.date === (selectedDate.value ? formatDate(selectedDate.value) : '')

// ── Service navigation ───────────────────────────────────────────────────
const goToService = (index: number) => {
  if (index < 0 || index >= bookingState.value.serviceBookings.length) return
  activeServiceIndex.value = index
  const sb = bookingState.value.serviceBookings[index]
  if (sb?.date) {
    selectedDate.value = new Date(sb.date)
    currentMonth.value = new Date(sb.date)
    loadSlots()
  } else {
    selectedDate.value = null
  }
}

// Reload slots when switching service tabs
watch(activeServiceIndex, () => {
  const sb = bookingState.value.serviceBookings[activeServiceIndex.value]
  if (sb?.date) {
    selectedDate.value = new Date(sb.date)
    currentMonth.value = new Date(sb.date)
    loadSlots()
  } else {
    selectedDate.value = null
  }
})

onMounted(() => {
  if (bookingState.value.serviceBookings.length > 0) goToService(0)
})
</script>

<template>
  <div v-if="bookingState.serviceBookings.length > 0">
    <p class="text-slate-500 mb-6">
      Pick a date and time — only available slots are shown for your chosen employee
    </p>

    <!-- Service tabs -->
    <div v-if="bookingState.serviceBookings.length > 1" class="mb-6">
      <h3 class="text-base font-semibold text-slate-800 mb-3">Configure Date & Time for Each Service</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(service, index) in bookingState.serviceBookings"
          :key="service.serviceId"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeServiceIndex === index
              ? 'bg-navy-500 text-white'
              : service.date && service.time
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
          @click="goToService(index)"
        >
          {{ service.serviceName || `Service ${index + 1}` }}
          <span v-if="service.date && service.time" class="ml-1 text-xs">✓</span>
        </button>
      </div>
    </div>

    <!-- Active service info -->
    <div v-if="activeService" class="mb-6">
      <h4 class="text-lg font-semibold text-slate-800 mb-1">
        {{ activeService.serviceName || `Service ${activeServiceIndex + 1}` }}
      </h4>
      <div class="flex flex-wrap gap-3 text-sm text-slate-500">
        <span v-if="getServiceDetails(activeService.serviceId)">
          {{ Math.round(getDurationSeconds(activeService.serviceId) / 3600 * 10) / 10 }}h
          · ${{ getServiceDetails(activeService.serviceId)?.price }}
        </span>
        <span v-if="activeService.employeeName" class="text-navy-500 font-medium">
          👤 {{ activeService.employeeName }}
        </span>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-8">
      <!-- Calendar -->
      <div>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <!-- Calendar header -->
          <div class="flex items-center justify-between mb-4">
            <button class="p-2 text-slate-400 hover:text-navy-500 transition-colors rounded-lg hover:bg-slate-100" @click="navigateMonth(-1)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 class="text-base font-semibold text-slate-800">{{ monthYear }}</h3>
            <button class="p-2 text-slate-400 hover:text-navy-500 transition-colors rounded-lg hover:bg-slate-100" @click="navigateMonth(1)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Day labels -->
          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="day in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="day"
                 class="text-center text-xs font-medium text-slate-400 py-1">
              {{ day }}
            </div>
          </div>

          <!-- Days -->
          <div class="grid grid-cols-7 gap-1">
            <template v-for="(day, i) in daysInMonth" :key="i">
              <button
                v-if="day"
                :disabled="isPast(day)"
                :class="[
                  'aspect-square flex items-center justify-center text-sm rounded-lg transition-all min-h-[36px] min-w-[36px]',
                  isDateSelected(day)
                    ? 'bg-navy-500 text-white font-bold'
                    : isToday(day)
                      ? 'bg-navy-50 text-navy-500 font-medium ring-1 ring-navy-300'
                      : isPast(day)
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-200 cursor-pointer'
                ]"
                @click="selectDate(day)"
              >
                {{ day.getDate() }}
              </button>
              <div v-else class="aspect-square min-h-[36px]" />
            </template>
          </div>
        </div>
      </div>

      <!-- Time slots -->
      <div>
        <h3 class="text-base font-semibold text-slate-800 mb-3">
          Available Times
          <span v-if="activeService?.employeeName" class="text-sm font-normal text-slate-400 ml-1">
            for {{ activeService.employeeName }}
          </span>
        </h3>

        <div v-if="!activeService?.employeeId" class="text-center py-10 text-slate-400 text-sm">
          No employee selected for this service
        </div>

        <div v-else-if="!selectedDate" class="text-center py-10 text-slate-400 text-sm">
          Please select a date first
        </div>

        <div v-else-if="slotsPending" class="flex items-center justify-center py-10 gap-3 text-slate-400 text-sm">
          <svg class="w-5 h-5 animate-spin text-navy-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading slots…
        </div>

        <div v-else-if="!slots.length" class="text-center py-10 text-slate-400 text-sm">
          No available times on this date — try another day.
        </div>

        <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
          <button
            v-for="slot in slots"
            :key="slot.time"
            :disabled="!slot.available"
            :title="slot.available ? '' : (slot.reason || 'Not available')"
            :class="[
              'px-2 py-2 text-sm rounded-lg border transition-all text-center',
              isTimeSelected(slot.time)
                ? 'bg-navy-500 text-white border-navy-500 font-semibold'
                : slot.available
                  ? 'bg-white text-slate-700 border-slate-200 hover:border-navy-400 hover:text-navy-500 cursor-pointer'
                  : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through'
            ]"
            @click="selectTime(slot)"
          >
            {{ slot.time }}
          </button>
        </div>

        <!-- Legend -->
        <div v-if="slots.length" class="mt-3 flex items-center gap-4 text-xs text-slate-400">
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 rounded bg-white border border-slate-300 inline-block" />
            Available
          </span>
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" />
            Unavailable
          </span>
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 rounded bg-navy-500 inline-block" />
            Selected
          </span>
        </div>
      </div>
    </div>

    <!-- Service nav -->
    <div v-if="bookingState.serviceBookings.length > 1" class="flex justify-between mt-6 pt-4 border-t border-slate-200">
      <button
        v-if="activeServiceIndex > 0"
        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
        @click="goToService(activeServiceIndex - 1)"
      >
        ← Previous Service
      </button>
      <div v-else />
      <button
        v-if="activeServiceIndex < bookingState.serviceBookings.length - 1"
        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
        @click="goToService(activeServiceIndex + 1)"
      >
        Next Service →
      </button>
    </div>

    <!-- Summary -->
    <div v-if="bookingState.serviceBookings.some(sb => sb.date && sb.time)" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
      <h4 class="text-green-700 font-medium mb-2 text-sm">Scheduled Times:</h4>
      <div class="space-y-1">
        <div
          v-for="sb in bookingState.serviceBookings.filter(s => s.date && s.time)"
          :key="sb.serviceId"
          class="text-sm flex justify-between"
        >
          <span class="text-slate-700 font-medium">{{ sb.serviceName }}</span>
          <span class="text-slate-500">{{ sb.date }} at {{ sb.time }} <span class="text-navy-500">· {{ sb.employeeName }}</span></span>
        </div>
      </div>
    </div>
  </div>
</template>
