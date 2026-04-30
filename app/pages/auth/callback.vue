<!-- eslint-disable @stylistic/max-statements-per-line -->
<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const route = useRoute()
const status = ref('Signing you in…')

onMounted(() => {
  const code = route.query.code as string | undefined
  const errorParam = route.query.error as string | undefined
  const storedUrl = localStorage.getItem('bookingReturnUrl')
  localStorage.removeItem('bookingReturnUrl')
  const returnTo = storedUrl || '/'

  console.log('[auth/callback] code present:', !!code)
  console.log('[auth/callback] returnTo:', returnTo)

  if (errorParam) {
    status.value = `Error: ${route.query.error_description || errorParam}`
    console.error('[auth/callback] OAuth error:', route.query.error_description)
    setTimeout(() => { window.location.replace(returnTo) }, 3000)
    return
  }

  if (!code) {
    console.warn('[auth/callback] No code — redirecting immediately')
    window.location.replace(returnTo)
    return
  }

  // Listen for SIGNED_IN first, THEN exchange the code.
  // This guarantees the redirect fires from the auth event rather than
  // racing against the async return value which can be interrupted.
  let redirected = false
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !redirected) {
      redirected = true
      subscription.unsubscribe()

      // For customers (booking flow), ensure they have proper metadata
      if (returnTo.includes('/booking/') || returnTo.includes('/book/')) {
        console.log('[auth/callback] Booking page return detected, ensuring customer role')

        // Ensure user has customer role - fallback for OAuth flows
        if (!session.user?.user_metadata?.role) {
          try {
            await supabase.auth.updateUser({ data: { role: 'customer' } })
            console.log('[auth/callback] Customer role set via fallback')
          } catch (error) {
            console.warn('[auth/callback] Failed to set customer role:', error)
          }
        }

        // Set up customer auth for booking
        try {
          await $fetch('/api/customer-auth', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: {}
          })

          // Preserve step information for booking flow
          const savedStep = localStorage.getItem('bookingCurrentStep')
          if (savedStep) {
            // Keep the step in localStorage so the booking page can restore it
            console.log('[auth/callback] Preserving booking step:', savedStep)
          }
        } catch (error) {
          console.warn('[auth/callback] Customer auth setup failed, but continuing:', error)
        }
      } else if (session.user?.user_metadata?.role === 'customer') {
        console.log('[auth/callback] Customer authenticated, preparing redirect')
      }

      console.log('[auth/callback] Session confirmed, redirecting to:', returnTo)
      status.value = 'Redirecting…'
      window.location.replace(returnTo)
    }
  })

  // Exchange the code — this will trigger the SIGNED_IN event above
  status.value = 'Exchanging code…'
  supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) {
      subscription.unsubscribe()
      console.error('[auth/callback] Exchange error:', error.message)
      status.value = `Failed: ${error.message}`
      setTimeout(() => { window.location.replace(returnTo) }, 3000)
    }
  })
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
