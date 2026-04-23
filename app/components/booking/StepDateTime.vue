<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState, updateServiceBooking } = useBookingFlow()

// ── Business hours (time slot range only) ───────────────────────────────
const { data: businessHours } = await useLazyFetch('/api/public-business-hours', {
  default: () => ({ opening_time: '09:00', closing_time: '18:00', open_days: [1, 2, 3, 4, 5] }),
  server: false,
  query: computed(() => ({ client_profile_id: bookingState.value.clientProfileId }))
})

// Generate time slots based on business opening/closing times (30-min intervals)
const timeSlots = computed(() => {
  const raw = businessHours.value ?? { opening_time: '09:00', closing_time: '18:00' }
  const openParts = raw.opening_time.split(':')
  const closeParts = raw.closing_time.split(':')
  const slots: string[] = []
  let h = parseInt(openParts[0] ?? '9', 10)
  let m = parseInt(openParts[1] ?? '0', 10)
  const closeH = parseInt(closeParts[0] ?? '18', 10)
  const closeM = parseInt(closeParts[1] ?? '0', 10)
  while (h < closeH || (h === closeH && m < closeM)) {
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    m += 30
    if (m >= 60) {
      h++
      m = 0
    }
  }
  return slots
})

// ── Service / active state ──────────────────────────────────────────────
const activeServiceIndex = ref(0)
const activeService = computed(() => bookingState.value.serviceBookings[activeServiceIndex.value])

const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())

const { data: services } = await useLazyFetch('/api/public-services', {
  default: () => [],
  server: false
})

const getServiceDetails = (serviceId: string) => {
  return (services.value as any[])?.find((s: any) => s.id === serviceId)
}

const formatDate = (date: Date) => {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

// ── Time slot selection (no restrictions — employee availability checked in next step) ──
const selectTimeSlot = (time: string) => {
  if (!selectedDate.value || !activeService.value) return
  updateServiceBooking(activeService.value.serviceId, {
    date: formatDate(selectedDate.value),
    time
  })
}

const isSelected = (time: string) => {
  if (!activeService.value || !selectedDate.value) return false
  return activeService.value.time === time && activeService.value.date === formatDate(selectedDate.value)
}

// ── Service navigation ──────────────────────────────────────────────────
const goToService = (index: number) => {
  if (index >= 0 && index < bookingState.value.serviceBookings.length) {
    activeServiceIndex.value = index
    const sb = bookingState.value.serviceBookings[index]
    if (sb?.date) {
      selectedDate.value = new Date(sb.date)
      currentMonth.value = new Date(sb.date)
    } else {
      selectedDate.value = null
      currentMonth.value = new Date()
    }
  }
}

// ── Calendar helpers ────────────────────────────────────────────────────
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

const selectDate = (date: Date) => {
  if (isPast(date)) return
  // Clear time if date changes
  if (selectedDate.value && formatDate(selectedDate.value) !== formatDate(date)) {
    if (activeService.value) updateServiceBooking(activeService.value.serviceId, { time: '' })
  }
  selectedDate.value = date
}

const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

const isPast = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const isDateSelected = (date: Date) => selectedDate.value?.toDateString() === date.toDateString()

const navigateMonth = (direction: number) => {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + direction)
  currentMonth.value = d
}

