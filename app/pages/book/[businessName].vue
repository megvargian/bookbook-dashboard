<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<!-- eslint-disable no-empty -->
<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'
import StepServices from '~/components/booking/StepServices.vue'
import StepEmployee from '~/components/booking/StepEmployee.vue'
import StepDateTime from '~/components/booking/StepDateTime.vue'
import StepAuth from '~/components/booking/StepAuth.vue'

definePageMeta({
  title: 'Book Appointment',
  layout: false,
  auth: false // Public page - no authentication required
})

const route = useRoute()
const supabase = useSupabaseClient()
const toast = useToast()
const businessNameParam = route.params.businessName as string

// Resolve slug → clientProfileId + businessName via server API (uses service key)
const { data: resolvedBusiness } = await useAsyncData('resolve-business', async () => {
  return await $fetch<{ clientProfileId: string, businessName: string }>('/api/public-business-name', {
    query: { slug: businessNameParam }
  })
})

if (!resolvedBusiness.value?.clientProfileId) {
  throw createError({ statusCode: 404, message: 'Business not found' })
}

// const clientProfileId = resolvedBusiness.value.clientProfileId
const businessInfo = computed(() => resolvedBusiness.value?.businessName ?? null)

const {
  currentStep,
  bookingState,
  nextStep,
  prevStep,
  canProceedToStep2,
  canProceedToStep3,
  canProceedToStep4,
  resetBooking
} = useBookingFlow()

// Set the client profile ID in the booking state
bookingState.value.clientProfileId = resolvedBusiness.value.clientProfileId

// Auth state
const checkingAuth = ref(true)
const isAuthenticated = ref(false)
const submitBookingLoading = ref(false)

// Check if user already has a valid customer session on page load
onMounted(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    // Only auto-authenticate if they're already tagged as 'customer'.
    // New Google users (no role yet) will be handled by StepAuth which
    // tags them and creates the customer record.
    if (session && session.user?.user_metadata?.role === 'customer') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await $fetch('/api/customer-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {}
      }).catch(() => null)
      if (res?.customer?.id) {
        bookingState.value.customerId = res.customer.id
        isAuthenticated.value = true
      }
    }
  } catch {} finally {
    checkingAuth.value = false
  }
})

function onAuthComplete(customerId: string) {
  bookingState.value.customerId = customerId
  isAuthenticated.value = true
}

const stepTitles = [
  'Choose Services',
  'Select Date & Time',
  'Choose Employees'
]

const stepDescriptions = [
  'Select one or more services you would like to book',
  'Pick a convenient date and time for each service',
  'Choose available employees for each service'
]

const progressPercentage = computed(() => {
  return (currentStep.value / 3) * 100
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1: return canProceedToStep2.value
    case 2: return canProceedToStep3.value
    default: return false
  }
})

const canSubmit = computed(() => {
  return currentStep.value === 3 && canProceedToStep4.value
})

const showSuccess = ref(false)

async function submitBooking() {
  if (!bookingState.value.customerId) return
  submitBookingLoading.value = true
  try {
    const bookingPromises = bookingState.value.serviceBookings.map(serviceBooking =>
      $fetch('/api/public-bookings', {
        method: 'POST',
        body: {
          client_profile_id: bookingState.value.clientProfileId,
          customer_id: bookingState.value.customerId,
          employee_id: serviceBooking.employeeId,
          service_id: serviceBooking.serviceId,
          booking_date: serviceBooking.date,
          start_time: serviceBooking.time,
          notes: `Booking for ${serviceBooking.serviceName || 'service'}`
        }
      })
    )
    await Promise.all(bookingPromises)
    toast.add({
      title: '🎉 Booking Confirmed!',
      description: `Your ${bookingState.value.serviceBookings.length} appointment${bookingState.value.serviceBookings.length > 1 ? 's have' : ' has'} been successfully booked`,
      color: 'success'
    })
    showSuccess.value = true
  } catch (error: any) {
    toast.add({
      title: 'Booking Failed',
      description: error?.data?.message || error?.message || 'Failed to create booking. Please try again.',
      color: 'error'
    })
  } finally {
    submitBookingLoading.value = false
  }
}

// const handleBookingComplete = () => {
//   showSuccess.value = true
// }

