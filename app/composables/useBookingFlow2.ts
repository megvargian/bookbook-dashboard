import { ref, computed } from 'vue'

export interface ServiceBooking2 {
  serviceId: string
  serviceName?: string
  employeeId: string | null
  employeeName?: string
  date: string | null
  time: string | null
}

export interface BookingFlowState2 {
  clientProfileId: string | null
  selectedServices: string[]
  serviceBookings: ServiceBooking2[]
  customerId: string | null
}

const bookingState2 = ref<BookingFlowState2>({
  clientProfileId: null,
  selectedServices: [],
  serviceBookings: [],
  customerId: null
})

const currentStep2 = ref(1)

export const useBookingFlow2 = () => {
  const resetBooking = () => {
    const savedClientProfileId = bookingState2.value.clientProfileId
    const savedCustomerId = bookingState2.value.customerId
    bookingState2.value = {
      clientProfileId: savedClientProfileId,
      selectedServices: [],
      serviceBookings: [],
      customerId: savedCustomerId
    }
    currentStep2.value = 1
  }

  const nextStep = () => {
    if (currentStep2.value < 3) currentStep2.value++
  }

  const prevStep = () => {
    if (currentStep2.value > 1) currentStep2.value--
  }

  /** Step 1 → 2: at least one service selected */
  const canProceedToStep2 = computed(() =>
    bookingState2.value.selectedServices.length > 0
  )

  /** Step 2 → 3: every service has an employee assigned */
  const canProceedToStep3 = computed(() =>
    bookingState2.value.serviceBookings.length > 0 &&
    bookingState2.value.serviceBookings.length === bookingState2.value.selectedServices.length &&
    bookingState2.value.serviceBookings.every(sb => sb.employeeId)
  )

  /** Step 3 → Submit: every service has date + time */
  const canSubmit = computed(() =>
    bookingState2.value.serviceBookings.length > 0 &&
    bookingState2.value.serviceBookings.every(sb => sb.employeeId && sb.date && sb.time)
  )

  const updateServiceBookings = (serviceIds: string[], services?: any[]) => {
    const currentMap = new Map(bookingState2.value.serviceBookings.map(sb => [sb.serviceId, sb]))
    bookingState2.value.serviceBookings = serviceIds.map(serviceId => {
      const existing = currentMap.get(serviceId)
      const service = services?.find(s => s.id === serviceId)
      return existing || {
        serviceId,
        serviceName: service?.name || '',
        employeeId: null,
        employeeName: '',
        date: null,
        time: null
      }
    })
  }

  const updateServiceBooking = (serviceId: string, updates: Partial<ServiceBooking2>) => {
    const index = bookingState2.value.serviceBookings.findIndex(sb => sb.serviceId === serviceId)
    if (index !== -1) {
      bookingState2.value.serviceBookings[index] = {
        ...bookingState2.value.serviceBookings[index],
        ...updates
      }
    }
  }

  return {
    bookingState: bookingState2,
    currentStep: currentStep2,
    resetBooking,
    nextStep,
    prevStep,
    canProceedToStep2,
    canProceedToStep3,
    canSubmit,
    updateServiceBookings,
    updateServiceBooking
  }
}
