import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const method = getMethod(event)

  // Authenticate caller
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }

  // Resolve client_profile id for this admin
  const { data: profile } = await supabase
    .from('client_profile')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }

  // GET — fetch notifications for this admin
  if (method === 'GET') {
    const { data, error } = await supabase
      .from('notification')
      .select('*')
      .eq('client_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return data || []
  }

  // PATCH — mark notifications as read
  if (method === 'PATCH') {
    const body = await readBody(event)

    // mark_all=true marks every unread notification
    if (body?.mark_all) {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true })
        .eq('client_profile_id', profile.id)
        .eq('is_read', false)
      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      return { success: true }
    }

    // Otherwise mark a specific notification by id
    if (body?.id) {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true })
        .eq('id', body.id)
        .eq('client_profile_id', profile.id)
      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      return { success: true }
    }

    throw createError({ statusCode: 400, statusMessage: 'Provide id or mark_all:true' })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})

// ─── Fake legacy data kept only as reference (no longer exported) ──────────
const _legacy = [{
  id: 1,
  unread: true,
  sender: {
    name: 'Jordan Brown',
    email: 'jordan.brown@example.com',
    avatar: {
      src: 'https://i.pravatar.cc/128?u=2'
    }
  },
  body: 'sent you a message',
  date: new Date().toISOString()
}]
