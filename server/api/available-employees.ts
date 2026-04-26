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
    const serviceIds = query.service_ids ? String(query.service_ids).split(',').filter(Boolean) : []
    const date = query.date ? String(query.date) : null
    const time = query.time ? String(query.time) : null
    const duration = query.duration ? parseInt(String(query.duration)) : 3600 // Default 1 hour in seconds

    console.log('Available employees query:', { serviceIds, date, time, duration })

    if (!serviceIds.length) {
      return {
        success: false,
        message: 'Service IDs are required',
        employees: []
      }
    }

    // Step 1: Get employees who can provide the requested services
    const { data: employeeServices, error: esError } = await supabase
      .from('employee_services')
      .select('employee_id, service_id')
      .in('service_id', serviceIds)

    if (esError) {
      console.error('Employee services error:', esError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch employee services'
      })
    }

    // Get unique employee IDs who can provide at least one of the services
    const employeeIds = [...new Set(employeeServices?.map(es => es.employee_id) || [])]

    if (employeeIds.length === 0) {
      return {
        success: true,
        message: 'No employees can provide the requested services',
        employees: []
      }
    }

    // Step 2: Get employee details
    const { data: allEmployees, error: employeeError } = await supabase
      .from('employee')
      .select('*')
      .in('id', employeeIds)

    if (employeeError) {
      console.error('Employee fetch error:', employeeError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch employees'
      })
    }

    if (!allEmployees || allEmployees.length === 0) {
      return {
        success: true,
        message: 'No employees found',
        employees: []
      }
    }

    // Step 3: If date and time are provided, check availability
    let availableEmployees = allEmployees

    if (date && time) {
      // Convert time and duration to minutes for overlap checking
      const [timeHour, timeMinute] = time.split(':').map(Number)
      const startTimeInMinutes = timeHour * 60 + timeMinute
      const endTimeInMinutes = startTimeInMinutes + Math.ceil(duration / 60)

      // Map JS day index to day name
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const bookingDayName = DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()]

      console.log('Checking availability for time slot:', { date, time, startTimeInMinutes, endTimeInMinutes, bookingDayName })

      // Get existing bookings for the specified date
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('booking')
        .select('employee_id, start_time, end_time, booking_date')
        .eq('booking_date', date)
        .in('employee_id', employeeIds)

      if (bookingsError) {
        console.error('Bookings error:', bookingsError)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to check employee availability'
        })
      }

      console.log('Found existing bookings:', existingBookings?.length || 0)

      // Filter out employees who are busy or not working at the requested time
      const busyEmployeeIds = new Set()

      existingBookings?.forEach((booking) => {
        const bookingStartTime = booking.start_time.includes('T')
          ? booking.start_time.slice(11, 16)
          : booking.start_time.slice(0, 5)

        const bookingEndTime = booking.end_time.includes('T')
          ? booking.end_time.slice(11, 16)
          : booking.end_time.slice(0, 5)

        const [bookingStartHour, bookingStartMinute] = bookingStartTime.split(':').map(Number)
        const [bookingEndHour, bookingEndMinute] = bookingEndTime.split(':').map(Number)

        const bookingStartInMinutes = bookingStartHour * 60 + bookingStartMinute
        const bookingEndInMinutes = bookingEndHour * 60 + bookingEndMinute

        const hasOverlap = startTimeInMinutes < bookingEndInMinutes && endTimeInMinutes > bookingStartInMinutes

        if (hasOverlap) {
          busyEmployeeIds.add(booking.employee_id)
          console.log(`Employee ${booking.employee_id} is busy during requested time`)
        }
      })

      // Filter by: not busy + working day + shift hours
      availableEmployees = allEmployees.filter((emp: any) => {
        // 1. Must not have a conflicting booking
        if (busyEmployeeIds.has(emp.id)) return false

        // 2. Must be working on the selected day of week
        if (emp.working_week_days) {
          const days: string[] = Array.isArray(emp.working_week_days)
            ? emp.working_week_days
            : String(emp.working_week_days).split(',').map((s: string) => s.trim())
          if (!days.includes(bookingDayName)) {
            console.log(`Employee ${emp.id} does not work on ${bookingDayName}`)
            return false
          }
        }

        // 3. Must not have a scheduled day off on the booking date
        if (emp.days_off && Array.isArray(emp.days_off) && emp.days_off.includes(date)) {
          console.log(`Employee ${emp.id} has a day off on ${date}`)
          return false
        }

        // 4. Booking time window must fit within employee shift hours
        if (emp.start_working_hour && emp.end_working_hours) {
          const [shiftStartH, shiftStartM] = emp.start_working_hour.split(':').map(Number)
          const [shiftEndH, shiftEndM] = emp.end_working_hours.split(':').map(Number)
          const shiftStart = shiftStartH * 60 + shiftStartM
          const shiftEnd = shiftEndH * 60 + shiftEndM

          if (startTimeInMinutes < shiftStart || endTimeInMinutes > shiftEnd) {
            console.log(`Employee ${emp.id} shift ${emp.start_working_hour}-${emp.end_working_hours} does not cover ${time}`)
            return false
          }
        }

        return true
      })

      console.log(`Available employees after filtering: ${availableEmployees.length}`)
    }

    // Step 4: Add service information to each employee
    const employeesWithServices = availableEmployees.map(employee => {
      const employeeServiceIds = employeeServices
        ?.filter(es => es.employee_id === employee.id)
        ?.map(es => es.service_id) || []

      return {
        ...employee,
        can_provide_services: employeeServiceIds,
        matches_requested_services: serviceIds.some(sid => employeeServiceIds.includes(sid))
      }
    })

    return {
      success: true,
      message: `Found ${employeesWithServices.length} available employees`,
      employees: employeesWithServices,
      query_info: {
        requested_services: serviceIds,
        date: date,
        time: time,
        duration_seconds: duration
      }
    }

  } catch (error) {
    console.error('Available employees API error:', error)

    // Return a more user-friendly error response
    return {
      success: false,
      message: 'Failed to fetch available employees',
      employees: [],
      error: error.message || 'Internal server error'
    }
  }
})
