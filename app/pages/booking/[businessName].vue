<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<!-- eslint-disable no-empty -->
<script setup lang="ts">
import { useBookingFlow2 } from '~/composables/useBookingFlow2'
import StepServices from '~/components/booking/StepServices.vue'
import StepEmployee2 from '~/components/booking/StepEmployee2.vue'
import StepDateTime2 from '~/components/booking/StepDateTime2.vue'
import StepAuth from '~/components/booking/StepAuth.vue'

definePageMeta({
  title: 'Book Appointment',
  layout: false,
  auth: false
})

const route = useRoute()
const supabase = useSupabaseClient()
const toast = useToast()
const businessNameParam = route.params.businessName as string

// Resolve slug → clientProfileId + businessName via server API
const { data: resolvedBusiness } = await useAsyncData('resolve-business-2', async () => {
  return await $fetch<{ clientProfileId: string, businessName: string }>('/api/public-business-name', {
    query: { slug: businessNameParam }
  })
})

if (!resolvedBusiness.value?.clientProfileId) {
  throw createError({ statusCode: 404, message: 'Business not found' })
}

const businessInfo = computed(() => resolvedBusiness.value?.businessName ?? null)

const {
  currentStep,
  bookingState,
  nextStep,
  prevStep,
  canProceedToStep2,
  canProceedToStep3,
  canSubmit: canSubmitComputed,
  resetBooking
} = useBookingFlow2()

// Set the client profile ID
bookingState.value.clientProfileId = resolvedBusiness.value.clientProfileId

// Auth state
const checkingAuth = ref(true)
const isAuthenticated = ref(false)
const submitBookingLoading = ref(false)

onMounted(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session && session.user?.user_metadata?.role === 'customer') {
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

const stepTitles = ['Choose Services', 'Choose Employee', 'Select Date & Time']

const stepDescriptions = [
  'Select one or more services you would like to book',
  'Choose an employee for each service',
  'Pick an available date and time for each service'
]

const progressPercentage = computed(() => (currentStep.value / 3) * 100)

const canProceed = computed(() => {
  if (currentStep.value === 1) return canProceedToStep2.value
  if (currentStep.value === 2) return canProceedToStep3.value
  return false
})

const canSubmit = computed(() => currentStep.value === 3 && canSubmitComputed.value)

const showSuccess = ref(false)

async function submitBooking() {
  if (!bookingState.value.customerId) return
  submitBookingLoading.value = true
  try {
    const bookingPromises = bookingState.value.serviceBookings.map(sb =>
      $fetch('/api/public-bookings', {
        method: 'POST',
        body: {
          client_profile_id: bookingState.value.clientProfileId,
          customer_id: bookingState.value.customerId,
          employee_id: sb.employeeId,
          service_id: sb.serviceId,
          booking_date: sb.date,
          start_time: sb.time,
          notes: `Booking for ${sb.serviceName || 'service'}`
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

const startNewBooking = () => {
  showSuccess.value = false
  resetBooking()
  bookingState.value.clientProfileId = resolvedBusiness.value?.clientProfileId as string | null
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <div class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg sm:text-xl md:text-2xl font-bold text-navy-500">
              Book Your Appointment<template v-if="businessInfo">
                at {{ businessInfo }}
              </template>
            </h1>
            <p class="mt-0.5 text-slate-400 text-sm">
              Fast and easy online booking
            </p>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400">
              Step {{ currentStep }} of 3
            </div>
            <div class="text-base font-semibold text-navy-500">
              {{ stepTitles[currentStep - 1] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success -->
    <div v-if="showSuccess" class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-lg p-10">
        <div class="flex flex-col items-center text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-5">
            <svg
              class="w-10 h-10 text-green-600"
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
          <h2 class="text-3xl font-bold text-navy-500 mb-2">
            Booking Confirmed!
          </h2>
          <p class="text-slate-500">
            Your appointment has been successfully scheduled. You will receive a confirmation shortly.
          </p>
        </div>

        <div class="space-y-4 mb-8">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Appointment Summary
          </h3>
          <div
            v-for="(sb, index) in bookingState.serviceBookings"
            :key="sb.serviceId"
            class="bg-slate-50 rounded-xl p-5 border border-slate-200"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-navy-50 text-navy-500 text-sm font-bold shrink-0">
                  {{ index + 1 }}
                </div>
                <div>
                  <p class="text-slate-800 font-semibold">
                    {{ sb.serviceName }}
                  </p>
                  <p v-if="sb.employeeName" class="text-slate-400 text-sm mt-0.5">
                    with {{ sb.employeeName }}
                  </p>
                </div>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 shrink-0">Confirmed</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
              <div class="flex items-center gap-1.5">
                <svg
                  class="w-4 h-4 text-slate-400"
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
                  class="w-4 h-4 text-slate-400"
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

        <button
          class="w-full px-6 py-3 bg-navy-500 hover:bg-navy-600 text-white font-medium rounded-lg transition-colors"
          @click="startNewBooking"
        >
          Book Another Appointment
        </button>
      </div>
    </div>

    <!-- Booking Flow -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Auth gate -->
      <template v-if="checkingAuth">
        <div class="flex items-center justify-center py-24">
          <svg class="w-10 h-10 animate-spin text-navy-400" fill="none" viewBox="0 0 24 24">
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
        <!-- Progress -->
        <div class="mb-8">
          <div class="overflow-hidden h-1.5 mb-4 rounded-full bg-slate-200">
            <div
              :style="{ width: progressPercentage + '%' }"
              class="h-full bg-navy-500 transition-all duration-500 rounded-full"
            />
          </div>

          <!-- Step indicators -->
          <div class="flex justify-between">
            <div
              v-for="(title, index) in stepTitles"
              :key="index"
              class="flex flex-col items-center flex-1"
            >
              <div
                class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all font-semibold text-sm"
                :class="[
                  currentStep > index + 1 ? 'bg-navy-500 border-navy-500 text-white'
                  : currentStep === index + 1 ? 'border-navy-500 text-navy-500 bg-white'
                    : 'border-slate-300 text-slate-400 bg-white'
                ]"
              >
                <span v-if="currentStep > index + 1">✓</span>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div
                class="mt-2 text-xs text-center hidden sm:block"
                :class="currentStep === index + 1 ? 'text-navy-500 font-medium' : 'text-slate-400'"
              >
                {{ title }}
              </div>
            </div>
          </div>
        </div>

        <!-- Step description -->
        <div class="mb-8 text-center">
          <p class="text-slate-500 text-base">
            {{ stepDescriptions[currentStep - 1] }}
          </p>
        </div>

        <!-- Step content -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">
          <StepServices v-if="currentStep === 1" />
          <StepEmployee2 v-else-if="currentStep === 2" />
          <StepDateTime2 v-else-if="currentStep === 3" />
        </div>

        <!-- Navigation -->
        <div class="flex items-center justify-between gap-4">
          <button
            v-if="currentStep > 1"
            class="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center gap-2"
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

          <!-- Next (steps 1–2) -->
          <button
            v-if="currentStep < 3"
            :disabled="!canProceed"
            class="px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 ml-auto"
            :class="canProceed ? 'bg-navy-500 hover:bg-navy-600 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
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

          <!-- Book Now (step 3) -->
          <button
            v-if="currentStep === 3"
            :disabled="!canSubmit || submitBookingLoading"
            class="px-8 py-3 font-semibold rounded-lg transition-colors flex items-center gap-2 ml-auto"
            :class="canSubmit && !submitBookingLoading ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
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
      </template>
    </div>
  </div>
</template>
