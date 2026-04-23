<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'auth-complete', customerId: string): void
}>()

const supabase = useSupabaseClient()
const toast = useToast()

type View = 'checking' | 'login' | 'signup' | 'complete-profile' | 'verify-email'
const view = ref<View>('checking')
const loading = ref(false)
const pendingCustomerId = ref('')

const loginForm = reactive({ email: '', password: '' })
const signupForm = reactive({
  full_name: '',
  email: '',
  password: '',
  phone_number: '',
  gender: '',
  date_of_birth: ''
})
const profileForm = reactive({ phone_number: '', gender: '', date_of_birth: '' })

// Use onAuthStateChange as primary handler — this correctly fires after Google OAuth
// code exchange completes, avoiding race conditions with getSession()
let authHandled = false

onMounted(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !authHandled) {
      authHandled = true
      await processUser(session.access_token, session.user)
    } else if (event === 'INITIAL_SESSION' && !session) {
      view.value = 'login'
    }
  })

  onUnmounted(() => subscription.unsubscribe())
})

async function processUser(initialToken: string, user: any) {
  let token = initialToken
  loading.value = true
  try {
    const existingRole = user.user_metadata?.role

    // Block employees/admins from using the booking flow
    if (existingRole === 'employee' || existingRole === 'admin') {
      await supabase.auth.signOut()
      toast.add({
        title: 'Staff account detected',
        description: 'Please use the staff login page instead.',
        color: 'error'
      })
      view.value = 'login'
      loading.value = false
      return
    }

    // Always ensure booking-page sign-ins are tagged as customer
    if (existingRole !== 'customer') {
      await supabase.auth.updateUser({ data: { role: 'customer' } })
      // Get fresh token after updateUser — the old token may be stale
      const { data: { session: fresh } } = await supabase.auth.getSession()
      if (fresh) token = fresh.access_token
    }

    const res: any = await $fetch('/api/customer-auth', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        full_name: user.user_metadata?.full_name || user.user_metadata?.name
      }
    })

    if (res?.customer) {
      // If phone number is missing, ask them to complete their profile
      if (!res.customer.phone_number) {
        pendingCustomerId.value = res.customer.id
        view.value = 'complete-profile'
      } else {
        emit('auth-complete', res.customer.id)
      }
    } else {
      view.value = 'login'
    }
  } catch {
    view.value = 'login'
  } finally {
    loading.value = false
  }
}

async function googleSignIn() {
  loading.value = true
  try {
    // Store current booking URL so the callback page can return here after auth
    if (import.meta.client) {
      localStorage.setItem('bookingReturnUrl', window.location.href)
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: import.meta.client ? `${window.location.origin}/auth/callback` : undefined,
        queryParams: { prompt: 'select_account' }
      }
    })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
    loading.value = false
  }
}

