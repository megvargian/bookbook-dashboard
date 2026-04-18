<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState, updateServiceBooking, getServiceBooking } = useBookingFlow()

// ── Business hours ────────────────────────────────────────────────────────────
const { data: businessHours } = await useLazyFetch('/api/public-business-hours', {
  default: () => ({ opening_time: '09:00', closing_time: '18:00', open_days: [1, 2, 3, 4, 5] }),
  server: false,
  query: computed(() => ({ client_profile_id: bookingState.value.clientProfileId }))
})

// Parse "HH:MM" into { hour, minute }
const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return { hour: h, minute: m }
}

// Generate time slots based on business opening/closing times (30-min intervals)
const timeSlots = computed(() => {
  const open = parseTime(businessHours.value?.opening_time ?? '09:00')
  const close = parseTime(businessHours.value?.closing_time ?? '18:00')
  const slots: string[] = []
  let h = open.hour
  let m = open.minute
  while (h < close.hour || (h === close.hour && m < close.minute)) {
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    m += 30
    if (m >= 60) { h++; m = 0 }
  }
  return slots
})

// Returns true when a calendar date falls on a closed day
const isClosedDay = (date: Date) => {
  const openDays: number[] = businessHours.value?.open_days ?? [1, 2, 3, 4, 5]
  return !openDays.includes(date.getDay())
}

// Track which service is currently being configured
const activeServiceIndex = ref(0)
const activeService = computed(() => bookingState.value.serviceBookings[activeServiceIndex.value])

// Date state for the current service
const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())

// Fetch services data for display
const { data: services } = await useLazyFetch('/api/public-services', {
  default: () => [],
  server: false
})

// Get service details
const getServiceDetails = (serviceId: string) => {
  return services.value?.find(s => s.id === serviceId)
}

// Fetch existing bookings for availability check
const { data: existingBookings } = await useLazyFetch('/api/public-bookings-check', {
  default: () => [],
  server: false,
  query: computed(() => ({
    date: selectedDate.value ? formatDate(selectedDate.value) : null
  })),
  watch: [selectedDate]
})

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const isTimeSlotAvailable = (time: string, serviceId: string) => {
  if (!selectedDate.value || !existingBookings.value) return true

  const dateStr = formatDate(selectedDate.value)
  const serviceDetails = getServiceDetails(serviceId)
  const serviceDurationHours = serviceDetails?.duration_service_in_s ? serviceDetails.duration_service_in_s / 3600 : 1

  // Convert the time slot to minutes for comparison
  const [slotHour, slotMinute] = time.split(':').map(Number)
  const slotTimeInMinutes = slotHour * 60 + slotMinute
  const slotEndTimeInMinutes = slotTimeInMinutes + (serviceDurationHours * 60)

  return !existingBookings.value.some((booking: any) => {
    const bookingDate = booking.booking_date.split('T')[0]
    if (bookingDate !== dateStr) return false

    // Extract start and end times
    const startTime = booking.start_time.includes('T')
      ? booking.start_time.slice(11, 16)
      : booking.start_time.slice(0, 5)

    const endTime = booking.end_time.includes('T')
      ? booking.end_time.slice(11, 16)
      : booking.end_time.slice(0, 5)

    // Convert start and end times to minutes
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startTimeInMinutes = startHour * 60 + startMinute

    const [endHour, endMinute] = endTime.split(':').map(Number)
    const endTimeInMinutes = endHour * 60 + endMinute

    // Check if there's any overlap
    return (slotTimeInMinutes < endTimeInMinutes && slotEndTimeInMinutes > startTimeInMinutes)
  })
}

const selectTimeSlot = (time: string) => {
  if (!selectedDate.value || !activeService.value) return

  // Don't allow selecting unavailable time slots
  if (!isTimeSlotAvailable(time, activeService.value.serviceId)) return

  const dateStr = formatDate(selectedDate.value)
  updateServiceBooking(activeService.value.serviceId, {
    date: dateStr,
    time: time
  })
}

const isSelected = (time: string) => {
  if (!activeService.value || !selectedDate.value) return false
  const dateStr = formatDate(selectedDate.value)
  return activeService.value.time === time && activeService.value.date === dateStr
}

// Navigation between services
const goToService = (index: number) => {
  if (index >= 0 && index < bookingState.value.serviceBookings.length) {
    activeServiceIndex.value = index
    // Reset date picker to service's selected date or current date
    const serviceBooking = bookingState.value.serviceBookings[index]
    if (serviceBooking.date) {
      selectedDate.value = new Date(serviceBooking.date)
      currentMonth.value = new Date(serviceBooking.date)
    } else {
      selectedDate.value = null
      currentMonth.value = new Date()
    }
  }
}

// Calendar helpers
const daysInMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days = []
  const startPadding = firstDay.getDay() // 0 = Sunday

  // Add empty slots for padding
  for (let i = 0; i < startPadding; i++) {
    days.push(null)
  }

  // Add all days in the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day))
  }

  console.log('Generated days for calendar:', days.length, 'days')
  return days
})

