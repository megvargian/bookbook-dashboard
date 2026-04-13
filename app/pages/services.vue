<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { z } from 'zod'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  categories: z.string().optional(),
  duration_hours: z.coerce.number().min(0, 'Duration must be positive').optional()
})

// Wait for user store to initialize
await userStore.fetchClientProfile()

// Check if user is admin client
if (userStore.clientProfile?.role !== 'admin' || userStore.clientProfile?.user_type !== 'client') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin client access required'
  })
}

const { data: services, refresh: refreshServices } = await useFetch('/api/services', { default: () => [] })

const q = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const loading = ref(false)
const editingService = ref(null)

const newService = ref({
  name: '',
  description: '',
  price: 0,
  categories: '',
  duration_hours: 0
})

const editService = ref({
  name: '',
  description: '',
  price: 0,
  categories: '',
  duration_hours: 0
})

const filteredServices = computed(() => {
  if (!services.value) return []
  return services.value.filter((service) => {
    return service.name.search(new RegExp(q.value, 'i')) !== -1
      || (service.description && service.description.search(new RegExp(q.value, 'i')) !== -1)
  })
})

async function addService() {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...newService.value,
        duration_service_in_s: newService.value.duration_hours * 3600, // Convert hours to seconds
        categories: newService.value.categories
          ? newService.value.categories.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : []
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to create service')
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(result.error)
    }

    toast.add({
      title: 'Success',
      description: 'Service added successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showAddModal.value = false
    newService.value = {
      name: '',
      description: '',
      price: 0,
      categories: '',
      duration_service_h: 0
    }
    await refreshServices()
  } catch (error) {
    console.error('Error adding service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to add service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function openEditModal(service) {
  editingService.value = service
  editService.value = {
    name: service.name || '',
    description: service.description || '',
    price: Number(service.price) || 0,
    categories: Array.isArray(service.categories)
      ? service.categories.join(', ')
      : service.categories || '',
    duration_hours: service.duration_service_in_s ? Number(service.duration_service_in_s) / 3600 : 0
  }
  showEditModal.value = true
}

async function updateService() {
  if (!editingService.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch(`/api/services?id=${editingService.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...editService.value,
        price: Number(editService.value.price), // Ensure price is a number
        duration_service_in_s: Number(editService.value.duration_hours) * 3600, // Convert hours to seconds
        categories: editService.value.categories
          ? (typeof editService.value.categories === 'string'
              ? editService.value.categories.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
              : editService.value.categories)
          : []
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to update service')
    }

    toast.add({
      title: 'Success',
      description: 'Service updated successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showEditModal.value = false
    editingService.value = null
    await refreshServices()
  } catch (error) {
    console.error('Error updating service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to update service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function removeService(serviceId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch(`/api/services?id=${serviceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to remove service')
    }

    toast.add({
      title: 'Success',
      description: 'Service removed successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    await refreshServices()
  } catch (error) {
    console.error('Error removing service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to remove service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  }
}
</script>

<template>
  <UDashboardPanel id="services">
    <template #header>
      <UDashboardNavbar title="Services">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Add Service"
            color="primary"
            @click.stop="showAddModal = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search services"
          autofocus
          class="max-w-sm"
          @click.stop
        />

        <SettingsServicesList :services="filteredServices" @remove-service="removeService" @edit-service="openEditModal" />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Service Modal -->
  <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="showAddModal = false" />
    <div class="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            Add New Service
          </h3>
          <p class="text-sm text-slate-400 dark:text-gray-400 mt-0.5">
            Create a new service offering
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
          @click="showAddModal = false"
        >
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Service Name <span class="text-red-500">*</span></label>
          <input
            v-model="newService.name"
            type="text"
            placeholder="House Cleaning"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Description</label>
          <textarea
            v-model="newService.description"
            rows="3"
            placeholder="Detailed description of the service"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Price ($) <span class="text-red-500">*</span></label>
            <input
              v-model.number="newService.price"
              type="number"
              step="0.01"
              placeholder="99.99"
              class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Duration (hours)</label>
            <input
              v-model.number="newService.duration_hours"
              type="number"
              step="0.5"
              placeholder="2.5"
              class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Categories</label>
          <input
            v-model="newService.categories"
            type="text"
            placeholder="Cleaning, Maintenance, Repair (comma-separated)"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-gray-700 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all"
          @click="showAddModal = false"
        >
          Cancel
        </button>
        <button
          class="px-5 py-2 text-sm font-semibold bg-navy-500 hover:bg-navy-600 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-60"
          :disabled="loading"
          @click="addService"
        >
          <UIcon v-if="loading" name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          Add Service
        </button>
      </div>
    </div>
  </div>

  <!-- Edit Service Modal -->
  <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="showEditModal = false" />
    <div class="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Service
          </h3>
          <p class="text-sm text-slate-400 dark:text-gray-400 mt-0.5">
            Update service information
          </p>
        </div>
        <button
          class="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
          @click="showEditModal = false"
        >
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Service Name <span class="text-red-500">*</span></label>
          <input
            v-model="editService.name"
            type="text"
            placeholder="House Cleaning"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Description</label>
          <textarea
            v-model="editService.description"
            rows="3"
            placeholder="Detailed description of the service"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Price ($) <span class="text-red-500">*</span></label>
            <input
              v-model.number="editService.price"
              type="number"
              step="0.01"
              placeholder="99.99"
              class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Duration (hours)</label>
            <input
              v-model.number="editService.duration_hours"
              type="number"
              step="0.5"
              placeholder="2.5"
              class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">Categories</label>
          <input
            v-model="editService.categories"
            type="text"
            placeholder="Cleaning, Maintenance, Repair (comma-separated)"
            class="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-gray-700 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all"
          @click="showEditModal = false"
        >
          Cancel
        </button>
        <button
          class="px-5 py-2 text-sm font-semibold bg-navy-500 hover:bg-navy-600 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-60"
          :disabled="loading"
          @click="updateService"
        >
          <UIcon v-if="loading" name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>