async function emailSignIn() {
  if (!loginForm.email || !loginForm.password) {
    toast.add({ title: 'Required', description: 'Enter your email and password', color: 'error' })
    return
  }
  loading.value = true
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password
    })
    if (error) throw error
    await processUser(data.session!.access_token, data.user)
  } catch (e: any) {
    toast.add({ title: 'Sign in failed', description: e.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function emailSignUp() {
  if (!signupForm.full_name || !signupForm.email || !signupForm.password) {
    toast.add({ title: 'Required fields missing', description: 'Name, email and password are required', color: 'error' })
    return
  }
  if (!signupForm.phone_number || !signupForm.gender || !signupForm.date_of_birth) {
    toast.add({ title: 'Required fields missing', description: 'Phone number, gender and date of birth are required', color: 'error' })
    return
  }
  loading.value = true
  try {
    const { data, error } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
      options: {
        data: { role: 'customer', full_name: signupForm.full_name }
      }
    })
    if (error) throw error

    if (!data.session) {
      // Email confirmation required
      view.value = 'verify-email'
      return
    }

    // Create customer record with all form data
    const res: any = await $fetch('/api/customer-auth', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: {
        full_name: signupForm.full_name,
        phone_number: signupForm.phone_number || null,
        gender: signupForm.gender || null,
        date_of_birth: signupForm.date_of_birth || null
      }
    })
    if (res?.customer) {
      toast.add({ title: 'Welcome!', description: 'Account created', color: 'success' })
      emit('auth-complete', res.customer.id)
    }
  } catch (e: any) {
    toast.add({ title: 'Sign up failed', description: e.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!profileForm.phone_number || !profileForm.gender || !profileForm.date_of_birth) {
    toast.add({ title: 'Required fields missing', description: 'Phone number, gender and date of birth are all required', color: 'error' })
    return
  }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await $fetch('/api/customer-auth', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: profileForm
      })
    }
    emit('auth-complete', pendingCustomerId.value)
  } catch {
    toast.add({ title: 'Error', description: 'Failed to save profile. Please try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh] px-4">
    <!-- Checking session -->
    <div v-if="view === 'checking'" class="flex flex-col items-center gap-4 text-slate-600">
      <svg class="w-10 h-10 animate-spin text-navy-400" fill="none" viewBox="0 0 24 24">
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
      <p class="text-slate-400">
        Checking your session…
      </p>
    </div>

    <!-- Email verification sent -->
    <div v-else-if="view === 'verify-email'" class="max-w-sm w-full text-center">
      <div class="w-16 h-16 bg-navy-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          class="w-8 h-8 text-navy-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 class="text-xl font-bold text-slate-800 mb-2">
        Check your email
      </h2>
      <p class="text-white mb-6">
        We sent a confirmation link to <strong class="text-slate-800">{{ signupForm.email }}</strong>. Click it to activate your account, then return here to book.
      </p>
      <button class="text-navy-500 hover:underline text-sm" @click="view = 'signup'">
        ← Back to sign up
      </button>
    </div>

    <!-- Complete profile (after Google / missing phone) -->
    <div v-else-if="view === 'complete-profile'" class="max-w-sm w-full">
      <h2 class="text-2xl font-bold text-slate-800 mb-1">
        One more step
      </h2>
      <p class="text-white mb-6">
        Help us reach you about your appointment
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Phone Number <span class="text-red-500">*</span></label>
          <input
            v-model="profileForm.phone_number"
            type="tel"
            placeholder="+1 234 567 8900"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Gender <span class="text-red-500">*</span></label>
          <select v-model="profileForm.gender" required class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400">
            <option value="" disabled>
              Select…
            </option>
            <option value="Male">
              Male
            </option>
            <option value="Female">
              Female
            </option>
            <option value="Other">
              Other
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Date of Birth <span class="text-red-500">*</span></label>
          <input
            v-model="profileForm.date_of_birth"
            type="date"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
      </div>

      <div class="mt-6">
        <button
          class="w-full px-6 py-3 bg-navy-500 hover:bg-navy-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          :disabled="loading"
          @click="saveProfile()"
        >
          <svg
            v-if="loading"
            class="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          Save & Continue
        </button>
      </div>
    </div>

    <!-- Login / Signup -->
    <div v-else class="max-w-sm w-full">
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        <button
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          :class="view === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          @click="view = 'login'"
        >
          Sign In
        </button>
        <button
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          :class="view === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          @click="view = 'signup'"
        >
          Create Account
        </button>
      </div>

      <h2 class="text-2xl font-bold text-slate-800 mb-1">
        {{ view === 'login' ? 'Welcome back' : 'Create your account' }}
      </h2>
      <p class="text-slate-500 mb-1">
        {{ view === 'login' ? 'Sign in to book your appointment' : 'Sign up to start booking' }}
      </p>
      <p v-if="view === 'signup'" class="text-sm text-navy-500 bg-navy-50 border border-navy-100 rounded-lg px-3 py-2 mb-4">
        First time booking? Create an account and your details will be saved — no need to fill them in again next time. 🎉
      </p>

      <!-- Google button -->
      <button
        class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors mb-4 disabled:opacity-60"
        :disabled="loading"
        @click="googleSignIn"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1 h-px bg-slate-200" />
        <span class="text-slate-400 text-sm">or</span>
        <div class="flex-1 h-px bg-slate-200" />
      </div>

      <!-- Login form -->
      <form v-if="view === 'login'" class="space-y-4" @submit.prevent="emailSignIn">
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Email</label>
          <input
            v-model="loginForm.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Password</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <button
          type="submit"
          class="w-full px-6 py-3 bg-navy-500 hover:bg-navy-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          :disabled="loading"
        >
          <svg
            v-if="loading"
            class="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          Sign In
        </button>
      </form>

      <!-- Signup form -->
      <form v-else class="space-y-4" @submit.prevent="emailSignUp">
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Full Name <span class="text-red-500">*</span></label>
          <input
            v-model="signupForm.full_name"
            type="text"
            placeholder="Jane Doe"
            autocomplete="name"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Email <span class="text-red-500">*</span></label>
          <input
            v-model="signupForm.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Password <span class="text-red-500">*</span></label>
          <input
            v-model="signupForm.password"
            type="password"
            placeholder="Min. 6 characters"
            autocomplete="new-password"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Phone Number <span class="text-red-500">*</span></label>
          <input
            v-model="signupForm.phone_number"
            type="tel"
            placeholder="+1 234 567 8900"
            autocomplete="tel"
            required
            class="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400"
          >
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-slate-600 mb-1">Gender <span class="text-red-500">*</span></label>
            <select v-model="signupForm.gender" required class="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 text-sm">
              <option value="" disabled>
                Select…
              </option>
              <option value="Male">
                Male
              </option>
              <option value="Female">
                Female
              </option>
              <option value="Other">
                Other
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-600 mb-1">Date of Birth <span class="text-red-500">*</span></label>
            <input
              v-model="signupForm.date_of_birth"
              type="date"
              required
              class="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 text-sm"
            >
          </div>
        </div>
        <button
          type="submit"
          class="w-full px-6 py-3 bg-navy-500 hover:bg-navy-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          :disabled="loading"
        >
          <svg
            v-if="loading"
            class="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          Create Account
        </button>
      </form>
    </div>
  </div>
</template>
