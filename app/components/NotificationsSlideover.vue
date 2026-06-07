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

// ── Notification chime (Web Audio API) ──────────────────────────────────
// AudioContext auto-suspends after inactivity. We must call resume() and
// AWAIT it before scheduling notes — otherwise the context is still suspended
// when the oscillators try to start.
let audioCtx: AudioContext | null = null
const toast = useToast()

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  } catch {
    return null
  }
}

// Unlock AudioContext on ANY user interaction — covers clicks, keyboard, touch
onMounted(() => {
  const unlock = () => {
    const ctx = getOrCreateAudioContext()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }
  ;(['click', 'keydown', 'pointerdown', 'touchstart'] as const).forEach(evt =>
    document.addEventListener(evt, unlock, { passive: true })
  )
  onUnmounted(() => {
    ;(['click', 'keydown', 'pointerdown', 'touchstart'] as const).forEach(evt =>
      document.removeEventListener(evt, unlock)
    )
  })
})

async function playNotificationSound() {
  try {
    const ctx = getOrCreateAudioContext()
    if (!ctx) return

    // Resume is async — MUST await before scheduling audio or notes are dropped
    if (ctx.state === 'suspended') await ctx.resume()
    if (ctx.state !== 'running') return

    const notes = [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 660, start: 0.22, duration: 0.30 }
    ]

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + start
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.4, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t)
      osc.stop(t + duration)
    })
  } catch {
    // Silently skip if Web Audio is unavailable
  }
}

// ── Supabase Realtime: live push for new notifications ──────────────────
onMounted(() => {
  const channel = supabase
    .channel('admin-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notification'
      },
      (payload) => {
        const incoming = payload.new as import('~/types').Notification
        const alreadyPresent = notifications.value.some(n => n.id === incoming.id)
        if (!alreadyPresent) {
          notifications.value = [incoming, ...notifications.value]

          // Toast popup — visible regardless of audio permissions
          toast.add({
            title: incoming.title || 'New Booking',
            description: incoming.body || '',
            icon: 'i-lucide-calendar-plus',
            color: 'success',
            duration: 6000
          })

          // Sound — async, fire-and-forget
          playNotificationSound()
        }
      }
    )
    .subscribe()

  onUnmounted(() => {
    supabase.removeChannel(channel)
  })
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
