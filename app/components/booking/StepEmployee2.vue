<script setup lang="ts">
import { useBookingFlow2 } from '~/composables/useBookingFlow2'

const { bookingState, updateServiceBooking } = useBookingFlow2()

const activeServiceIndex = ref(0)
const activeService = computed(() => bookingState.value.serviceBookings[activeServiceIndex.value])

// Fetch services for display
const { data: services } = await useLazyFetch('/api/public-services', {
  default: () => [],
  server: false
})

const getServiceDetails = (serviceId: string) =>
  services.value?.find((s: any) => s.id === serviceId)

// Fetch employees who can provide the selected services (no date filter)
const serviceIdsParam = computed(() =>
  activeService.value?.serviceId || ''
)

const { data: employeesResponse, pending, refresh } = await useLazyFetch('/api/available-employees', {
  default: () => ({ success: false, employees: [] }),
  server: false,
  query: computed(() => ({ service_ids: serviceIdsParam.value })),
  watch: [serviceIdsParam]
})

const availableEmployees = computed(() => employeesResponse.value?.employees || [])

// Track "Anyone" mode per service
const anyoneServiceIds = ref<Set<string>>(new Set())

const selectEmployee = (employeeId: string, employeeName: string) => {
  if (!activeService.value) return
  anyoneServiceIds.value.delete(activeService.value.serviceId)
  // Clear date/time when employee changes
  updateServiceBooking(activeService.value.serviceId, {
    employeeId,
    employeeName,
    date: null,
    time: null
  })
}

const selectAnyone = () => {
  if (!activeService.value || !availableEmployees.value.length) return
  const first = availableEmployees.value[0]
  const realName = first.full_name || `${first.first_name || ''} ${first.last_name || ''}`.trim()
  anyoneServiceIds.value = new Set([...anyoneServiceIds.value, activeService.value.serviceId])
  updateServiceBooking(activeService.value.serviceId, {
    employeeId: first.id,
    employeeName: realName,
    date: null,
    time: null
  })
}

// Pre-select "Anyone" when employees load for the first time
watch(availableEmployees, (employees) => {
  if (employees?.length > 0 && !activeService.value?.employeeId) {
    selectAnyone()
  }
}, { immediate: true })

const isAnyoneSelected = computed(() =>
  !!activeService.value && anyoneServiceIds.value.has(activeService.value.serviceId)
)

const isEmployeeSelected = (employeeId: string) =>
  activeService.value?.employeeId === employeeId && !isAnyoneSelected.value

const goToService = (index: number) => {
  if (index >= 0 && index < bookingState.value.serviceBookings.length) {
    activeServiceIndex.value = index
  }
}
</script>

<template>
  <div v-if="bookingState.serviceBookings.length > 0">
    <p class="text-slate-500 mb-6">
      Choose an employee for each service
    </p>

    <!-- Service tabs (multi-service) -->
    <div v-if="bookingState.serviceBookings.length > 1" class="mb-6">
      <h3 class="text-base font-semibold text-slate-800 mb-3">
        Select Employee for Each Service
      </h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(service, index) in bookingState.serviceBookings"
          :key="service.serviceId"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeServiceIndex === index
              ? 'bg-navy-500 text-white'
              : service.employeeId
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
          @click="goToService(index)"
        >
          {{ service.serviceName || `Service ${index + 1}` }}
          <span v-if="service.employeeId" class="ml-1 text-xs">✓</span>
        </button>
      </div>
    </div>

    <!-- Active service info -->
    <div v-if="activeService" class="mb-6">
      <h4 class="text-lg font-semibold text-slate-800 mb-1">
        {{ activeService.serviceName || `Service ${activeServiceIndex + 1}` }}
      </h4>
      <p v-if="getServiceDetails(activeService.serviceId)" class="text-slate-500 text-sm">
        Duration: {{ Math.round((getServiceDetails(activeService.serviceId)?.duration_service_in_s || 3600) / 3600 * 10) / 10 }}h
        · Price: ${{ getServiceDetails(activeService.serviceId)?.price }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-500 mx-auto mb-3" />
      <p class="text-slate-400 text-sm">Loading employees…</p>
    </div>

    <!-- No employees -->
    <div v-else-if="!availableEmployees.length" class="text-center py-12">
      <svg class="w-14 h-14 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p class="text-slate-700 font-semibold mb-1">No employees available</p>
      <p class="text-slate-400 text-sm">No one is assigned to provide this service yet.</p>
    </div>

    <!-- Employee grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Anyone card -->
      <div
        class="p-6 rounded-xl border-2 cursor-pointer transition-all"
        :class="isAnyoneSelected
          ? 'border-navy-500 bg-navy-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-navy-300 shadow-sm hover:shadow'"
        @click="selectAnyone()"
      >
        <div class="flex flex-col items-center text-center">
          <div class="w-18 h-18 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-3xl mb-3" style="width:72px;height:72px">
            🎲
          </div>
          <h3 class="text-base font-semibold text-slate-800 mb-1">Anyone</h3>
          <p class="text-slate-400 text-xs mb-3">Let us assign the best available</p>
          <span v-if="isAnyoneSelected" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-navy-500 text-white">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            Selected
          </span>
        </div>
      </div>

      <!-- Employee cards -->
      <div
        v-for="employee in availableEmployees"
        :key="employee.id"
        class="p-6 rounded-xl border-2 cursor-pointer transition-all"
        :class="isEmployeeSelected(employee.id)
          ? 'border-navy-500 bg-navy-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-navy-300 shadow-sm hover:shadow'"
        @click="selectEmployee(employee.id, employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim())"
      >
        <div class="flex flex-col items-center text-center">
          <img
            v-if="employee.profile_picture"
            :src="employee.profile_picture"
            :alt="employee.full_name"
            class="w-18 h-18 rounded-full object-cover mb-3"
            style="width:72px;height:72px"
          >
          <div
            v-else
            class="rounded-full bg-gradient-to-br from-navy-400 to-navy-600 flex items-center justify-center text-white text-xl font-bold mb-3"
            style="width:72px;height:72px"
          >
            {{ (employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`).trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() }}
          </div>
          <h3 class="text-base font-semibold text-slate-800 mb-0.5">
            {{ employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() }}
          </h3>
          <p v-if="employee.email" class="text-slate-400 text-xs mb-3">{{ employee.email }}</p>
          <span v-if="isEmployeeSelected(employee.id)" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-navy-500 text-white">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            Selected
          </span>
        </div>
      </div>
    </div>

    <!-- Inter-service navigation -->
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
    <div v-if="bookingState.serviceBookings.some(sb => sb.employeeId)" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
      <h4 class="text-green-700 font-medium mb-2 text-sm">Selected Employees:</h4>
      <div class="space-y-1">
        <div
          v-for="sb in bookingState.serviceBookings.filter(s => s.employeeId)"
          :key="sb.serviceId"
          class="text-sm flex justify-between"
        >
          <span class="text-slate-700 font-medium">{{ sb.serviceName }}</span>
          <span class="text-navy-500 font-medium">{{ sb.employeeName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
