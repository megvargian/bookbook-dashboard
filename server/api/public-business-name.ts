import { createClient } from '@supabase/supabase-js'

export default eventHandler(async (event) => {
  const { slug } = getQuery(event)

  if (!slug || typeof slug !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'slug is required' })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = (config.supabaseServiceKey || config.supabase?.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Step 1: Query client_business by slug
  const { data: biz, error } = await supabase
    .from('client_business')
    .select('client_business_id, name')
    .eq('slug', slug)
    .single()

  if (error || !biz) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }

  // Step 2: Query client_profile using client_business_id foreign key
  const { data: profile } = await supabase
    .from('client_profile')
    .select('id')
    .eq('client_business_id', biz.client_business_id)
    .single()

  console.log('[public-business-name] profile:', profile)

  if (!profile?.id) {
    throw createError({ statusCode: 404, statusMessage: 'No profile linked to this business' })
  }

  return {
    clientProfileId: profile.id as string,
    businessName: biz.name as string
  }
})
