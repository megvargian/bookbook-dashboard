import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL!
  const supabaseServiceKey = config.supabaseServiceKey || config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const method = getMethod(event)

  // Authenticate the caller
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }

  // POST: get-or-create customer record
  if (method === 'POST') {
    const body = await readBody(event)

    // 1. Try lookup by user_id
    const { data: byUserId } = await supabase
      .from('customer')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (byUserId) {
      return { customer: byUserId }
    }

    // 2. Try lookup by email (for existing anonymous customers)
    if (user.email) {
      const { data: byEmail } = await supabase
        .from('customer')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()

      if (byEmail) {
        // Link auth user to existing customer record
        const { data: linked } = await supabase
          .from('customer')
          .update({ user_id: user.id })
          .eq('id', byEmail.id)
          .select()
          .single()
        return { customer: linked || byEmail }
      }
    }

    // 3. Create new customer record
    const fullName = body.full_name
      || user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split('@')[0]
      || 'Customer'

    const insertData: Record<string, any> = {
      full_name: fullName,
      email: user.email,
      phone_number: body.phone_number || null,
      gender: body.gender || null,
      date_of_birth: body.date_of_birth || null
    }

    // Try inserting with user_id — gracefully fallback if column doesn't exist yet
    const { data: withUserId, error: withUserIdError } = await supabase
      .from('customer')
      .insert({ ...insertData, user_id: user.id })
      .select()
      .single()

    if (withUserIdError) {
      // Fallback: insert without user_id (column may not exist yet)
      const { data: fallback, error: fallbackError } = await supabase
        .from('customer')
        .insert(insertData)
        .select()
        .single()
      if (fallbackError) throw createError({ statusCode: 500, statusMessage: fallbackError.message })
      return { customer: fallback }
    }

    return { customer: withUserId }
  }

  // PATCH: update existing customer profile fields
  if (method === 'PATCH') {
    const body = await readBody(event)

    // Find customer by user_id
    const { data: existing } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
    }

    const updateData: Record<string, any> = {}
    if (body.phone_number !== undefined) updateData.phone_number = body.phone_number || null
    if (body.gender !== undefined) updateData.gender = body.gender || null
    if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth || null
    if (body.full_name) updateData.full_name = body.full_name

    const { data: updated } = await supabase
      .from('customer')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    return { customer: updated }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
