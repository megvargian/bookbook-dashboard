<script setup lang="ts">
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

await userStore.fetchClientProfile()

const isAdmin = computed(() =>
  userStore.clientProfile?.role === 'admin' && userStore.clientProfile?.user_type === 'client'
)

if (!isAdmin.value) {
  throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
}

const loading = ref(false)
const saving = ref(false)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Local state
const openingTime = ref('09:00')
const closingTime = ref('18:00')
const openDays = ref<number[]>([1, 2, 3, 4, 5])

// Generate HH:MM options in 15-min increments from 00:00 to 23:45
const timeOptions = computed(() => {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      opts.push({ label: val, value: val })
    }
  }
  return opts
})

const toggleDay = (day: number) => {
  if (openDays.value.includes(day)) {
    openDays.value = openDays.value.filter(d => d !== day)
  } else {
    openDays.value = [...openDays.value, day].sort((a, b) => a - b)
  }
}

// Load existing business hours
onMounted(async () => {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const data: any = await $fetch('/api/business-hours', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    openingTime.value = data.opening_time ?? '09:00'
    closingTime.value = data.closing_time ?? '18:00'
    openDays.value = data.open_days ?? [1, 2, 3, 4, 5]
  } catch (e: any) {
    toast.add({ title: 'Failed to load business hours', color: 'error' })
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No session')

    await $fetch('/api/business-hours', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        opening_time: openingTime.value,
        closing_time: closingTime.value,
        open_days: openDays.value
      }
    })
    toast.add({ title: 'Business hours saved', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Failed to save', description: e?.data?.statusMessage || e?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-8 p-4">
    <div>
      <h2 class="text-xl font-semibold mb-1">Business Hours</h2>
      <p class="text-sm text-gray-500">
        Define your opening and closing times. Customers won't be able to book outside these hours.
      </p>
    </div>

    <div v-if="loading" class="text-gray-400 py-8 text-center">Loading…</div>

    <template v-else>
      <!-- Opening Days -->
      <UPageCard title="Open Days" description="Select which days your business is open.">
        <div class="flex flex-wrap gap-2 mt-2">
          <button
            v-for="(name, index) in DAY_NAMES"
            :key="index"
            type="button"
            @click="toggleDay(index)"
            :class="[
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              openDays.includes(index)
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'
            ]"
          >
            {{ name }}
          </button>
        </div>
        <p v-if="openDays.length === 0" class="mt-2 text-sm text-red-400">
          At least one day must be open for bookings.
        </p>
      </UPageCard>

      <!-- Opening / Closing Time -->
      <UPageCard title="Opening Hours" description="Set your daily opening and closing time.">
        <div class="grid sm:grid-cols-2 gap-6 mt-2">
          <UFormField label="Opening Time">
            <USelect
              v-model="openingTime"
              :options="timeOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>

          <UFormField label="Closing Time">
            <USelect
              v-model="closingTime"
              :options="timeOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>
        </div>

        <p v-if="openingTime >= closingTime" class="mt-2 text-sm text-red-400">
          Closing time must be after opening time.
        </p>
      </UPageCard>

      <!-- Preview -->
      <UPageCard title="Preview" description="How your hours will appear to customers.">
        <div class="mt-2 space-y-1 text-sm">
          <div
            v-for="(name, index) in DAY_NAMES"
            :key="index"
            class="flex justify-between py-1 border-b border-gray-700 last:border-0"
          >
            <span :class="openDays.includes(index) ? 'text-white' : 'text-gray-500'">{{ name }}</span>
            <span :class="openDays.includes(index) ? 'text-green-400' : 'text-red-500'">
              {{ openDays.includes(index) ? `${openingTime} – ${closingTime}` : 'Closed' }}
            </span>
          </div>
        </div>
      </UPageCard>

      <!-- Save -->
      <div class="flex justify-end">
        <UButton
          :loading="saving"
          :disabled="openDays.length === 0 || openingTime >= closingTime"
          @click="save"
          color="primary"
          size="lg"
        >
          Save Business Hours
        </UButton>
      </div>
    </template>
  </div>
</template>
