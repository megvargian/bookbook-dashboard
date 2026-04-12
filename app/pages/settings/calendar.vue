<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import type { Booking, CreateBookingData } from '~/types/booking'
import { z } from 'zod'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

await userStore.fetchClientProfile()

const isAdmin = computed(() => userStore.clientProfile?.role === 'admin' && userStore.clientProfile?.user_type === 'client')
const isEmployee = computed(() => userStore.clientProfile?.user_type === 'employee')

if (!isAdmin.value && !isEmployee.value) {
  throw createError({ statusCode: 403, statusMessage: 'Access denied. Admin or employee access required.' })
}

const { data: bookings, refresh: refreshBookings } = await useFetch<Booking[]>('/api/bookings', { default: () => [] })
const { data: employees } = await useFetch('/api/employees', { default: () => [] })
const { data: services } = await useFetch('/api/services', { default: () => [] })
const { data: clients } = await useFetch('/api/customers', { default: () => [] })

const showCreateModal = ref(false)
const loading = ref(false)

const bookingSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  service_id: z.string().min(1, 'Service is required'),
  booking_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Time is required'),
  notes: z.string().optional()
})

const newBooking = ref<CreateBookingData>({
  client_id: '',
  employee_id: '',
  service_id: '',
  booking_date: '',
  start_time: '',
  notes: ''
})

const currentDate = ref(new Date())
const selectedDate = ref(new Date())

const formatTimeFromTimestamp = (timestamp: string) => {
  if (!timestamp) return ''
  if (timestamp.includes('T')) {
    return new Date(timestamp).toTimeString().slice(0, 5)
  }
  return timestamp
}

// ── Main calendar ──────────────────────────────────────────
const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

// Monday-first offset
const firstDayOfWeek = computed(() => {
  const day = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1).getDay()
  return day === 0 ? 6 : day - 1
})

const monthName = computed(() =>
  currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const calendarDays = computed(() => {
  const days: { date: number; isCurrentMonth: boolean; fullDate: Date }[] = []
  const totalCells = 42

  // Previous month's trailing days
  for (let i = firstDayOfWeek.value - 1; i >= 0; i--) {
    const prevMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 0)
    days.push({
      date: prevMonth.getDate() - i,
      isCurrentMonth: false,
      fullDate: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate() - i)
    })
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth.value; day++) {
    days.push({
      date: day,
      isCurrentMonth: true,
      fullDate: new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), day)
    })
  }

  // Next month's leading days
  const remainingCells = totalCells - days.length
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, day)
    days.push({
      date: day,
      isCurrentMonth: false,
      fullDate: nextMonth
    })
  }

  return days
})

const bookingsForDate = (date: Date | null) => {
  if (!date || !bookings.value) return []
  const dateString = date.toISOString().split('T')[0]
  return bookings.value.filter(booking => booking.booking_date === dateString)
}

const isToday = (date: Date | null) => {
  if (!date) return false
  return date.toDateString() === new Date().toDateString()
}

const isSelected = (date: Date | null) => {
  if (!date) return false
  return date.toDateString() === selectedDate.value.toDateString()
}

const previousMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

const selectDate = (date: Date | null) => {
  if (!date) return
  selectedDate.value = date
  // Sync main calendar to same month
  currentDate.value = new Date(date.getFullYear(), date.getMonth(), 1)
  if (isAdmin.value) {
    newBooking.value.booking_date = date.toISOString().split('T')[0]
  }
}

// ── Mini calendar ──────────────────────────────────────────
const miniCalDate = ref(new Date())

const miniCalMonthName = computed(() =>
  miniCalDate.value.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
)

const miniCalDays = computed(() => {
  const year = miniCalDate.value.getFullYear()
  const month = miniCalDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMon = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMon; d++) cells.push(new Date(year, month, d))
  return cells
})

const prevMiniMonth = () => {
  miniCalDate.value = new Date(miniCalDate.value.getFullYear(), miniCalDate.value.getMonth() - 1, 1)
}

const nextMiniMonth = () => {
  miniCalDate.value = new Date(miniCalDate.value.getFullYear(), miniCalDate.value.getMonth() + 1, 1)
}

const hasBookings = (date: Date | null) => {
  if (!date || !bookings.value) return false
  const ds = date.toISOString().split('T')[0]
  return bookings.value.some(b => b.booking_date === ds)
}

// ── Booking CRUD ──────────────────────────────────────────
const openCreateModal = (date?: Date) => {
  if (!isAdmin.value) return
  if (date) selectDate(date)
  showCreateModal.value = true
}

const resetForm = () => {
  newBooking.value = {
    client_id: '',
    employee_id: '',
    service_id: '',
    booking_date: selectedDate.value.toISOString().split('T')[0],
    start_time: '',
    notes: ''
  }
}

