<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'light'
const userStore = useUserStore()
const supabase = useSupabaseClient()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

// Fetch client profile on app initialization and auth changes
onMounted(async () => {
  // Ensure we have a session before fetching profile
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await userStore.fetchClientProfile()
    console.log('Client Profile on Mount:', userStore.clientProfile)
  }
})

// Watch for auth state changes and refetch profile
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, !!session)
  if (event === 'SIGNED_IN' && session) {
    await userStore.fetchClientProfile()
  } else if (event === 'SIGNED_OUT') {
    userStore.clearUser()
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Also fetch profile on token refresh to ensure data is up to date
    await userStore.fetchClientProfile()
  }
})

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/bookbook-fav-icon-1.png' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'BookBook Dashboard'
const description = 'Manage your appointments, services, and staff with ease using the BookBook Dashboard. Our intuitive interface allows you to efficiently handle bookings, view statistics, and customize your business settings all in one place.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://dashboard.bookbook.me/bookbook-fav-icon-1.png',
  twitterImage: 'https://dashboard.bookbook.me/bookbook-fav-icon-1.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
