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
  const from = `whatsapp:${config.twilioWhatsappFrom || '+14155238886'}`
  const client = getTwilioClient()
  await client.messages.create({ from, to: waNumber(to), body })
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Sends a booking confirmation to the customer.
 * Safe to fire-and-forget — logs errors but never throws.
 */
export async function sendCustomerConfirmationWhatsApp(booking: any) {
  try {
    const phone = booking.customer?.phone_number
    if (!phone) {
      console.warn('[WhatsApp] Skipping customer confirmation — no phone on customer', booking.id)
      return
    }

    const body = [
      `Hello ${booking.customer.full_name}! 🎉`,
      '',
      `Your booking is confirmed:`,
      '',
      `📋 Service: ${booking.service?.name ?? 'N/A'}`,
      `👤 Staff: ${booking.employee?.full_name ?? 'N/A'}`,
      `📅 Date: ${fmtDate(booking.booking_date)}`,
      `🕐 Time: ${fmtTime(booking.start_time)}`,
      `💰 Price: $${booking.total_price}`,
      booking.notes ? `📝 Notes: ${booking.notes}` : null,
      '',
      `See you soon! — Bookbook`
    ].filter(l => l !== null).join('\n')

    await send(phone, body)
    console.log('[WhatsApp] ✅ Customer confirmation sent to', phone)
  } catch (err: any) {
    console.error('[WhatsApp] ❌ Failed to send customer confirmation:', err?.message)
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
