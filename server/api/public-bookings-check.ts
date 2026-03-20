import { createClient } from '@supabase/supabase-js'

export default eventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const query = getQuery(event)

    // Get query parameters
    const date = query.date ? String(query.date) : null

    console.log('Public bookings query for date:', date)

    if (!date) {
      return []
    }

    // Fetch bookings for the specified date
    const { data: bookings, error } = await supabase
      .from('booking')
      .select('employee_id, service_id, booking_date, start_time, end_time, status')
      .eq('booking_date', date)
      .neq('status', 'cancelled') // Exclude cancelled bookings

    if (error) {
      console.error('Bookings fetch error:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch bookings'
      })
    }

    console.log(`Found ${bookings?.length || 0} bookings for ${date}`)
    return bookings || []

  } catch (error) {
    console.error('Public bookings API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
