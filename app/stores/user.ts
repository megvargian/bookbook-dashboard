import { defineStore } from 'pinia'
import type { ClientProfile } from '~/types/client_profile'
import type { User } from '~/types/user'

// Module-level promise so concurrent calls share a single in-flight fetch
let _fetchPromise: Promise<ClientProfile | null> | null = null

const PROFILE_CACHE_KEY = 'bb_client_profile'

function readCachedProfile(): ClientProfile | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id ? parsed : null
  } catch { return null }
}

function writeCachedProfile(profile: ClientProfile | null) {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (profile?.id) sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    else sessionStorage.removeItem(PROFILE_CACHE_KEY)
  } catch { /* quota exceeded or private mode — silently skip */ }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: {
      id: '', // uuid
      created_at: '', // timestamp with time zone
      email: '',
      display_name: ''
    } as User | null,
    clientProfile: {
      id: '', // uuid
      created_at: '', // timestamp with time zone
      email: '',
      password: '',
      role: '',
      address: '',
      first_name: '',
      last_name: '',
      profile_picture: '', // now text (URL)
      client_business_id: '' // uuid
    } as ClientProfile | null
  }),
  actions: {
    setUser(userData: ClientProfile) {
      this.user = userData
    },
    setClientProfile(profile: ClientProfile) {
      this.clientProfile = profile
    },
    clearUser() {
      this.user = {} as ClientProfile | null
      this.clientProfile = null
      _fetchPromise = null
      writeCachedProfile(null)
    },
    isProfileLoaded() {
      return this.clientProfile && this.clientProfile.id
    },
    async fetchClientProfile(forceRefresh = false) {
      // 1. Already in memory
      if (!forceRefresh && this.isProfileLoaded()) return this.clientProfile

      // 2. Deduplicate concurrent calls — return the same in-flight promise
      if (!forceRefresh && _fetchPromise) return _fetchPromise

      // 3. Check sessionStorage (survives page refresh, not cross-tab)
      if (!forceRefresh && import.meta.client) {
        const cached = readCachedProfile()
        if (cached) {
          this.setClientProfile(cached)
          return cached
        }
      }

      // 4. Fetch from API
      _fetchPromise = (async () => {
        try {
          const supabase = useSupabaseClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return null

          const result = await $fetch('/api/client-profile/get-client-profile', {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.access_token}` }
          }) as { profile: ClientProfile }

          if (result?.profile) {
            this.setClientProfile(result.profile)
            writeCachedProfile(result.profile)
            return result.profile
          }
          return null
        } catch (error) {
          console.error('Failed to fetch client profile:', error)
          return null
        } finally {
          _fetchPromise = null
        }
      })()

      return _fetchPromise
    }
  }
})
