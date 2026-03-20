import { ref, computed } from 'vue'

export interface ServiceBooking {
  serviceId: string
  serviceName?: string
  date: string | null
  time: string | null
  employeeId: string | null
  employeeName?: string
}

export interface BookingFlowState {
  clientProfileId: string | null
  selectedServices: string[]
  serviceBookings: ServiceBooking[]
  customerInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    gender: 'male' | 'female' | 'other' | ''
  }
  existingCustomerId: string | null
}

const bookingState = ref<BookingFlowState>({
  clientProfileId: null,
  selectedServices: [],
  serviceBookings: [],
  customerInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: ''
  },
  existingCustomerId: null
})

const currentStep = ref(1)

export const useBookingFlow = () => {
  const resetBooking = () => {
    const savedClientProfileId = bookingState.value.clientProfileId
    bookingState.value = {
      clientProfileId: savedClientProfileId, // Preserve the client profile ID
      selectedServices: [],
      serviceBookings: [],
      customerInfo: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: ''
      },
      existingCustomerId: null
    }
    currentStep.value = 1
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      currentStep.value = step
    }
  }

  const nextStep = () => {
    if (currentStep.value < 4) {
      currentStep.value++
    }
  }

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  const canProceedToStep2 = computed(() => {
    return bookingState.value.selectedServices.length > 0
  })

  const canProceedToStep3 = computed(() => {
    // Check if all services have date and time selected
    return bookingState.value.serviceBookings.length === bookingState.value.selectedServices.length &&
           bookingState.value.serviceBookings.every(sb => sb.date && sb.time)
  })

  const canProceedToStep4 = computed(() => {
    // Check if all services have employees assigned
    return bookingState.value.serviceBookings.length === bookingState.value.selectedServices.length &&
           bookingState.value.serviceBookings.every(sb => sb.employeeId)
  })

  const isComplete = computed(() => {
    const info = bookingState.value.customerInfo
    return info.firstName && info.lastName && info.email && info.phone && info.gender
  })

  // Helper functions for service bookings
  const updateServiceBookings = (serviceIds: string[], services?: any[]) => {
    const currentBookings = new Map(bookingState.value.serviceBookings.map(sb => [sb.serviceId, sb]))

    bookingState.value.serviceBookings = serviceIds.map(serviceId => {
      const existing = currentBookings.get(serviceId)
      const service = services?.find(s => s.id === serviceId)

      return existing || {
        serviceId,
        serviceName: service?.name || '',
        date: null,
        time: null,
        employeeId: null,
        employeeName: ''
      }
    })
  }

  const updateServiceBooking = (serviceId: string, updates: Partial<ServiceBooking>) => {
    const index = bookingState.value.serviceBookings.findIndex(sb => sb.serviceId === serviceId)
    if (index !== -1) {
      bookingState.value.serviceBookings[index] = {
        ...bookingState.value.serviceBookings[index],
        ...updates
      }
    }
  }

  const getServiceBooking = (serviceId: string) => {
    return bookingState.value.serviceBookings.find(sb => sb.serviceId === serviceId)
  }

  return {
    bookingState,
    currentStep,
    resetBooking,
    goToStep,
    nextStep,
    prevStep,
    canProceedToStep2,
    canProceedToStep3,
    canProceedToStep4,
    isComplete,
    updateServiceBookings,
    updateServiceBooking,
    getServiceBooking
  }
}