const createBooking = async () => {
  if (!isAdmin.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    // Create payload with time in HH:MM format (backend will convert to timestamptz)
    const bookingPayload = {
      ...newBooking.value,
      start_time: newBooking.value.start_time // Keep as HH:MM, backend handles conversion
    }

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(bookingPayload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to create booking')
    }

    toast.add({
      title: 'Success',
      description: 'Booking created successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showCreateModal.value = false
    resetForm()
    await refreshBookings()
  } catch (error) {
    console.error('Error creating booking:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to create booking',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Initialize form when modal opens
watch(showCreateModal, (isOpen) => {
  if (isOpen) resetForm()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-navy-500 dark:text-navy-300">Calendar</h2>
        <p class="text-sm text-slate-400 dark:text-gray-400 mt-0.5">
          {{ isAdmin ? 'View and manage bookings' : 'View your assigned bookings' }}
        </p>
      </div>
      <div class="flex gap-2">
        <UButton variant="outline" size="sm" icon="i-lucide-download" color="neutral">
          Export
        </UButton>
        <UButton
          v-if="isAdmin"
          size="sm"
          icon="i-lucide-plus"
          color="primary"
          @click="openCreateModal()"
        >
          Add Event
        </UButton>
      </div>
    </div>

    <!-- Two-column layout: mini cal + filter | main calendar -->
    <div class="flex gap-3">
      <!-- ── LEFT: Mini calendar + staff filter ────────────── -->
      <div class="w-52 flex-shrink-0 flex flex-col gap-3">
        <!-- Mini Calendar Card -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-3">
          <!-- Month nav -->
          <div class="flex items-center justify-between mb-2.5">
            <button
              class="w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 dark:text-gray-400 text-xs transition-all hover:bg-navy-500 hover:text-white hover:border-navy-500"
              @click="prevMiniMonth"
            >
              ‹
            </button>
            <span class="text-xs font-semibold text-navy-500 dark:text-navy-300">{{ miniCalMonthName }}</span>
            <button
              class="w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 dark:text-gray-400 text-xs transition-all hover:bg-navy-500 hover:text-white hover:border-navy-500"
              @click="nextMiniMonth"
            >
              ›
            </button>
          </div>

          <!-- Day headers Mo Tu We Th Fr Sa Su -->
          <div class="grid grid-cols-7 mb-0.5">
            <div
              v-for="d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']"
              :key="d"
              class="w-6 text-center text-[8px] font-bold text-slate-400 dark:text-gray-500 uppercase py-0.5"
            >
              {{ d }}
            </div>
          </div>

          <!-- Day cells -->
          <div class="grid grid-cols-7" style="gap:1px">
            <template v-for="(date, i) in miniCalDays" :key="i">
              <div v-if="!date" class="w-6 h-6" />
              <button
                v-else
                class="relative w-6 h-6 flex items-center justify-center rounded-[5px] text-[10px] font-medium transition-all"
                :class="[
                  isSelected(date)
                    ? 'bg-navy-500 text-white font-bold'
                    : isToday(date)
                      ? 'text-navy-500 dark:text-navy-300 font-bold hover:bg-slate-100 dark:hover:bg-gray-800'
                      : 'text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-navy-500'
                ]"
                @click="selectDate(date)"
              >
                {{ date.getDate() }}
                <span
                  v-if="isToday(date) && !isSelected(date)"
                  class="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-navy-500"
                />
                <span
                  v-if="isToday(date) && isSelected(date)"
                  class="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-white"
                />
                <span
                  v-if="hasBookings(date) && !isSelected(date)"
                  class="absolute top-[2px] right-[2px] w-[3px] h-[3px] rounded-full bg-navy-400"
                />
              </button>
            </template>
          </div>
        </div>

        <!-- Filter by staff -->
        <div
          v-if="isAdmin && employees && (employees as any[]).length"
          class="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-3"
        >
          <p class="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-2.5">
            Filter by staff
          </p>
          <div
            v-for="emp in (employees as any[])"
            :key="emp.id"
            class="flex items-center gap-2 py-1 cursor-pointer"
          >
            <div class="w-3.5 h-3.5 rounded-sm border-2 border-navy-500 bg-navy-500 flex items-center justify-center flex-shrink-0">
              <span class="text-white text-[7px] font-bold">✓</span>
            </div>
            <div class="w-2 h-2 rounded-full bg-navy-400 flex-shrink-0" />
            <span class="text-xs font-medium text-slate-700 dark:text-gray-200 flex-1 truncate">
              {{ emp.first_name }} {{ emp.last_name?.charAt(0) }}.
            </span>
          </div>
        </div>
      </div>

      <!-- ── RIGHT: Main calendar ────────────────────────── -->
      <div class="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
        <!-- Toolbar -->
        <div class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
          <button
            class="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
            @click="selectDate(new Date())"
          >
            Today
          </button>
          <button
            class="w-7 h-7 rounded-md border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 dark:text-gray-400 text-sm transition-all hover:bg-navy-500 hover:text-white hover:border-navy-500"
            @click="previousMonth"
          >
            ‹
          </button>
          <button
            class="w-7 h-7 rounded-md border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 dark:text-gray-400 text-sm transition-all hover:bg-navy-500 hover:text-white hover:border-navy-500"
            @click="nextMonth"
          >
            ›
          </button>
          <span class="text-[15px] font-semibold text-navy-500 dark:text-navy-300 ml-1">{{ monthName }}</span>
        </div>

        <!-- Week day headers: Mon–Sun -->
        <div class="grid grid-cols-7 border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 flex-shrink-0">
          <div
            v-for="day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']"
            :key="day"
            class="p-2 text-center text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider"
          >
            {{ day }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="overflow-auto">
          <div class="grid grid-cols-7" style="grid-auto-rows: minmax(88px, 1fr)">
            <div
              v-for="(day, index) in calendarDays"
              :key="index"
              class="bg-white dark:bg-gray-900 border-r border-b border-slate-100 dark:border-gray-700/40 p-1.5 cursor-pointer transition-colors overflow-hidden"
              :class="[
                !day.isCurrentMonth ? '!bg-slate-50 dark:!bg-gray-800/40' : 'hover:!bg-slate-50 dark:hover:!bg-gray-800',
                isSelected(day.fullDate) && day.isCurrentMonth ? 'ring-2 ring-inset ring-navy-500' : ''
              ]"
              @click="selectDate(day.fullDate)"
              @dblclick="openCreateModal(day.fullDate)"
            >
              <!-- Date number -->
              <div
                class="mb-1 w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-semibold"
                :class="[
                  !day.isCurrentMonth ? 'text-slate-300 dark:text-gray-600' : 'text-slate-700 dark:text-navy-200',
                  isToday(day.fullDate) ? '!bg-navy-500 !text-white' : ''
                ]"
              >
                {{ day.date }}
              </div>

              <!-- Booking pills -->
              <div class="space-y-px">
                <div
                  v-for="booking in bookingsForDate(day.fullDate).slice(0, 2)"
                  :key="booking.id"
                  class="text-[10px] font-semibold px-1.5 py-px rounded truncate bg-navy-50 text-navy-500 border-l-2 border-navy-500 dark:bg-navy-500/20 dark:text-navy-200 dark:border-navy-400"
                >
                  {{ formatTimeFromTimestamp(booking.start_time) }} · {{ booking.service?.name }}
                </div>
                <div
                  v-if="bookingsForDate(day.fullDate).length > 2"
                  class="text-[10px] font-semibold text-navy-500 dark:text-navy-300 pl-1"
                >
                  +{{ bookingsForDate(day.fullDate).length - 2 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected date bookings list -->
    <div
      v-if="bookingsForDate(selectedDate).length"
      class="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-4"
    >
      <h3 class="text-sm font-semibold text-navy-500 dark:text-navy-300 mb-3">
        Bookings for {{ selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </h3>
      <div class="grid gap-2">
        <div
          v-for="booking in bookingsForDate(selectedDate)"
          :key="booking.id"
          class="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-gray-700/50 bg-slate-50 dark:bg-gray-800"
        >
          <div>
            <p class="text-sm font-semibold text-slate-800 dark:text-gray-100">{{ booking.service?.name }}</p>
            <p class="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              {{ formatTimeFromTimestamp(booking.start_time) }}–{{ formatTimeFromTimestamp(booking.end_time) }}
              · {{ booking.client_profile?.first_name }} {{ booking.client_profile?.last_name }}
              · {{ booking.employee?.first_name }} {{ booking.employee?.last_name }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-navy-500 dark:text-navy-300">${{ booking.total_price }}</span>
            <span
              class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
              :class="[
                booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                booking.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                booking.status === 'completed' ? 'bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400' :
                booking.status === 'cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : ''
              ]"
            >
              {{ booking.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Booking Modal -->
    <UModal v-if="isAdmin" v-model="showCreateModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold">Create New Booking</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              @click="showCreateModal = false"
            />
          </div>
        </template>

        <UForm :schema="bookingSchema" :state="newBooking" class="space-y-4" @submit="createBooking">
          <UFormField name="client_id" label="Client" required>
            <USelectMenu
              v-model="newBooking.client_id"
              :options="(clients as any[]).map(c => ({ label: `${c.first_name} ${c.last_name}`, value: c.id }))"
              placeholder="Select client"
            />
          </UFormField>

          <UFormField name="service_id" label="Service" required>
            <USelectMenu
              v-model="newBooking.service_id"
              :options="(services as any[]).map(s => ({ label: `${s.name} - $${s.price}`, value: s.id }))"
              placeholder="Select service"
            />
          </UFormField>

          <UFormField name="employee_id" label="Employee" required>
            <USelectMenu
              v-model="newBooking.employee_id"
              :options="(employees as any[]).map(e => ({ label: `${e.first_name} ${e.last_name}`, value: e.id }))"
              placeholder="Select employee"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="booking_date" label="Date" required>
              <UInput v-model="newBooking.booking_date" type="date" />
            </UFormField>
            <UFormField name="start_time" label="Start Time" required>
              <UInput v-model="newBooking.start_time" type="time" />
            </UFormField>
          </div>

          <UFormField name="notes" label="Notes">
            <UTextarea v-model="newBooking.notes" placeholder="Additional notes or instructions" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton type="button" variant="outline" @click="showCreateModal = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="loading">
              Create Booking
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>
  </div>
</template>
