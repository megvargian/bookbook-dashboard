<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import type { Booking } from '~/types/booking'

definePageMeta({ title: 'Appointments' })

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

await userStore.fetchClientProfile()

// Admin-only
if (userStore.clientProfile?.role !== 'admin') {
  throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
}

const { data: { session } } = await supabase.auth.getSession()
if (!session) throw createError({ statusCode: 401, statusMessage: 'No active session' })

const authHeaders = { Authorization: `Bearer ${session.access_token}` }

const { data: bookings, refresh: refreshBookings } = await useFetch<Booking[]>('/api/bookings', {
  default: () => [],
  headers: authHeaders
})
const { data: employees } = await useFetch<any[]>('/api/employees', { default: () => [], headers: authHeaders })
const { data: services } = await useFetch<any[]>('/api/services', { default: () => [], headers: authHeaders })
const { data: customers } = await useFetch<any[]>('/api/customers', { default: () => [], headers: authHeaders })

// ── Filters ────────────────────────────────────────────────
const searchQuery = ref('')
const statusFilter = ref<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all')
const dateFilter = ref('')

const statusTabs = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' }
] as const

const filteredBookings = computed(() => {
  let list = (bookings.value as Booking[]) ?? []

  // Status filter
  if (statusFilter.value !== 'all') {
    list = list.filter(b => b.status === statusFilter.value)
  }

  // Date filter
  if (dateFilter.value) {
    list = list.filter(b => {
      const bDate = b.booking_date.includes('T') ? b.booking_date.split('T')[0] : b.booking_date
      return bDate === dateFilter.value
    })
  }

  // Search by client name or phone (from client_profile or raw customer)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((b) => {
      const fullName = `${b.client_profile?.first_name ?? ''} ${b.client_profile?.last_name ?? ''}`.toLowerCase()
      // Try to find phone in customers list
      const cust = (customers.value as any[]).find(c => c.id === b.customer_id)
      const phone = (cust?.phone_number ?? '').toLowerCase()
      return fullName.includes(q) || phone.includes(q)
    })
  }

  return list
})

// ── Helpers ────────────────────────────────────────────────
const extractTime = (ts: string) => {
  if (!ts) return ''
  if (ts.includes('T')) return ts.slice(11, 16)
  return ts.slice(0, 5)
}

