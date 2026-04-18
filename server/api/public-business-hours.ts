import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/public-business-hours?client_profile_id=<uuid>
 *
 * Public endpoint — no auth required.
 * Returns opening_time, closing_time, open_days for the business
 * linked to the given client_profile_id.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseServiceKey = config.supabaseServiceKey || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase configuration missing' })
  }

  const query = getQuery(event)
  const clientProfileId = query.client_profile_id as string

  if (!clientProfileId || !/^[0-9a-f-]{36}$/i.test(clientProfileId)) {
    throw createError({ statusCode: 400, statusMessage: 'client_profile_id is required' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get the client_business_id from the client_profile
  const { data: profile, error: profileError } = await supabase
    .from('client_profile')
    .select('client_business_id')
    .eq('id', clientProfileId)
    .single()

  if (profileError || !profile?.client_business_id) {
    // Return defaults if no business linked
    return {
      opening_time: '09:00',
      closing_time: '18:00',
      open_days: [1, 2, 3, 4, 5]
    }
  }

  const { data: business, error: businessError } = await supabase
    .from('client_business')
    .select('opening_time, closing_time, open_days')
    .eq('id', profile.client_business_id)
    .single()

  if (businessError || !business) {
    return {
      opening_time: '09:00',
      closing_time: '18:00',
      open_days: [1, 2, 3, 4, 5]
    }
  }

  return {
    opening_time: business.opening_time ?? '09:00',
    closing_time: business.closing_time ?? '18:00',
    open_days: business.open_days ?? [1, 2, 3, 4, 5]
  }
})
