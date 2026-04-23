import { createClient } from '@supabase/supabase-js'

/**
 * Returns time slots for a given employee on a given date.
 * Each slot is flagged as available or unavailable.
 *
 * Query params:
 *  - employee_id  (required)
 *  - date         YYYY-MM-DD (required)
 *  - duration     seconds (default 3600)
 *  - interval     slot interval in minutes (default 30)
 */

export default eventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL || config.public?.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase configuration missing' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const query = getQuery(event)

  const employeeId = query.employee_id ? String(query.employee_id) : null
  const date = query.date ? String(query.date) : null
  const durationSeconds = query.duration ? parseInt(String(query.duration)) : 3600
  const intervalMinutes = query.interval ? parseInt(String(query.interval)) : 30

  if (!employeeId || !date) {
    throw createError({ statusCode: 400, statusMessage: 'employee_id and date are required' })
  }

  // 1. Fetch employee details (shift hours + working days)
  const { data: employee, error: empError } = await supabase
    .from('employee')
    .select('id, start_working_hour, end_working_hours, working_week_days')
    .eq('id', employeeId)
    .single()

  if (empError || !employee) {
    throw createError({ statusCode: 404, statusMessage: 'Employee not found' })
  }

  // 2. Check if employee works on the requested day of week
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayOfWeek = DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()]

  let worksOnDay = true
  if (employee.working_week_days) {
    const workingDays: string[] = Array.isArray(employee.working_week_days)
      ? employee.working_week_days
      : String(employee.working_week_days).split(',').map((s: string) => s.trim())
    worksOnDay = workingDays.includes(dayOfWeek)
  }

  if (!worksOnDay) {
    return { slots: [], reason: 'Employee does not work on this day' }
  }

  // 3. Determine shift boundaries (default 09:00–18:00)
  const parseTime = (t: string | null | undefined, fallback: string) => {
    const str = t || fallback
    const [h, m] = str.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const shiftStart = parseTime(employee.start_working_hour, '09:00')
  const shiftEnd = parseTime(employee.end_working_hours, '18:00')
  const durationMinutes = Math.ceil(durationSeconds / 60)

  // 4. Fetch existing bookings for this employee on this date
  const { data: existingBookings } = await supabase
    .from('booking')
    .select('start_time, end_time')
    .eq('employee_id', employeeId)
    .eq('booking_date', date)

  // Build busy ranges in minutes
  const busyRanges: { start: number; end: number }[] = (existingBookings || []).map((b: any) => {
    const startStr = b.start_time?.includes('T') ? b.start_time.slice(11, 16) : b.start_time?.slice(0, 5) || '00:00'
    const endStr = b.end_time?.includes('T') ? b.end_time.slice(11, 16) : b.end_time?.slice(0, 5) || '00:00'
    return {
      start: parseTime(startStr, '00:00'),
      end: parseTime(endStr, '00:00')
    }
  })

  // 5. Generate slots every `intervalMinutes` within shift
  const slots: { time: string; available: boolean; reason?: string }[] = []

  for (let t = shiftStart; t + durationMinutes <= shiftEnd; t += intervalMinutes) {
    const slotEnd = t + durationMinutes
    const hour = Math.floor(t / 60).toString().padStart(2, '0')
    const minute = (t % 60).toString().padStart(2, '0')
    const timeStr = `${hour}:${minute}`

    // Check if this slot overlaps any existing booking
    const conflict = busyRanges.some(range => t < range.end && slotEnd > range.start)

    slots.push({
      time: timeStr,
      available: !conflict,
      reason: conflict ? 'Already booked' : undefined
    })
  }

  return { slots, shiftStart: employee.start_working_hour, shiftEnd: employee.end_working_hours, dayOfWeek }
})
