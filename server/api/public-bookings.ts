/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @stylistic/arrow-parens */
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sendBookingConfirmationToCustomer, sendBookingNotificationToAdmin } from '../utils/email'
// import { sendCustomerConfirmationWhatsApp } from '../utils/whatsapp'

// Schema for booking creation from public booking page
const createBookingSchema = z.object({
  client_profile_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  service_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  start_time: z.string(), // HH:MM format
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase configuration is missing'
    })
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const method = getMethod(event)

  // Only allow POST for public bookings
  if (method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed. Use POST to create bookings.'
    })
  }

  const body = await readBody(event)

  // Validate request body
  const validation = createBookingSchema.safeParse(body)
  if (!validation.success) {
    console.error('Validation failed:', validation.error)
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid booking data: ${validation.error?.errors?.map(e => e.message).join(', ') || 'Validation error'}`
    })
  }

  const { customer_id, client_profile_id, employee_id, service_id, booking_date, start_time, notes } = validation.data

  try {
    // Get client_business_id and admin email from client_profile
    const { data: clientProfile, error: clientProfileError } = await supabase
      .from('client_profile')
      .select('client_business_id, email, first_name, last_name')
      .eq('id', client_profile_id)
      .single()

    // Get admin WhatsApp number and business name from client_business
    // let businessPhone: string | null = null
    // let businessName: string | null = null
    // if (clientProfile?.client_business_id) {
    //   const { data: clientBusiness } = await supabase
    //     .from('client_business')
    //     .select('phone_number, name')
    //     .eq('id', clientProfile.client_business_id)
    //     .single()
    //   businessPhone = clientBusiness?.phone_number ?? null
    //   businessName = clientBusiness?.name ?? null
    // }

    if (clientProfileError || !clientProfile || !clientProfile.client_business_id) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Client profile not found or has no associated business'
      })
    }

    // Get service details to calculate end time
    const { data: service, error: serviceError } = await supabase
      .from('service')
      .select('duration_service_in_s, price')
      .eq('id', service_id)
      .single()

    if (serviceError || !service) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Service not found'
      })
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customer')
      .select('id')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Customer not found'
      })
    }

    // Convert start_time (HH:MM) to full UTC timestamp (append Z so it's stored as wall-clock UTC)
    const startDateTime = new Date(`${booking_date}T${start_time}:00Z`)
    const endDateTime = new Date(startDateTime.getTime() + (service.duration_service_in_s * 1000))

    // Format as ISO strings for database
    const startTimeISO = startDateTime.toISOString()
    const endTimeISO = endDateTime.toISOString()

    // Check for booking conflicts (same employee, overlapping time)
    const { data: conflicts, error: conflictError } = await supabase
      .from('booking')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('booking_date', booking_date)
      .or(`and(start_time.lte.${endTimeISO},end_time.gte.${startTimeISO})`)

    if (conflictError) {
      console.error('Error checking booking conflicts:', conflictError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to check booking availability'
      })
    }

    if (conflicts && conflicts.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This time slot is already booked'
      })
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('booking')
      .insert({
        customer_id,
        client_profile_id,
        client_business_id: clientProfile.client_business_id,
        employee_id,
        service_id,
        booking_date,
        start_time: startTimeISO,
        end_time: endTimeISO,
        status: 'confirmed',
        total_price: service.price,
        notes: notes || null
      })
      .select(`
        *,
        customer(*),
        employee(*),
        service(*)
      `)
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create booking: ${bookingError.message}`
      })
    }

    // Send email notifications (fire-and-forget — don't fail booking if email fails)
    console.log('[Booking] ==================== EMAIL NOTIFICATION PHASE ====================')
    console.log('[Booking] Preparing email notifications for booking:', booking.id)
    console.log('[Booking] Customer email available:', !!booking.customer?.email, '|', booking.customer?.email || 'MISSING')
    console.log('[Booking] Admin email available:', !!clientProfile.email, '|', clientProfile.email || 'MISSING')

    const emailPromises: Array<{ label: string; promise: Promise<void> }> = []

    if (booking.customer?.email) {
      console.log('[Booking] ✅ Adding customer email to queue:', booking.customer.email)
      emailPromises.push({ label: 'customer', promise: sendBookingConfirmationToCustomer(booking) })
    } else {
      console.warn(`[Booking] ⚠️ Skipping customer email — no email on booking ${booking.id}`)
      console.warn(`[Booking] Customer object:`, booking.customer ? JSON.stringify(booking.customer, null, 2) : 'NULL/MISSING')
    }

    if (clientProfile.email) {
      console.log('[Booking] ✅ Adding admin email to queue:', clientProfile.email)
      emailPromises.push({ label: 'admin', promise: sendBookingNotificationToAdmin(booking, clientProfile.email) })
    } else {
      console.warn(`[Booking] ⚠️ Skipping admin email — no email on client_profile ${client_profile_id}`)
      console.warn(`[Booking] ClientProfile object:`, JSON.stringify(clientProfile, null, 2))
    }

    // WhatsApp notifications (awaited — fire-and-forget is killed by serverless before completion)
    // const adminPhone = businessPhone || config.adminWhatsappPhone as string
    // await sendCustomerConfirmationWhatsApp(booking, businessName ?? undefined, adminPhone)

    if (emailPromises.length > 0) {
      console.log(`[Booking] Executing ${emailPromises.length} email notifications...`)
      Promise.allSettled(emailPromises.map(e => e.promise)).then((results) => {
        console.log('[Booking] ==================== EMAIL RESULTS ====================')
        results.forEach((result, i) => {
          const emailType = emailPromises[i].label
          if (result.status === 'rejected') {
            console.error(`[Booking] ❌ ${emailType} email FAILED for booking ${booking.id}:`)
            console.error(`[Booking] Error:`, result.reason)
            console.error(`[Booking] Error stack:`, result.reason?.stack)
          } else {
            console.log(`[Booking] ✅ ${emailType} email SUCCESS for booking ${booking.id}`)
          }
        })
        console.log('[Booking] ==================== EMAIL RESULTS END ====================')
      }).catch((error) => {
        console.error('[Booking] Unexpected error in email promises handling:', error)
      })
    } else {
      console.warn('[Booking] ⚠️ No emails will be sent - no valid email addresses found')
    }

    return booking
  } catch (error: any) {
    // Re-throw if it's already a formatted error
    if (error.statusCode) {
      throw error
    }

    console.error('Unexpected error creating public booking:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'An unexpected error occurred while creating the booking'
    })
  }
})
