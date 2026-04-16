<script setup lang="ts">
const props = withDefaults(defineProps<{
  services?: any[]
}>(), {
  services: () => []
})

const emit = defineEmits<{
  removeService: [id: string]
  editService: [service: any]
}>()

const expandedId = ref<string | null>(null)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDuration(seconds: number) {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}
</script>

<template>
  <div v-if="services?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="service in services"
      :key="service.id"
      class="group relative bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
    >
      <!-- Card top accent + icon -->
      <div class="h-2 w-full bg-gradient-to-r from-navy-500 to-navy-400" />

      <div class="flex-1 p-5 flex flex-col gap-3">
        <!-- Header row: icon + price -->
        <div class="flex items-start justify-between gap-2">
          <div class="w-10 h-10 rounded-xl bg-navy-50 dark:bg-navy-900/30 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-sparkles" class="w-5 h-5 text-navy-500" />
          </div>
          <span class="text-lg font-bold text-navy-600 dark:text-navy-300">${{ service.price }}</span>
        </div>

        <!-- Name -->
        <div>
          <h3 class="font-semibold text-slate-900 dark:text-white text-base leading-tight">
            {{ service.name }}
          </h3>

          <!-- Duration chip -->
          <div v-if="service.duration_service_in_s" class="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
            {{ formatDuration(service.duration_service_in_s) }}
          </div>
        </div>

        <!-- Description (collapsed / expanded) -->
        <p
          class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
          :class="expandedId === service.id ? '' : 'line-clamp-2'"
        >
          {{ service.description || 'No description provided.' }}
        </p>

        <button
          v-if="service.description && service.description.length > 80"
          class="text-xs text-navy-500 hover:text-navy-600 self-start -mt-1"
          @click="toggleExpand(service.id)"
        >
          {{ expandedId === service.id ? 'Show less' : 'Show more' }}
        </button>

        <!-- Categories -->
        <div v-if="service.categories?.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="cat in service.categories.slice(0, 3)"
            :key="cat"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300"
          >
            {{ cat }}
          </span>
          <span
            v-if="service.categories.length > 3"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-800 text-slate-500"
          >
            +{{ service.categories.length - 3 }}
          </span>
        </div>
      </div>

      <!-- Action row -->
      <div class="px-5 py-3 border-t border-slate-100 dark:border-gray-800 flex items-center gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
          @click="emit('editService', service)"
        >
          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          @click="emit('removeService', service.id)"
        >
          <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    </div>
  </div>

  <div v-else class="py-16 text-center">
    <UIcon name="i-lucide-sparkles" class="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
    <p class="text-sm text-slate-500 dark:text-slate-400">No services found</p>
  </div>
</template>
