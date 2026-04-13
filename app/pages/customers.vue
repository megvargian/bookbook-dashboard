<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import type { Customer } from '~/types'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

// Wait for user store to initialize
await userStore.fetchClientProfile()

// Check if user is admin or employee
if (userStore.clientProfile?.role !== 'admin' && userStore.clientProfile?.role !== 'employee') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin or employee access required'
  })
}

// Initialize data
const customers = ref<Customer[]>([])
const lastVisitMap = ref<Record<string, string>>({})

// Refresh customers
async function refreshCustomers() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch('/api/customers', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    if (!response.ok) throw new Error('Failed to fetch customers')
    customers.value = await response.json() as Customer[]
  } catch (error) {
    console.error('Error refreshing customers:', error)
  }
}

// Compute last visit per customer from bookings
async function refreshLastVisits() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch('/api/bookings', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    if (!response.ok) return

    const bookings = await response.json()
    const map: Record<string, string> = {}
    for (const booking of bookings) {
      if (booking.customer_id && booking.booking_date) {
        if (!map[booking.customer_id] || booking.booking_date > map[booking.customer_id]!) {
          map[booking.customer_id] = booking.booking_date
        }
      }
    }
    lastVisitMap.value = map
  } catch (error) {
    console.error('Error fetching last visits:', error)
  }
}

// Initial fetch
await refreshCustomers()
await refreshLastVisits()

// Search
const searchQuery = ref('')

// Modal states
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)

// Loading state
const loading = ref(false)

// Customer refs
const editingCustomer = ref<Customer | null>(null)
const customerToDelete = ref<Customer | null>(null)

// Form data
const newCustomer = ref({
  full_name: '',
  email: '',
  phone_number: '',
  gender: '',
  date_of_birth: ''
})

const editCustomer = ref({
  full_name: '',
  email: '',
  phone_number: '',
  gender: '',
  date_of_birth: ''
})

// Computed
const filteredCustomers = computed(() => {
  if (!searchQuery.value) return customers.value
  const term = searchQuery.value.toLowerCase()
  return customers.value.filter(c =>
    c.full_name?.toLowerCase().includes(term)
    || c.email?.toLowerCase().includes(term)
    || c.phone_number?.toLowerCase().includes(term)
  )
})

// CRUD Operations
async function addCustomer() {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...newCustomer.value,
        date_of_birth: newCustomer.value.date_of_birth || null,
        gender: newCustomer.value.gender || null,
        phone_number: newCustomer.value.phone_number || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to add customer')
    }

    toast.add({ title: 'Success', description: 'Customer added successfully', color: 'success' })
    showAddModal.value = false
    resetNewCustomerForm()
    await refreshCustomers()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.message || 'Failed to add customer', color: 'error' })
  } finally {
    loading.value = false
  }
}

function openEditModal(customer: Customer) {
  editingCustomer.value = customer
  editCustomer.value = {
    full_name: customer.full_name || '',
    email: customer.email || '',
    phone_number: customer.phone_number || '',
    gender: customer.gender || '',
    date_of_birth: customer.date_of_birth || ''
  }
  showEditModal.value = true
}

async function updateCustomer() {
  if (!editingCustomer.value) return
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch(`/api/customers?id=${editingCustomer.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...editCustomer.value,
        date_of_birth: editCustomer.value.date_of_birth || null,
        gender: editCustomer.value.gender || null,
        phone_number: editCustomer.value.phone_number || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to update customer')
    }

    toast.add({ title: 'Success', description: 'Customer updated successfully', color: 'success' })
    showEditModal.value = false
    editingCustomer.value = null
    await refreshCustomers()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.message || 'Failed to update customer', color: 'error' })
  } finally {
    loading.value = false
  }
}

function openDeleteModal(customer: Customer) {
  customerToDelete.value = customer
  showDeleteModal.value = true
}

async function deleteCustomer() {
  if (!customerToDelete.value) return
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch(`/api/customers?id=${customerToDelete.value.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to delete customer')
    }

    toast.add({ title: 'Success', description: 'Customer deleted successfully', color: 'success' })
    showDeleteModal.value = false
    customerToDelete.value = null
    await refreshCustomers()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.message || 'Failed to delete customer', color: 'error' })
  } finally {
    loading.value = false
  }
}

function resetNewCustomerForm() {
  newCustomer.value = { full_name: '', email: '', phone_number: '', gender: '', date_of_birth: '' }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getClientYear(createdAt?: string) {
  if (!createdAt) return '—'
  return new Date(createdAt).getFullYear()
}

function getInitials(name?: string) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

const avatarPalette = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
  'bg-teal-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500'
]

function getAvatarColor(name?: string) {
  if (!name) return avatarPalette[0]!
  return avatarPalette[name.charCodeAt(0) % avatarPalette.length]!
}

