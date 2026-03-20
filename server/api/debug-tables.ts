import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
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

    // Check what data exists in key tables
    const results = {
      timestamp: new Date().toISOString()
    }

    // Check employees table
    const { data: employees, error: empError } = await supabase
      .from('employee')
      .select('id, full_name, email')
      .limit(5)

    results.employees = {
      count: employees?.length || 0,
      sample: employees || [],
      error: empError?.message
    }

    // Check services table
    const { data: services, error: servError } = await supabase
      .from('service')
      .select('id, name, price')
      .limit(5)

    results.services = {
      count: services?.length || 0,
      sample: services || [],
      error: servError?.message
    }

    // Check employee_services junction table
    const { data: empServices, error: empServError } = await supabase
      .from('employee_services')
      .select('employee_id, service_id')
      .limit(10)

    results.employee_services = {
      count: empServices?.length || 0,
      sample: empServices || [],
      error: empServError?.message
    }

    // Check booking table (not bookings)
    const { data: bookings, error: bookError } = await supabase
      .from('booking')
      .select('employee_id, service_id, booking_date, start_time, end_time')
      .limit(5)

    results.booking = {
      count: bookings?.length || 0,
      sample: bookings || [],
      error: bookError?.message
    }

    return results

  } catch (error) {
    return {
      error: 'Diagnostic failed',
      details: error.message
    }
  }
})