const formatBookingDate = (dateStr: string, timeStr: string) => {
  const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const t = extractTime(timeStr)
  const date = new Date(`${d}T${t}:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const getDurationMin = (b: Booking) => {
  if (b.service?.duration_service_in_s) return Math.round(b.service.duration_service_in_s / 60)
  if (b.start_time && b.end_time) {
    const diff = new Date(b.end_time).getTime() - new Date(b.start_time).getTime()
    return Math.round(diff / 60000)
  }
  return null
}

const statusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
    case 'pending': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
    case 'completed': return 'text-slate-500 bg-slate-100 dark:bg-gray-700 dark:text-gray-400'
    case 'cancelled': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
    default: return 'text-slate-500 bg-slate-100'
  }
}

const serviceColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-emerald-400'
    case 'pending': return 'bg-amber-400'
    case 'completed': return 'bg-slate-400'
    case 'cancelled': return 'bg-red-400'
    default: return 'bg-blue-400'
  }
}

// ── Edit modal ─────────────────────────────────────────────
const showEditModal = ref(false)
const loading = ref(false)
const editingBooking = ref<Booking | null>(null)

const editForm = ref({
  employee_id: '',
  service_id: '',
  booking_date: '',
  start_time: '',
  status: '' as Booking['status'],
  notes: ''
})

const openEdit = (b: Booking) => {
  editingBooking.value = b
  editForm.value = {
    employee_id: b.employee_id,
    service_id: b.service_id,
    booking_date: b.booking_date.includes('T') ? b.booking_date.split('T')[0] : b.booking_date,
    start_time: extractTime(b.start_time),
    status: b.status,
    notes: b.notes ?? ''
  }
  showEditModal.value = true
}

const closeEdit = () => {
  showEditModal.value = false
  editingBooking.value = null
}

const saveEdit = async () => {
  if (!editingBooking.value) return
  loading.value = true
  try {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s) throw new Error('No session')

    await $fetch(`/api/bookings?id=${editingBooking.value.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s.access_token}` },
      body: {
        employee_id: editForm.value.employee_id,
        service_id: editForm.value.service_id,
        booking_date: editForm.value.booking_date,
        start_time: editForm.value.start_time,
        status: editForm.value.status,
        notes: editForm.value.notes
      }
    })

    toast.add({ title: 'Booking updated', icon: 'i-lucide-check', color: 'success' })
    closeEdit()
    await refreshBookings()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message ?? 'Update failed', color: 'error' })
  } finally {
    loading.value = false
  }
}

const cancelBooking = async (b: Booking) => {
  loading.value = true
  try {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s) throw new Error('No session')

    await $fetch(`/api/bookings?id=${b.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s.access_token}` },
      body: { status: 'cancelled' }
    })

    toast.add({ title: 'Booking cancelled', icon: 'i-lucide-check', color: 'success' })
    await refreshBookings()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message ?? 'Failed to cancel', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── Export ─────────────────────────────────────────────────
const exportCSV = () => {
  const rows = [
    ['Client', 'Phone', 'Service', 'Employee', 'Date & Time', 'Duration (min)', 'Amount', 'Status'],
    ...filteredBookings.value.map(b => [
      `${b.client_profile?.first_name ?? ''} ${b.client_profile?.last_name ?? ''}`.trim(),
      (customers.value as any[]).find(c => c.id === b.customer_id)?.phone_number ?? '',
      b.service?.name ?? '',
      `${b.employee?.first_name ?? ''} ${b.employee?.last_name ?? ''}`.trim(),
      formatBookingDate(b.booking_date, b.start_time),
      getDurationMin(b) ?? '',
      b.total_price ?? '',
      b.status
    ])
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'appointments.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Appointments">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton variant="outline" size="sm" icon="i-lucide-download" color="neutral" @click="exportCSV">
            Export
          </UButton>
          <UButton size="sm" icon="i-lucide-plus" color="primary" @click="showEditModal = true; editingBooking = null; editForm = { employee_id: '', service_id: '', booking_date: '', start_time: '', status: 'pending', notes: '' }">
            New Appointment
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-6">
        <!-- Page title -->
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
            Appointments
          </h2>
          <p class="text-sm text-slate-400 dark:text-gray-400 mt-0.5">
            Full booking management
          </p>
        </div>

        <!-- Search + Date filter row -->
        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search client, service, employee..."
              class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
          </div>
          <input
            v-model="dateFilter"
            type="date"
            class="px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
          <button
            v-if="dateFilter"
            class="text-xs text-slate-400 hover:text-slate-600 px-2"
            @click="dateFilter = ''"
          >
            Clear
          </button>
        </div>

        <!-- Status tabs -->
        <div class="flex items-center gap-1">
          <button
            v-for="tab in statusTabs"
            :key="tab.key"
            class="px-4 py-1.5 text-sm font-medium rounded-full border transition-all"
            :class="[
              statusFilter === tab.key
                ? 'bg-navy-500 text-white border-navy-500'
                : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:border-navy-400'
            ]"
            @click="statusFilter = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Table -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <!-- Table header -->
          <div class="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Client</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Service</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Employee</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Date &amp; Time</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Duration</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Amount</span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Actions</span>
          </div>

          <!-- Empty state -->
          <div v-if="!filteredBookings.length" class="py-16 text-center text-slate-400 dark:text-gray-500 text-sm">
            No appointments found.
          </div>

          <!-- Rows -->
          <div
            v-for="booking in filteredBookings"
            :key="booking.id"
            class="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-slate-100 dark:border-gray-800 last:border-0 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors"
          >
            <!-- Client -->
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-gray-100">
                {{ booking.client_profile?.first_name }} {{ booking.client_profile?.last_name }}
              </p>
              <p class="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                {{ (customers as any[]).find(c => c.id === booking.customer_id)?.phone_number ?? '' }}
              </p>
            </div>

            <!-- Service -->
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="serviceColor(booking.status)"
              />
              <span class="text-sm text-slate-700 dark:text-gray-200">{{ booking.service?.name ?? '—' }}</span>
            </div>

            <!-- Employee -->
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {{ (booking.employee?.full_name ?? '?').charAt(0) }}
              </div>
              <span class="text-sm text-slate-700 dark:text-gray-200 truncate">
                {{ booking.employee?.full_name }}
              </span>
            </div>

            <!-- Date & Time -->
            <div class="text-sm text-slate-700 dark:text-gray-200">
              {{ formatBookingDate(booking.booking_date, booking.start_time) }}
            </div>

            <!-- Duration -->
            <div class="text-sm font-medium text-blue-500 dark:text-blue-400">
              {{ getDurationMin(booking) !== null ? `${getDurationMin(booking)} min` : '—' }}
            </div>

            <!-- Amount -->
            <div class="text-sm font-bold text-slate-800 dark:text-gray-100">
              ${{ booking.total_price ?? '—' }}
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1">
              <!-- Status badge -->
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize mr-1"
                :class="statusColor(booking.status)"
              >
                {{ booking.status === 'completed' ? 'Done' : booking.status }}
              </span>
              <button
                class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-all"
                title="Edit"
                @click="openEdit(booking)"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
              </button>
              <button
                class="w-7 h-7 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-400 transition-all"
                title="Cancel"
                :disabled="booking.status === 'cancelled'"
                @click="cancelBooking(booking)"
              >
                <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Edit / Create modal -->
  <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="closeEdit" />
    <div class="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
      <!-- Modal header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ editingBooking ? 'Edit Appointment' : 'New Appointment' }}
        </h3>
        <button
          class="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
          @click="closeEdit"
        >
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-5">
        <!-- Date -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Date</label>
          <input
            v-model="editForm.booking_date"
            type="date"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>

        <!-- Time -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Time</label>
          <input
            v-model="editForm.start_time"
            type="time"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>

        <!-- Employee -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Employee</label>
          <select
            v-model="editForm.employee_id"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-navy-500 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
            <option value="" class="text-slate-400">
              Select employee
            </option>
            <option v-for="emp in (employees as any[])" :key="emp.id" :value="emp.id" class="text-navy-500 dark:text-gray-200">
              {{ emp.full_name || emp.email }}
            </option>
          </select>
        </div>

        <!-- Service -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Service</label>
          <select
            v-model="editForm.service_id"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
            <option value="">
              Select service
            </option>
            <option v-for="svc in (services as any[])" :key="svc.id" :value="svc.id">
              {{ svc.name }} — ${{ svc.price }}
            </option>
          </select>
        </div>

        <!-- Status -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Status</label>
          <select
            v-model="editForm.status"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Notes</label>
          <textarea
            v-model="editForm.notes"
            rows="3"
            placeholder="Optional notes..."
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
          />
        </div>
      </div>

      <!-- Modal footer -->
      <div class="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-gray-700 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all"
          @click="closeEdit"
        >
          Cancel
        </button>
        <button
          class="px-5 py-2 text-sm font-semibold bg-navy-500 hover:bg-navy-600 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-60"
          :disabled="loading"
          @click="saveEdit"
        >
          <UIcon v-if="loading" name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>
