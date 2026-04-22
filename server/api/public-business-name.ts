import { createClient } from '@supabase/supabase-js'

export default eventHandler(async (event) => {
  const { client_profile_id } = getQuery(event)

  if (!client_profile_id || typeof client_profile_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'client_profile_id is required' })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profile } = await supabase
    .from('client_profile')
    .select('client_business_id')
    .eq('id', client_profile_id)
    .single()

  if (!profile?.client_business_id) return { name: null }

  const { data: biz } = await supabase
    .from('client_business')
    .select('name')
    .eq('id', profile.client_business_id)
    .single()

  return { name: biz?.name ?? null }
})