const monthYear = computed(() =>
  currentMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

watch(activeServiceIndex, (newIndex) => {
  const sb = bookingState.value.serviceBookings[newIndex]
  if (sb?.date) {
    selectedDate.value = new Date(sb.date)
    currentMonth.value = new Date(sb.date)
  } else {
    selectedDate.value = null
  }
})

onMounted(() => {
  if (bookingState.value.serviceBookings.length > 0) goToService(0)
})
</script>

<template>
  <div class="step-datetime" v-if="bookingState.serviceBookings.length > 0">
    <div class="step-description">
      <p class="text-white mb-6">Select a date and time for each service</p>
    </div>

    <!-- Service Navigation -->
    <div v-if="bookingState.serviceBookings.length > 1" class="mb-6">
      <h3 class="text-lg font-semibold text-slate-800 mb-3">Configure Date & Time for Each Service</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(service, index) in bookingState.serviceBookings"
          :key="service.serviceId"
          @click="goToService(index)"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeServiceIndex === index
              ? 'bg-navy-500 text-white'
              : service.date && service.time
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
        >
          {{ service.serviceName || `Service ${index + 1}` }}
          <span v-if="service.date && service.time" class="ml-2 text-xs">
            ✓
          </span>
        </button>
      </div>
    </div>

    <!-- Current Service -->
    <div v-if="activeService" class="mb-6">
      <h4 class="text-xl font-semibold text-slate-800 mb-2">
        {{ activeService.serviceName || `Service ${activeServiceIndex + 1}` }}
      </h4>
      <p v-if="getServiceDetails(activeService.serviceId)" class="text-white text-sm">
        Duration: {{ Math.round(getServiceDetails(activeService.serviceId)?.duration_service_in_s / 3600 * 10) / 10 }}h
        • Price: ${{ getServiceDetails(activeService.serviceId)?.price }}
      </p>
    </div>

    <div class="grid md:grid-cols-2 gap-8">
      <!-- Calendar -->
      <div class="calendar-section">
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <!-- Calendar Header -->
          <div class="flex items-center justify-between mb-4">
            <button
              @click="navigateMonth(-1)"
              class="p-2 text-slate-400 hover:text-navy-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 class="text-lg font-semibold text-slate-800">{{ monthYear }}</h3>
            <button
              @click="navigateMonth(1)"
              class="p-2 text-slate-400 hover:text-navy-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Days of Week -->
          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day"
                 class="text-center text-xs font-medium text-slate-400 p-2">
              {{ day }}
            </div>
          </div>

          <!-- Calendar Days -->
          <div class="grid grid-cols-7 gap-1">
            <template v-for="(day, index) in daysInMonth" :key="index">
              <button
                v-if="day"
                @click="selectDate(day)"
                :disabled="isPast(day)"
                :class="[
                  'aspect-square calendar-day p-2 text-sm rounded-lg transition-all',
                  isDateSelected(day)
                    ? 'bg-navy-500 text-white font-bold'
                    : isToday(day)
                      ? 'bg-navy-50 text-navy-500 font-medium'
                      : isPast(day)
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-200'
                ]"
              >
                {{ day.getDate() }}
              </button>
              <div v-else class="aspect-square" />
            </template>
          </div>
        </div>
      </div>

      <!-- Time Slots -->
      <div class="time-slots-section">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">Available Times</h3>

        <div v-if="businessHours" class="text-xs text-white mb-3">
          Hours: {{ businessHours.opening_time }} – {{ businessHours.closing_time }}
        </div>

        <div v-if="!selectedDate" class="text-center py-8 text-white">
          Please select a date
        </div>

        <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
          <button
            v-for="time in timeSlots"
            :key="time"
            @click="selectTimeSlot(time)"
            :class="[
              'px-3 py-2 text-sm rounded-lg transition-all border',
              isSelected(time)
                ? 'bg-navy-500 text-white font-semibold border-navy-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:text-navy-500'
            ]"
          >
            {{ time }}
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation within services -->
    <div v-if="bookingState.serviceBookings.length > 1" class="flex justify-between mt-6 pt-4 border-t border-slate-200">
      <button
        v-if="activeServiceIndex > 0"
        @click="goToService(activeServiceIndex - 1)"
        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
      >
        ← Previous Service
      </button>
      <div v-else />

      <button
        v-if="activeServiceIndex < bookingState.serviceBookings.length - 1"
        @click="goToService(activeServiceIndex + 1)"
        class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
      >
        Next Service →
      </button>
    </div>

    <!-- Summary -->
    <div v-if="bookingState.serviceBookings.some(sb => sb.date && sb.time)" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
      <h4 class="text-green-700 font-medium mb-2">Selected Times:</h4>
      <div class="space-y-1">
        <div v-for="service in bookingState.serviceBookings.filter(sb => sb.date && sb.time)" :key="service.serviceId"
             class="text-sm text-slate-600">
          <span class="text-slate-800 font-medium">{{ service.serviceName }}</span>:
          {{ service.date }} at {{ service.time }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aspect-square {
  aspect-ratio: 1 / 1;
  min-height: 40px;
  min-width: 40px;
}

/* Ensure calendar days are always visible */
.calendar-day {
  min-height: 40px;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
