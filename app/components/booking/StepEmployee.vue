<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState, updateServiceBooking, getServiceBooking } = useBookingFlow()

// Track which service is currently being configured
const activeServiceIndex = ref(0)
const activeService = computed(() => bookingState.value.serviceBookings[activeServiceIndex.value])

// Fetch services data for display
const { data: services } = await useLazyFetch('/api/public-services', {
  default: () => [],
  server: false
})

const getServiceDetails = (serviceId: string) => {
  return services.value?.find(s => s.id === serviceId)
}

const getServiceDuration = (serviceId: string | undefined) => {
  if (!serviceId) return 1
  const service = getServiceDetails(serviceId)
  return service?.duration_service_in_s || 3600 // Default 1 hour
}

// Fetch employees who can provide the selected service and are available at the selected date/time
const { data: availableEmployeesResponse, pending, refresh: refreshEmployees } = await useLazyFetch('/api/available-employees', {
  default: () => ({ success: false, employees: [], message: '' }),
  server: false,
  query: computed(() => ({
    service_ids: activeService.value?.serviceId || '',
    date: activeService.value?.date || '',
    time: activeService.value?.time || '',
    duration: getServiceDuration(activeService.value?.serviceId)
  })),
  watch: [activeServiceIndex, () => activeService.value?.date, () => activeService.value?.time]
})

// Extract employees array from the response
const availableEmployees = computed(() => {
  return availableEmployeesResponse.value?.employees || []
})

const selectEmployee = (employeeId: string, employeeName: string) => {
  if (!activeService.value) return

  updateServiceBooking(activeService.value.serviceId, {
    employeeId,
    employeeName
  })
}

// Navigation between services
const goToService = (index: number) => {
  if (index >= 0 && index < bookingState.value.serviceBookings.length) {
    activeServiceIndex.value = index
  }
}

// Check if an employee is selected for the current service
const isEmployeeSelected = (employeeId: string) => {
  return activeService.value?.employeeId === employeeId
}

// Check if service has both date and time selected
const isServiceConfigured = (serviceBooking: any) => {
  return serviceBooking.date && serviceBooking.time
}

// Skip functionality - randomly select available employees
const skipSelection = () => {
  if (!availableEmployees.value || availableEmployees.value.length === 0) return

  // For current service, randomly select an employee
  const randomEmployee = availableEmployees.value[Math.floor(Math.random() * availableEmployees.value.length)]
  selectEmployee(randomEmployee.id, `${randomEmployee.first_name} ${randomEmployee.last_name}`)
}

// Skip all unselected services
const skipAllUnselected = () => {
  bookingState.value.serviceBookings.forEach((service, index) => {
    if (!service.employeeId && service.date && service.time) {
      // Temporarily switch to this service to get its available employees
      activeServiceIndex.value = index
      nextTick(() => {
        if (availableEmployees.value && availableEmployees.value.length > 0) {
          const randomEmployee = availableEmployees.value[Math.floor(Math.random() * availableEmployees.value.length)]
          selectEmployee(randomEmployee.id, `${randomEmployee.first_name} ${randomEmployee.last_name}`)
        }
      })
    }
  })
}

// Initialize with first service
onMounted(() => {
  console.log('StepEmployee mounted, serviceBookings:', bookingState.value.serviceBookings)
  if (bookingState.value.serviceBookings.length > 0) {
    goToService(0)
  }
})

// Debug available employees
watchEffect(() => {
  console.log('Available employees response:', availableEmployeesResponse.value)
  console.log('Available employees count:', availableEmployees.value?.length || 0)
  console.log('Pending:', pending.value)
})
</script>

