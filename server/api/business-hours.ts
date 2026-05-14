import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * GET  /api/business-hours  — fetch current business hours (admin only)
 * PUT  /api/business-hours  — update business hours (admin only)
 */

const updateSchema = z.object({
  opening_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  closing_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  open_days: z.array(z.coerce.number().int().min(0).max(6)).min(0)
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseServiceKey = config.supabaseServiceKey || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase configuration missing' })
  }

  // Auth: require a valid session
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  // Get the admin's client_profile and linked business (with employee fallback)
  let businessId: string | null = null

  const { data: profile } = await supabase
    .from('client_profile')
    .select('client_business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  businessId = profile?.client_business_id ?? null

  if (!businessId) {
    const { data: empRecord } = await supabase
      .from('employee')
      .select('client_business_id')
      .eq('id', user.id)
      .maybeSingle()
    businessId = empRecord?.client_business_id ?? null
  }

  if (!businessId) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found for this user' })
  }

  const method = getMethod(event)

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('client_business')
      .select('opening_time, closing_time, open_days')
      .eq('client_business_id', businessId)
      .maybeSingle()

    if (error) {
      console.error('business-hours GET error:', error)
      // Return defaults if columns don't exist yet (migration pending) or other DB error
      return {
        opening_time: '09:00',
        closing_time: '18:00',
        open_days: [1, 2, 3, 4, 5]
      }
    }

    return {
      opening_time: data?.opening_time ?? '09:00',
      closing_time: data?.closing_time ?? '18:00',
      open_days: Array.isArray(data?.open_days)
        ? data.open_days.map((d: string | number) => Number(d))
        : [1, 2, 3, 4, 5]
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: validation.error.issues.map((e: { message: string }) => e.message).join(', ')
      })
    }

    const { opening_time, closing_time, open_days } = validation.data

    const { error } = await supabase
      .from('client_business')
      .update({ opening_time, closing_time, open_days })
      .eq('id', businessId)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to update business hours' })
    }

    return { success: true, opening_time, closing_time, open_days }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
