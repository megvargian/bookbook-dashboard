<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import type { Notification } from '~/types'

const { isNotificationsSlideoverOpen, notificationUnreadCount } = useDashboard()
const supabase = useSupabaseClient()

const notifications = ref<Notification[]>([])
const loading = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.is_read).length)

// Keep shared composable count in sync
watch(unreadCount, (val) => {
  notificationUnreadCount.value = val
})

const iconForType = (type: string) => {
  if (type === 'new_booking') return 'i-lucide-calendar-plus'
  if (type === 'status_update') return 'i-lucide-refresh-cw'
  return 'i-lucide-bell'
}

const colorForType = (type: string) => {
  if (type === 'new_booking') return 'text-green-400'
  if (type === 'status_update') return 'text-blue-400'
  return 'text-gray-400'
}

async function fetchNotifications() {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const data = await $fetch<Notification[]>('/api/notifications', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    notifications.value = data || []
  } catch {
    // silently fail — user may not be admin
  } finally {
    loading.value = false
  }
}

async function markAllRead() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { mark_all: true }
    })
    notifications.value = notifications.value.map(n => ({ ...n, is_read: true }))
  } catch { /* silent */ }
}

async function markRead(id: string) {
  if (notifications.value.find(n => n.id === id)?.is_read) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { id }
    })
    notifications.value = notifications.value.map(n => n.id === id ? { ...n, is_read: true } : n)
  } catch { /* silent */ }
}

// Fetch on mount (for badge count) and when slideover opens (for full list)
onMounted(() => fetchNotifications())

// Fetch when slideover opens
watch(isNotificationsSlideoverOpen, (open) => {
  if (open) fetchNotifications()
})
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notifications"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <span>Notifications</span>
        <UBadge
          v-if="unreadCount > 0"
          :label="String(unreadCount)"
          color="error"
          size="xs"
        />
      </div>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-10">
        <svg class="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
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

      <!-- Empty state -->
      <div v-else-if="notifications.length === 0" class="flex flex-col items-center gap-2 py-12 text-gray-400">
        <UIcon name="i-lucide-bell-off" class="w-8 h-8" />
        <p class="text-sm">
          No notifications yet
        </p>
      </div>

      <!-- List -->
      <template v-else>
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="px-3 py-3 rounded-md hover:bg-elevated/50 flex items-start gap-3 relative -mx-3 cursor-pointer"
          :class="{ 'bg-elevated/30': !notification.is_read }"
          @click="markRead(notification.id)"
        >
          <!-- Icon -->
          <div class="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-elevated flex items-center justify-center">
            <UIcon :name="iconForType(notification.type)" class="w-4 h-4" :class="colorForType(notification.type)" />
          </div>

          <div class="text-sm flex-1 min-w-0">
            <p class="flex items-center justify-between gap-2">
              <span class="font-medium text-highlighted truncate">{{ notification.title }}</span>
              <time :datetime="notification.created_at" class="text-muted text-xs shrink-0">
                {{ formatTimeAgo(new Date(notification.created_at)) }}
              </time>
            </p>
            <p class="text-dimmed mt-0.5 leading-snug">
              {{ notification.body }}
            </p>
          </div>

          <!-- Unread dot -->
          <span
            v-if="!notification.is_read"
            class="absolute right-3 top-3 w-2 h-2 rounded-full bg-error shrink-0"
          />
        </div>
      </template>
    </template>

    <template v-if="unreadCount > 0" #footer>
      <div class="flex justify-end px-1">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-check-check"
          label="Mark all as read"
          @click="markAllRead"
        />
      </div>
    </template>
  </USlideover>
</template>