const startNewBooking = () => {
  showSuccess.value = false
  resetBooking()
  // Re-set the client profile ID after reset
  bookingState.value.clientProfileId = resolvedBusiness.value?.clientProfileId as string | null
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
    <!-- Header -->
    <div class="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">
              Book Your Appointment<template v-if="businessInfo">
                at {{ businessInfo }}
              </template>
            </h1>
            <p class="mt-1 text-gray-400">
              Fast and easy online booking
            </p>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-400">
              Step {{ currentStep }} of 3
            </div>
            <div class="text-lg font-semibold text-white">
              {{ stepTitles[currentStep - 1] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Page -->
    <div v-if="showSuccess" class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-10">
        <!-- Check icon + title -->
        <div class="flex flex-col items-center text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-5">
            <svg
              class="w-10 h-10 text-green-400"
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
          </div>
          <h2 class="text-3xl font-bold text-white mb-2">
            Booking Confirmed!
          </h2>
          <p class="text-gray-400">
            Your appointment has been successfully scheduled. You will receive a confirmation shortly.
          </p>
        </div>

        <!-- Booking details -->
        <div class="space-y-4 mb-8">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Appointment Summary
          </h3>
          <div
            v-for="(sb, index) in bookingState.serviceBookings"
            :key="sb.serviceId"
            class="bg-gray-700/50 rounded-xl p-5 border border-gray-600"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 text-sm font-bold shrink-0">
                  {{ index + 1 }}
                </div>
                <div>
                  <p class="text-white font-semibold text-base">
                    {{ sb.serviceName }}
                  </p>
                  <p v-if="sb.employeeName" class="text-gray-400 text-sm mt-0.5">
                    with {{ sb.employeeName }}
                  </p>
                </div>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 shrink-0">
                Confirmed
              </span>
            </div>
            <div class="mt-4 flex flex-wrap gap-4 text-sm text-gray-300">
              <div class="flex items-center gap-1.5">
                <svg
                  class="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {{ sb.date }}
              </div>
              <div class="flex items-center gap-1.5">
                <svg
                  class="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {{ sb.time }}
              </div>
            </div>
          </div>
        </div>

        <!-- Book another -->
        <button
          class="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          @click="startNewBooking"
        >
          Book Another Appointment
        </button>
      </div>
    </div>

    <!-- Booking Flow -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Auth Gate: shown while checking or when not authenticated -->
      <template v-if="checkingAuth">
        <div class="flex items-center justify-center py-24">
          <svg class="w-10 h-10 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </template>

      <template v-else-if="!isAuthenticated">
        <div class="max-w-sm mx-auto">
          <StepAuth @auth-complete="onAuthComplete" />
        </div>
      </template>

      <template v-else>
        <!-- Progress Bar -->
        <div class="mb-8">
          <div class="relative">
            <div class="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-gray-700">
              <div
                :style="{ width: progressPercentage + '%' }"
                class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-500"
              />
            </div>
          </div>

          <!-- Step Indicators -->
          <div class="flex justify-between">
            <div
              v-for="(title, index) in stepTitles"
              :key="index"
              class="flex flex-col items-center"
              :class="{ 'flex-1': index < stepTitles.length - 1 }"
            >
              <div
                class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all"
                :class="[
                  currentStep > index + 1 ? 'bg-primary-500 border-primary-500 text-white'
                  : currentStep === index + 1 ? 'border-primary-500 text-primary-500 bg-gray-800'
                    : 'border-gray-600 text-gray-500 bg-gray-800'
                ]"
              >
                <span v-if="currentStep > index + 1" class="text-white">✓</span>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div class="mt-2 text-xs text-center hidden sm:block" :class="currentStep === index + 1 ? 'text-white font-medium' : 'text-gray-500'">
                {{ title }}
              </div>
            </div>
          </div>
        </div>

        <!-- Step Description -->
        <div class="mb-8 text-center">
          <p class="text-gray-300 text-lg">
            {{ stepDescriptions[currentStep - 1] }}
          </p>
        </div>

        <!-- Step Content -->
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 mb-8">
          <StepServices v-if="currentStep === 1" />
          <StepDateTime v-else-if="currentStep === 2" />
          <StepEmployee v-else-if="currentStep === 3" />
        </div>

        <!-- Navigation Buttons -->
        <div class="flex items-center justify-between gap-4">
          <button
            v-if="currentStep > 1"
            class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            @click="prevStep"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <div v-else />

          <!-- Next button (steps 1–2) -->
          <button
            v-if="currentStep < 3"
            :disabled="!canProceed"
            class="px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 ml-auto"
            :class="canProceed ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
            @click="nextStep"
          >
            Next
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <!-- Book Now button (step 3) -->
          <button
            v-if="currentStep === 3"
            :disabled="!canSubmit || submitBookingLoading"
            class="px-8 py-3 font-semibold rounded-lg transition-colors flex items-center gap-2 ml-auto"
            :class="canSubmit && !submitBookingLoading ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
            @click="submitBooking"
          >
            <svg
              v-if="submitBookingLoading"
              class="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ submitBookingLoading ? 'Booking…' : 'Book Now' }}
            <svg
              v-if="!submitBookingLoading"
              class="w-5 h-5"
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
          </button>
        </div>
      </template><!-- end authenticated -->
    </div>
  </div>
</template>
