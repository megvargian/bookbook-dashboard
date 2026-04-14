<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const route = useRoute()
const status = ref('Exchanging session…')

onMounted(async () => {
  const code = route.query.code as string | undefined
  const errorParam = route.query.error as string | undefined
  const storedUrl = localStorage.getItem('bookingReturnUrl')
  localStorage.removeItem('bookingReturnUrl')
  const returnTo = storedUrl || '/'

  console.log('[auth/callback] code present:', !!code)
  console.log('[auth/callback] returnTo:', returnTo)

  // Handle OAuth errors passed back in the URL
  if (errorParam) {
    console.error('[auth/callback] OAuth error from provider:', route.query.error_description)
    status.value = `OAuth error: ${route.query.error_description || errorParam}`
    setTimeout(() => window.location.replace(returnTo), 3000)
    return
  }

  if (!code) {
    console.warn('[auth/callback] No code in URL — redirecting immediately')
    status.value = 'No code found, redirecting…'
    window.location.replace(returnTo)
    return
  }

  try {
    status.value = 'Exchanging code…'
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message, error)
      status.value = `Exchange failed: ${error.message}`
      setTimeout(() => window.location.replace(returnTo), 3000)
      return
    }

    console.log('[auth/callback] Session exchanged OK, user:', data?.session?.user?.email)
    status.value = 'Session ready, redirecting…'

    // Small delay to ensure the session is written to storage before the next page loads
    await new Promise(resolve => setTimeout(resolve, 300))
  } catch (e: any) {
    console.error('[auth/callback] Unexpected error:', e)
    status.value = `Unexpected error: ${e?.message}`
    setTimeout(() => window.location.replace(returnTo), 3000)
    return
  }

  window.location.replace(returnTo)
})
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-950 text-white">
    <svg class="w-8 h-8 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <p class="text-sm text-gray-400">
      {{ status }}
    </p>
  </div>
</template>
