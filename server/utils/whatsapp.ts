/* eslint-disable @typescript-eslint/no-explicit-any */
import twilio from 'twilio'

// ─── Twilio client ────────────────────────────────────────────────────────────

function getTwilioClient() {
  const config = useRuntimeConfig()
  const sid = config.twilioAccountSid as string
  const token = config.twilioAuthToken as string
  if (!sid || !token) throw new Error('[WhatsApp] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set')
  return twilio(sid, token)
}

function waNumber(phone: string) {
  const cleaned = phone.replace(/\s+/g, '').replace(/[^+\d]/g, '')
  const e164 = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  return `whatsapp:${e164}`
}

async function send(to: string, body: string) {
  const config = useRuntimeConfig()
  const from = `whatsapp:${config.twilioWhatsappFrom || '+15559113759'}`
  const client = getTwilioClient()
  await client.messages.create({ from, to: waNumber(to), body })
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  // Parse as noon UTC so the date never shifts regardless of server timezone
  const datePart = (dateStr ?? '').split('T')[0]
  return new Date(datePart + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  })
}

function fmtTime(isoStr: string) {
  // Read UTC time directly since times are stored as UTC wall-clock time
  const d = new Date(isoStr)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Sends a booking confirmation to the customer using the approved template.
 * Template: "Hello {{1}}, Your booking at {{2}} is confirmed. Date: {{3}} Time: {{4}} If you need to change your appointment, send a message to {{5}} and confirm"
 * Safe to fire-and-forget — logs errors but never throws.
 */
export async function sendCustomerConfirmationWhatsApp(booking: any, businessName?: string, contactInfo?: string) {
  try {
    const phone = booking.customer?.phone_number
    if (!phone) {
      console.warn('[WhatsApp] Skipping customer confirmation — no phone on customer', booking.id)
      return
    }

    const config = useRuntimeConfig()
    const templateSid = config.twilioBookingConfirmationSid as string | undefined
    const from = `whatsapp:${config.twilioWhatsappFrom || '+15559113759'}`
    const client = getTwilioClient()

    if (templateSid) {
      await client.messages.create({
        from,
        to: waNumber(phone),
        contentSid: templateSid,
        contentVariables: JSON.stringify({
          1: booking.customer.full_name?.split(' ')[0] ?? 'there',
          2: businessName ?? 'Bookbook',
          3: fmtDate(booking.booking_date),
          4: fmtTime(booking.start_time),
          5: contactInfo ?? (config.adminWhatsappPhone as string) ?? 'us'
        })
      })
    } else {
      // Fallback: free-form (only works within 24h session window)
      await send(phone, [
        `Hello ${booking.customer.full_name}! 🎉`,
        '',
        `Your booking is confirmed:`,
        `📋 Service: ${booking.service?.name ?? 'N/A'}`,
        `📅 Date: ${fmtDate(booking.booking_date)}`,
        `🕐 Time: ${fmtTime(booking.start_time)}`,
        `See you soon! — Bookbook`
      ].join('\n'))
    }

    console.log('[WhatsApp] ✅ Customer confirmation sent to', phone)
  } catch (err: any) {
    console.error('[WhatsApp] ❌ Failed to send customer confirmation:', err?.message)
  }
}

/**
 * Sends a booking cancellation notice to the customer using the approved template.
 * Template: "Hello {{1}}, Your booking at {{2}} scheduled for {{3}} at {{4}} has been cancelled. If this was unexpected, please contact {{5}} for confirmation."
 * Safe to fire-and-forget — logs errors but never throws.
 */
export async function sendBookingCancellationWhatsApp(booking: any, businessName?: string, contactInfo?: string) {
  try {
    const phone = booking.customer?.phone_number
    if (!phone) {
      console.warn('[WhatsApp] Skipping cancellation notice — no phone on customer', booking.id)
      return
    }

    const config = useRuntimeConfig()
    const templateSid = config.twilioBookingCancelledSid as string | undefined
    const from = `whatsapp:${config.twilioWhatsappFrom || '+15559113759'}`
    const client = getTwilioClient()

    if (templateSid) {
      await client.messages.create({
        from,
        to: waNumber(phone),
        contentSid: templateSid,
        contentVariables: JSON.stringify({
          1: booking.customer.full_name?.split(' ')[0] ?? 'there',
          2: businessName ?? 'Bookbook',
          3: fmtDate(booking.booking_date),
          4: fmtTime(booking.start_time),
          5: contactInfo ?? (config.adminWhatsappPhone as string) ?? 'us'
        })
      })
    } else {
      await send(phone, [
        `Hello ${booking.customer.full_name},`,
        '',
        `Your booking on ${fmtDate(booking.booking_date)} at ${fmtTime(booking.start_time)} has been cancelled.`,
        `Please contact us if this was unexpected. — Bookbook`
      ].join('\n'))
    }

    console.log('[WhatsApp] ✅ Cancellation notice sent to', phone)
  } catch (err: any) {
    console.error('[WhatsApp] ❌ Failed to send cancellation notice:', err?.message)
  }
}

/**
 * Sends a new-booking notification to the admin.
 * Safe to fire-and-forget — logs errors but never throws.
 */
export async function sendAdminNotificationWhatsApp(booking: any, adminPhone: string) {
  try {
    if (!adminPhone) {
      console.warn('[WhatsApp] Skipping admin notification — no admin phone configured')
      return
    }

    const body = [
      `📅 New Booking!`,
      '',
      `👤 Customer: ${booking.customer?.full_name ?? 'N/A'}`,
      `📞 Phone: ${booking.customer?.phone_number ?? 'N/A'}`,
      `📧 Email: ${booking.customer?.email ?? 'N/A'}`,
      '',
      `📋 Service: ${booking.service?.name ?? 'N/A'}`,
      `🧑‍💼 Staff: ${booking.employee?.full_name ?? 'N/A'}`,
      `📅 Date: ${fmtDate(booking.booking_date)}`,
      `🕐 Time: ${fmtTime(booking.start_time)}`,
      `💰 Price: $${booking.total_price}`,
      booking.notes ? `📝 Notes: ${booking.notes}` : null
    ].filter(l => l !== null).join('\n')

    await send(adminPhone, body)
    console.log('[WhatsApp] ✅ Admin notification sent to', adminPhone)
  } catch (err: any) {
    console.error('[WhatsApp] ❌ Failed to send admin notification:', err?.message)
  }
}

/**
 * Sends a 1-hour reminder to the customer.
 * Safe to fire-and-forget — logs errors but never throws.
 */
export async function sendReminderWhatsApp(booking: any) {
  try {
    const phone = booking.customer?.phone_number
    if (!phone) {
      console.warn('[WhatsApp] Skipping reminder — no phone for booking', booking.id)
      return
    }

    const body = [
      `Hi ${booking.customer.full_name}! ⏰`,
      '',
      `Reminder: your appointment is in 1 hour!`,
      '',
      `📋 ${booking.service?.name ?? 'Appointment'}`,
      `👤 with ${booking.employee?.full_name ?? 'your stylist'}`,
      `🕐 ${fmtTime(booking.start_time)}`,
      '',
      `See you soon! — Bookbook`
    ].join('\n')

    await send(phone, body)
    console.log('[WhatsApp] ✅ Reminder sent to', phone, 'for booking', booking.id)
  } catch (err: any) {
    console.error('[WhatsApp] ❌ Failed to send reminder for booking', booking.id, ':', err?.message)
  }
}