function exportCSV() {
  const headers = ['Name', 'Email', 'Phone', 'Gender', 'Date of Birth', 'Visits', 'Spent', 'Last Visit', 'Client Since']
  const rows = filteredCustomers.value.map(c => [
    c.full_name || '',
    c.email || '',
    c.phone_number || '',
    c.gender || '',
    c.date_of_birth || '',
    c.total_visits ?? 0,
    c.total_spent ?? 0,
    lastVisitMap.value[c.id] || '',
    getClientYear(c.created_at)
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              size="sm"
              @click="exportCSV"
            >
              Export CSV
            </UButton>
            <UButton
              icon="i-lucide-plus"
              size="sm"
              @click="showAddModal = true"
            >
              Add Client
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
        <!-- Page subtitle -->
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Client database &amp; history
        </p>

        <!-- Search -->
        <div class="mb-5">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search by name, phone, or email..."
            class="max-w-sm"
          />
        </div>

        <!-- Empty state -->
        <div v-if="customers.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
          <UIcon name="i-lucide-users" class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-gray-500 dark:text-gray-400 font-medium">No customers yet</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Add your first client to get started</p>
        </div>

        <!-- No search results -->
        <div v-else-if="filteredCustomers.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
          <UIcon name="i-lucide-search-x" class="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-gray-500 dark:text-gray-400">No customers match your search</p>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Visits
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Spent
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Visit
                </th>
                <th class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="customer in filteredCustomers"
                :key="customer.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <!-- Client -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                      :class="getAvatarColor(customer.full_name)"
                    >
                      {{ getInitials(customer.full_name) }}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {{ customer.full_name }}
                      </p>
                      <p class="text-xs text-gray-400">
                        Client since {{ getClientYear(customer.created_at) }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Contact -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <UIcon name="i-lucide-phone" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{{ customer.phone_number || '—' }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <UIcon name="i-lucide-mail" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{{ customer.email || '—' }}</span>
                    </div>
                  </div>
                </td>

                <!-- Visits -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ customer.total_visits ?? 0 }}
                  </span>
                </td>

                <!-- Spent -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${{ (customer.total_spent ?? 0).toFixed(2) }}
                  </span>
                </td>

                <!-- Last Visit -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-600 dark:text-gray-300">
                    {{ lastVisitMap[customer.id] ? formatDate(lastVisitMap[customer.id]) : '—' }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center gap-2 justify-end">
                    <UButton
                      size="sm"
                      color="neutral"
                      variant="outline"
                      @click="openEditModal(customer)"
                    >
                      View
                    </UButton>
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="openDeleteModal(customer)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Client Modal -->
  <div
    v-if="showAddModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="showAddModal = false"
  >
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Add New Client</h3>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="showAddModal = false" />
      </div>
      <form @submit.prevent="addCustomer">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
            <UInput v-model="newCustomer.full_name" placeholder="Enter full name" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <UInput v-model="newCustomer.email" type="email" placeholder="Enter email" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
            <UInput v-model="newCustomer.phone_number" placeholder="Enter phone number" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
            <select
              v-model="newCustomer.gender"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
            <UInput v-model="newCustomer.date_of_birth" type="date" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <UButton type="button" color="neutral" variant="ghost" @click="showAddModal = false">Cancel</UButton>
          <UButton type="submit" :loading="loading" :disabled="!newCustomer.full_name">Add Client</UButton>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit Client Modal -->
  <div
    v-if="showEditModal && editingCustomer"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="showEditModal = false"
  >
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            :class="getAvatarColor(editingCustomer.full_name)"
          >
            {{ getInitials(editingCustomer.full_name) }}
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Client</h3>
            <p class="text-xs text-gray-400">Client since {{ getClientYear(editingCustomer.created_at) }}</p>
          </div>
        </div>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="showEditModal = false" />
      </div>
      <form @submit.prevent="updateCustomer">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
            <UInput v-model="editCustomer.full_name" placeholder="Enter full name" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <UInput v-model="editCustomer.email" type="email" placeholder="Enter email" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
            <UInput v-model="editCustomer.phone_number" placeholder="Enter phone number" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
            <select
              v-model="editCustomer.gender"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
            <UInput v-model="editCustomer.date_of_birth" type="date" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <UButton type="button" color="neutral" variant="ghost" @click="showEditModal = false">Cancel</UButton>
          <UButton type="submit" :loading="loading" :disabled="!editCustomer.full_name">Save Changes</UButton>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Client Modal -->
  <div
    v-if="showDeleteModal && customerToDelete"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="showDeleteModal = false"
  >
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Client</h3>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="showDeleteModal = false" />
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Are you sure you want to delete
        <strong class="text-gray-900 dark:text-gray-100">{{ customerToDelete.full_name }}</strong>?
        This action cannot be undone.
      </p>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="showDeleteModal = false">Cancel</UButton>
        <UButton color="error" :loading="loading" @click="deleteCustomer">Delete</UButton>
      </div>
    </div>
  </div>
</template>
