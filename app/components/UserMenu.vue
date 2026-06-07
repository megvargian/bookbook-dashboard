<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useUserStore } from '~/stores/user'

defineProps<{
  collapsed?: boolean
}>()

const supabaseUser = useSupabaseUser()
const supabase = useSupabaseClient()
const userStore = useUserStore()

// Use store profile data — no direct Supabase query needed
const user = computed(() => {
  const p = userStore.clientProfile
  const firstName = p?.first_name || supabaseUser.value?.user_metadata?.first_name || ''
  const lastName = p?.last_name || supabaseUser.value?.user_metadata?.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim() || supabaseUser.value?.email || 'User'
  const initials = firstName && lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : (supabaseUser.value?.email?.charAt(0) || 'U').toUpperCase()

  return {
    name: fullName,
    avatar: {
      src: p?.profile_picture || undefined,
      alt: fullName,
      text: initials
    }
  }
})

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: user.value.name,
  avatar: user.value.avatar
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings'
}], [{
  label: 'Log out',
  icon: 'i-lucide-log-out',
  onSelect: async () => {
    try {
      console.log('Starting logout process...')

      // Clear user store first
      const userStore = useUserStore()
      userStore.clearUser()

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
        throw error
      }

      console.log('Successfully logged out, navigating to login...')

      // Force navigation to login page
      await navigateTo('/login', { replace: true })

      // Reload the page as fallback to ensure clean state
      window.location.href = '/login'
    } catch (error) {
      console.error('Error during logout:', error)

      // Force redirect as fallback even if there's an error
      window.location.href = '/login'
    }
  }
}]])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...user,
        label: collapsed ? undefined : user?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

  </UDropdownMenu>
</template>