<template>
  <div v-if="bookingState.serviceBookings.length > 0" class="step-employee">
    <div class="step-description">
      <p class="text-gray-400 mb-6">
        Choose an available employee for each service based on your selected date and time
      </p>
    </div>

    <!-- Service Navigation -->
    <div v-if="bookingState.serviceBookings.length > 1" class="mb-6">
      <h3 class="text-lg font-semibold text-white mb-3">
        Select Employee for Each Service
      </h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(service, index) in bookingState.serviceBookings"
          :key="service.serviceId"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeServiceIndex === index
              ? 'bg-blue-500 text-white'
              : service.employeeId
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : isServiceConfigured(service)
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed'
          ]"
          :disabled="!isServiceConfigured(service)"
          @click="goToService(index)"
        >
          {{ service.serviceName || `Service ${index + 1}` }}
          <span v-if="service.employeeId" class="ml-2 text-xs">✓</span>
          <span v-else-if="!isServiceConfigured(service)" class="ml-2 text-xs">⚠️</span>
        </button>
      </div>
    </div>

    <!-- Current Service Info -->
    <div v-if="activeService" class="mb-6">
      <h4 class="text-xl font-semibold text-white mb-2">
        {{ activeService.serviceName || `Service ${activeServiceIndex + 1}` }}
      </h4>
      <div class="flex flex-wrap gap-4 text-sm text-gray-400">
        <span v-if="getServiceDetails(activeService.serviceId)">
          Duration: {{ Math.round(getServiceDetails(activeService.serviceId)?.duration_service_in_s / 3600 * 10) / 10 }}h
          • Price: ${{ getServiceDetails(activeService.serviceId)?.price }}
        </span>
        <span v-if="activeService.date && activeService.time" class="text-blue-400">
          📅 {{ activeService.date }} at {{ activeService.time }}
        </span>
      </div>
    </div>

    <!-- Warning if no date/time selected -->
    <div
      v-if="activeService && (!activeService.date || !activeService.time)"
      class="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
    >
      <div class="flex items-center gap-2 text-yellow-400 mb-2">
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h4 class="font-medium">
          Date & Time Required
        </h4>
      </div>
      <p class="text-sm text-gray-300">
        Please go back to the previous step and select a date and time for this service before choosing an employee.
      </p>
    </div>

    <!-- Employee Selection -->
    <div v-else-if="activeService">
      <div v-if="!availableEmployees || availableEmployees.length === 0" class="text-center py-8">
        <div class="mb-4">
          <svg
            class="w-16 h-16 mx-auto text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <p class="text-gray-400 text-lg mb-2">
          No employees available
        </p>
        <p class="text-gray-500 text-sm">
          {{ availableEmployeesResponse?.message
            || `No employees are available to provide "${activeService.serviceName}" on ${activeService.date} at ${activeService.time}.` }}
        </p>
        <p class="text-gray-500 text-sm mt-2">
          Please go back and select a different date or time.
        </p>
      </div>

      <div v-else>
        <!-- Skip Button -->
        <div class="flex justify-between items-center mb-6">
          <h4 class="text-lg font-semibold text-white">
            Available Employees
          </h4>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              @click="skipSelection"
            >
              🎲 Skip - Random Select
            </button>
            <button
              v-if="bookingState.serviceBookings.length > 1"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
              @click="skipAllUnselected"
            >
              🎲 Skip All Services
            </button>
          </div>
        </div>

        <div class="employees-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="employee in availableEmployees"
            :key="employee.id"
            class="employee-card p-6 rounded-lg border-2 transition-all cursor-pointer"
            :class="isEmployeeSelected(employee.id)
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
            @click="selectEmployee(employee.id, `${employee.first_name} ${employee.last_name}`)"
          >
            <div class="flex flex-col items-center text-center">
              <img
                v-if="employee.profile_picture"
                :src="employee.profile_picture"
                :alt="employee.full_name"
                class="w-20 h-20 rounded-full object-cover mb-4"
              >
              <div v-else class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
                {{ employee.first_name?.charAt(0) }}{{ employee.last_name?.charAt(0) }}
              </div>
              <h3 class="text-lg font-semibold text-white mb-1">
                {{ employee.first_name }} {{ employee.last_name }}
              </h3>
              <p v-if="employee.email" class="text-gray-400 text-sm mb-2">
                {{ employee.email }}
              </p>

              <!-- Show service compatibility -->
              <div v-if="employee.can_provide_services" class="text-xs text-gray-500 mb-3">
                <span v-if="employee.matches_requested_services" class="text-green-400">
                  ✓ Can provide this service
                </span>
                <span v-else class="text-yellow-400">
                  ⚠ Limited service availability
                </span>
              </div>

              <!-- Availability indicator -->
              <div class="flex items-center gap-2 text-xs text-green-400 mb-3">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Available
              </div>

              <div v-if="isEmployeeSelected(employee.id)" class="mt-2">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500 text-white">
                  <svg
                    class="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Selected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation between services -->
      <div v-if="bookingState.serviceBookings.length > 1" class="flex justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          v-if="activeServiceIndex > 0"
          class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          @click="goToService(activeServiceIndex - 1)"
        >
          ← Previous Service
        </button>
        <div v-else />

        <button
          v-if="activeServiceIndex < bookingState.serviceBookings.length - 1"
          class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          @click="goToService(activeServiceIndex + 1)"
        >
          Next Service →
        </button>
      </div>

      <!-- Summary -->
      <div v-if="bookingState.serviceBookings.some(sb => sb.employeeId)" class="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
        <h4 class="text-green-400 font-medium mb-2">
          Selected Employees:
        </h4>
        <div class="space-y-2">
          <div
            v-for="service in bookingState.serviceBookings.filter(sb => sb.employeeId)"
            :key="service.serviceId"
            class="text-sm text-gray-300 flex justify-between items-center"
          >
            <div>
              <span class="text-white font-medium">{{ service.serviceName }}</span>
              <span class="text-gray-400"> • {{ service.date }} at {{ service.time }}</span>
            </div>
            <span class="text-blue-400 font-medium">{{ service.employeeName }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.employee-card {
  transition: all 0.2s ease;
}

.employee-card:hover {
  transform: translateY(-2px);
}
</style>
