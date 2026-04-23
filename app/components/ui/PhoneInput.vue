<!-- Phone input with country code selector and flags -->
<script setup lang="ts">
import { useCountryDetection } from '~/composables/useCountryDetection'
import { countries, getCountryByCode, searchCountries, type Country } from '~/utils/countries'

interface Props {
  modelValue?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  class?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Enter phone number',
  required: false,
  disabled: false
})

const emit = defineEmits<Emits>()

// Country detection
const { detectedCountry } = useCountryDetection()

// Selected country and phone number
const selectedCountry = ref<Country>(getCountryByCode('US')!) // Default to US
const phoneNumber = ref('')
const searchQuery = ref('')
const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement>()

// Auto-select detected country when available
watch(detectedCountry, (newCountry) => {
  if (newCountry && getCountryByCode(newCountry)) {
    selectedCountry.value = getCountryByCode(newCountry)!
  }
})

// Initialize from modelValue if provided
onMounted(() => {
  if (props.modelValue) {
    parseFullNumber(props.modelValue)
  }
})

// Parse full phone number (e.g., "+1234567890") into country code + number
const parseFullNumber = (fullNumber: string) => {
  if (!fullNumber.startsWith('+')) {
    phoneNumber.value = fullNumber
    return
  }

  // Find matching country by dial code
  const matchingCountries = countries
    .filter(c => fullNumber.startsWith(c.dialCode))
    .sort((a, b) => b.dialCode.length - a.dialCode.length) // Longest match first

  if (matchingCountries.length > 0) {
    const country = matchingCountries[0]
    selectedCountry.value = country
    phoneNumber.value = fullNumber.slice(country.dialCode.length).trim()
  } else {
    phoneNumber.value = fullNumber
  }
}

// Emit full phone number when country or number changes
const updateFullNumber = () => {
  const fullNumber = phoneNumber.value.trim()
    ? `${selectedCountry.value.dialCode}${phoneNumber.value.replace(/^\+/, '')}`
    : ''
  emit('update:modelValue', fullNumber)
}

watch([selectedCountry, phoneNumber], updateFullNumber, { deep: true })

// Country search and selection
const filteredCountries = computed(() => {
  return searchCountries(searchQuery.value)
})

const selectCountry = (country: Country) => {
  selectedCountry.value = country
  isDropdownOpen.value = false
  searchQuery.value = ''
  nextTick(() => {
    const phoneInput = document.querySelector('.phone-number-input') as HTMLInputElement
    phoneInput?.focus()
  })
}

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
      isDropdownOpen.value = false
      searchQuery.value = ''
    }
  }

  document.addEventListener('click', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})

// Handle search input
const onSearchInput = (e: Event) => {
  searchQuery.value = (e.target as HTMLInputElement).value
}

// Handle phone number input
const onPhoneInput = (e: Event) => {
  phoneNumber.value = (e.target as HTMLInputElement).value
}
</script>

<template>
  <div class="relative" :class="class">
    <div class="flex">
      <!-- Country Code Selector -->
      <div ref="dropdownRef" class="relative">
        <button
          type="button"
          :disabled="disabled"
          class="flex items-center gap-2 px-3 py-3 bg-white border border-slate-300 border-r-0 rounded-l-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 disabled:opacity-60 disabled:cursor-not-allowed min-w-[85px] justify-center"
          @click="isDropdownOpen = !isDropdownOpen"
        >
          <span class="text-lg">{{ selectedCountry.flag }}</span>
          <span class="text-sm font-medium">{{ selectedCountry.dialCode }}</span>
          <svg
            class="w-4 h-4 text-slate-400 transition-transform"
            :class="{ 'rotate-180': isDropdownOpen }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Dropdown -->
        <div
          v-if="isDropdownOpen"
          class="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden"
        >
          <!-- Search -->
          <div class="p-3 border-b border-slate-200">
            <input
              :value="searchQuery"
              type="text"
              placeholder="Search countries..."
              class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-navy-400 focus:border-navy-400"
              @input="onSearchInput"
            >
          </div>

          <!-- Countries List -->
          <div class="max-h-48 overflow-y-auto">
            <button
              v-for="country in filteredCountries"
              :key="country.code"
              type="button"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none transition-colors"
              :class="{ 'bg-navy-50': country.code === selectedCountry.code }"
              @click="selectCountry(country)"
            >
              <span class="text-lg">{{ country.flag }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-800 truncate">{{ country.name }}</div>
                <div class="text-xs text-slate-500">{{ country.dialCode }}</div>
              </div>
              <span
                v-if="country.code === selectedCountry.code"
                class="text-navy-500"
              >
                ✓
              </span>
            </button>
          </div>

          <!-- No results -->
          <div
            v-if="filteredCountries.length === 0"
            class="p-4 text-sm text-slate-500 text-center"
          >
            No countries found
          </div>
        </div>
      </div>

      <!-- Phone Number Input -->
      <input
        :value="phoneNumber"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        type="tel"
        class="phone-number-input flex-1 px-4 py-3 bg-white border border-slate-300 rounded-r-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 disabled:opacity-60 disabled:cursor-not-allowed"
        autocomplete="tel"
        @input="onPhoneInput"
      >
    </div>

    <!-- Display full number for reference -->
    <div
      v-if="modelValue"
      class="mt-1 text-xs text-slate-500"
    >
      Full number: {{ modelValue }}
    </div>
  </div>
</template>
