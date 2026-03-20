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

    const results = {}

    // Test different possible table names for bookings
    const tableVariants = ['bookings', 'booking', 'Bookings', 'Booking']

    for (const tableName of tableVariants) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        results[tableName] = {
          exists: !error,
          error: error?.message,
          sampleData: data
        }
      } catch (err) {
        results[tableName] = {
          exists: false,
          error: err.message
        }
      }
    }

    return {
      tableTests: results,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    return {
      error: 'Failed to test table names',
      details: error.message
    }
  }
})