const selectDate = (date: Date) => {
  if (isClosedDay(date)) return
  selectedDate.value = date
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isPast = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const isUnavailableDay = (date: Date) => isPast(date) || isClosedDay(date)

const isDateSelected = (date: Date) => {
  return selectedDate.value && date.toDateString() === selectedDate.value.toDateString()
}

const navigateMonth = (direction: number) => {
  const newMonth = new Date(currentMonth.value)
  newMonth.setMonth(newMonth.getMonth() + direction)
  currentMonth.value = newMonth
}

const monthYear = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Watch for changes in active service to update selected date
watch(activeServiceIndex, (newIndex) => {
  const serviceBooking = bookingState.value.serviceBookings[newIndex]
  if (serviceBooking?.date) {
    selectedDate.value = new Date(serviceBooking.date)
    currentMonth.value = new Date(serviceBooking.date)
  } else {
    selectedDate.value = null
  }
})

// Initialize with first service
onMounted(() => {
  console.log('StepDateTime mounted, serviceBookings:', bookingState.value.serviceBookings)
  if (bookingState.value.serviceBookings.length > 0) {
    goToService(0)
  }
})
</script>

<template>
  <div class="step-datetime" v-if="bookingState.serviceBookings.length > 0">
    <div class="step-description">
      <p class="text-gray-400 mb-6">Select a date and time for each service</p>
    </div>

    <!-- Service Navigation -->
    <div v-if="bookingState.serviceBookings.length > 1" class="mb-6">
      <h3 class="text-lg font-semibold text-white mb-3">Configure Date & Time for Each Service</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(service, index) in bookingState.serviceBookings"
          :key="service.serviceId"
          @click="goToService(index)"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeServiceIndex === index
              ? 'bg-blue-500 text-white'
              : service.date && service.time
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
      <h4 class="text-xl font-semibold text-white mb-2">
        {{ activeService.serviceName || `Service ${activeServiceIndex + 1}` }}
      </h4>
      <p v-if="getServiceDetails(activeService.serviceId)" class="text-gray-400 text-sm">
        Duration: {{ Math.round(getServiceDetails(activeService.serviceId)?.duration_service_in_s / 3600 * 10) / 10 }}h
        • Price: ${{ getServiceDetails(activeService.serviceId)?.price }}
      </p>
    </div>

    <div class="grid md:grid-cols-2 gap-8">
      <!-- Calendar -->
      <div class="calendar-section">
        <div class="bg-gray-700 rounded-lg p-4">
          <!-- Calendar Header -->
          <div class="flex items-center justify-between mb-4">
            <button
              @click="navigateMonth(-1)"
              class="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 class="text-lg font-semibold text-white">{{ monthYear }}</h3>
            <button
              @click="navigateMonth(1)"
              class="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Days of Week -->
          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day"
                 class="text-center text-sm font-medium text-gray-400 p-2">
              {{ day }}
            </div>
          </div>

          <!-- Calendar Days -->
          <div class="grid grid-cols-7 gap-1">
            <template v-for="(day, index) in daysInMonth" :key="index">
              <button
                v-if="day"
                @click="selectDate(day)"
                :disabled="isUnavailableDay(day)"
                :title="isClosedDay(day) ? 'Closed' : undefined"
                :class="[
                  'aspect-square calendar-day p-2 text-sm rounded-lg transition-all',
                  isDateSelected(day)
                    ? 'bg-blue-500 text-white font-bold'
                    : isClosedDay(day)
                      ? 'bg-red-900/20 text-red-700 cursor-not-allowed line-through'
                      : isToday(day)
                        ? 'bg-blue-500/20 text-blue-400 font-medium'
                        : isPast(day)
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-300 hover:bg-gray-600'
                ]"
              >
                {{ day.getDate() }}
              </button>
              <div v-else class="aspect-square"></div>
            </template>
          </div>
        </div>
      </div>

      <!-- Time Slots -->
      <div class="time-slots-section">
        <h3 class="text-lg font-semibold text-white mb-4">Available Times</h3>

        <div v-if="businessHours" class="text-xs text-gray-500 mb-3">
          Hours: {{ businessHours.opening_time }} – {{ businessHours.closing_time }}
        </div>

        <div v-if="!selectedDate" class="text-center py-8 text-gray-400">
          Please select an available date
        </div>

        <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
          <button
            v-for="time in timeSlots"
            :key="time"
            @click="selectTimeSlot(time)"
            :disabled="!isTimeSlotAvailable(time, activeService.serviceId)"
            :class="[
              'px-3 py-2 text-sm rounded-lg transition-all',
              isSelected(time)
                ? 'bg-blue-500 text-white font-semibold'
                : isTimeSlotAvailable(time, activeService.serviceId)
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed line-through'
            ]"
          >
            {{ time }}
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation within services -->
    <div v-if="bookingState.serviceBookings.length > 1" class="flex justify-between mt-6 pt-4 border-t border-gray-700">
      <button
        v-if="activeServiceIndex > 0"
        @click="goToService(activeServiceIndex - 1)"
        class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
      >
        ← Previous Service
      </button>
      <div v-else></div>

      <button
        v-if="activeServiceIndex < bookingState.serviceBookings.length - 1"
        @click="goToService(activeServiceIndex + 1)"
        class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
      >
        Next Service →
      </button>
    </div>

    <!-- Summary -->
    <div v-if="bookingState.serviceBookings.some(sb => sb.date && sb.time)" class="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
      <h4 class="text-green-400 font-medium mb-2">Selected Times:</h4>
      <div class="space-y-1">
        <div v-for="service in bookingState.serviceBookings.filter(sb => sb.date && sb.time)" :key="service.serviceId"
             class="text-sm text-gray-300">
          <span class="text-white font-medium">{{ service.serviceName }}</span>:
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
