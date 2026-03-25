/* eslint-disable @typescript-eslint/no-explicit-any */
import * as postmark from 'postmark'

const FROM_EMAIL = 'support@bookbook.me'
const FROM_NAME = 'Bookbook'

function getClient() {
  const config = useRuntimeConfig()

  // Enhanced logging for configuration validation
  console.log('[Email] Initializing Postmark client...')
  console.log('[Email] FROM_EMAIL:', FROM_EMAIL)
  console.log('[Email] FROM_NAME:', FROM_NAME)
  console.log('[Email] POSTMARK_API_KEY exists:', !!config.postmarkApiKey)
  console.log('[Email] POSTMARK_API_KEY length:', config.postmarkApiKey ? config.postmarkApiKey.length : 0)

  if (!config.postmarkApiKey) {
    console.error('[Email] CRITICAL ERROR: POSTMARK_API_KEY is not set in environment variables')
    throw new Error('POSTMARK_API_KEY is required but not found in environment')
  }

  try {
    const client = new postmark.ServerClient(config.postmarkApiKey as string)
    console.log('[Email] Postmark client initialized successfully')
    return client
  } catch (error) {
    console.error('[Email] CRITICAL ERROR: Failed to initialize Postmark client:', error)
    throw error
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
}

export async function sendBookingConfirmationToCustomer(booking: any) {
  console.log('[Email] ==================== CUSTOMER EMAIL START ====================')
  console.log('[Email] Function: sendBookingConfirmationToCustomer called')
  console.log('[Email] Booking ID:', booking?.id || 'MISSING')
  console.log('[Email] Booking object keys:', Object.keys(booking || {}))

  // Log booking structure for debugging
  console.log('[Email] Full booking object:', JSON.stringify(booking, null, 2))

  const customer = booking.customer
  const service = booking.service
  const employee = booking.employee

  // Enhanced customer validation
  console.log('[Email] Customer object:', customer ? JSON.stringify(customer, null, 2) : 'MISSING/NULL')
  console.log('[Email] Customer email:', customer?.email || 'MISSING/UNDEFINED')
  console.log('[Email] Customer name:', customer?.full_name || 'MISSING/UNDEFINED')

  if (!customer) {
    console.error('[Email] CRITICAL ERROR: Customer object is missing from booking')
    throw new Error('Customer data is required but missing from booking')
  }

  if (!customer.email) {
    console.error('[Email] CRITICAL ERROR: Customer email is missing')
    console.error('[Email] Customer data available:', JSON.stringify(customer, null, 2))
    throw new Error('Customer email is required but missing')
  }

  // Service validation
  console.log('[Email] Service object:', service ? JSON.stringify(service, null, 2) : 'MISSING/NULL')
  if (!service) {
    console.warn('[Email] WARNING: Service object is missing from booking')
  }

  // Employee validation
  console.log('[Email] Employee object:', employee ? JSON.stringify(employee, null, 2) : 'MISSING/NULL')

  const client = getClient()

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#18181b;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${FROM_NAME}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:24px;color:#18181b;">Booking Confirmed!</h1>
          <p style="margin:0 0 24px;color:#71717a;font-size:15px;">Hi ${customer?.full_name || 'there'}, your booking has been received and is pending confirmation.</p>

          <!-- Booking Details Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e4e4e7;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Booking Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;width:40%;">Service</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${service?.name || '-'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;">Date</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${formatDate(booking.booking_date)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;">Time</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${formatTime(booking.start_time)}</td>
                </tr>
                ${employee
                  ? `<tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;">Staff</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${employee.first_name} ${employee.last_name}</td>
                </tr>`
                  : ''}
                <tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;">Price</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${formatPrice(booking.total_price)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;">Status</td>
                  <td style="padding:6px 0;">
                    <span style="background:#fef9c3;color:#854d0e;font-size:12px;font-weight:600;padding:2px 10px;border-radius:99px;">Pending</span>
                  </td>
                </tr>
                ${booking.notes
                  ? `<tr>
                  <td style="padding:6px 0;color:#71717a;font-size:14px;vertical-align:top;">Notes</td>
                  <td style="padding:6px 0;color:#18181b;font-size:14px;">${booking.notes}</td>
                </tr>`
                  : ''}
              </table>
            </td></tr>
          </table>

          <p style="margin:0;color:#71717a;font-size:13px;">If you have any questions, please reply to this email or contact us directly.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Log email details before sending
  const emailPayload = {
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: customer.email,
    Subject: `Booking Confirmed – ${service?.name || 'Your Appointment'} on ${formatDate(booking.booking_date)}`,
    HtmlBody: html,
    MessageStream: 'outbound'
  }

  console.log('[Email] Email payload prepared:')
  console.log('[Email] From:', emailPayload.From)
  console.log('[Email] To:', emailPayload.To)
  console.log('[Email] Subject:', emailPayload.Subject)
  console.log('[Email] MessageStream:', emailPayload.MessageStream)
  console.log('[Email] HtmlBody length:', html.length, 'characters')

  console.log(`[Email] Sending confirmation to customer: ${customer.email} | booking: ${booking.id}`)
  try {
    console.log('[Email] Calling Postmark sendEmail...')
    const result = await client.sendEmail(emailPayload)
    console.log(`[Email] ✅ SUCCESS: Customer confirmation sent!`)
    console.log(`[Email] MessageID: ${result.MessageID}`)
    console.log(`[Email] To: ${customer.email}`)
    console.log(`[Email] ErrorCode: ${result.ErrorCode || 'none'}`)
    console.log(`[Email] Message: ${result.Message || 'none'}`)
    console.log('[Email] Full Postmark response:', JSON.stringify(result, null, 2))
    console.log('[Email] ==================== CUSTOMER EMAIL SUCCESS ====================')
  } catch (err: any) {
    console.error('[Email] ==================== CUSTOMER EMAIL FAILED ====================')
    console.error(`[Email] ❌ FAILED to send customer confirmation to ${customer.email}`)
    console.error('[Email] Error type:', typeof err)
    console.error('[Email] Error message:', err?.message || 'No error message')
    console.error('[Email] Error code:', err?.code || 'No error code')
    console.error('[Email] Error details:', err?.details || 'No error details')
    console.error('[Email] Full error object:', JSON.stringify(err, null, 2))
    console.error('[Email] Error stack:', err?.stack)
    console.error('[Email] ==================== CUSTOMER EMAIL ERROR END ====================')
    throw err
  }
}

export async function sendBookingNotificationToAdmin(booking: any, adminEmail: string) {
  console.log('[Email] ==================== ADMIN EMAIL START ====================')
  console.log('[Email] Function: sendBookingNotificationToAdmin called')
  console.log('[Email] Booking ID:', booking?.id || 'MISSING')
  console.log('[Email] Admin email parameter:', adminEmail || 'MISSING/UNDEFINED')

  if (!adminEmail) {
    console.error('[Email] CRITICAL ERROR: Admin email parameter is missing or empty')
    throw new Error('Admin email is required but was not provided')
  }

  // Log booking structure for debugging
  console.log('[Email] Booking object keys:', Object.keys(booking || {}))

  const customer = booking.customer
  const service = booking.service
  const employee = booking.employee

  // Enhanced validation
  console.log('[Email] Customer object:', customer ? JSON.stringify(customer, null, 2) : 'MISSING/NULL')
  console.log('[Email] Service object:', service ? JSON.stringify(service, null, 2) : 'MISSING/NULL')
  console.log('[Email] Employee object:', employee ? JSON.stringify(employee, null, 2) : 'MISSING/NULL')

  const client = getClient()

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#18181b;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${FROM_NAME}</p>
          <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px;">New Booking Received</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 24px;font-size:22px;color:#18181b;">New Booking – ${service?.name || 'Appointment'}</h1>

          <!-- Customer Info -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:16px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;width:40%;">Name</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${customer?.full_name || '-'}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Email</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;">${customer?.email || '-'}</td>
                </tr>
                ${customer?.phone_number
                  ? `<tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Phone</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;">${customer.phone_number}</td>
                </tr>`
                  : ''}
              </table>
            </td></tr>
          </table>

          <!-- Booking Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e4e4e7;border-radius:8px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Booking Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;width:40%;">Service</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${service?.name || '-'}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Date</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${formatDate(booking.booking_date)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Time</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${formatTime(booking.start_time)}</td>
                </tr>
                ${employee
                  ? `<tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Staff</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${employee.first_name} ${employee.last_name}</td>
                </tr>`
                  : ''}
                <tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;">Price</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;font-weight:600;">${formatPrice(booking.total_price)}</td>
                </tr>
                ${booking.notes
                  ? `<tr>
                  <td style="padding:5px 0;color:#71717a;font-size:14px;vertical-align:top;">Notes</td>
                  <td style="padding:5px 0;color:#18181b;font-size:14px;">${booking.notes}</td>
                </tr>`
                  : ''}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} ${FROM_NAME}. This is an automated notification.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Log email details before sending
  const emailPayload = {
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: adminEmail,
    Subject: `New Booking – ${service?.name || 'Appointment'} | ${customer?.full_name || 'Customer'}`,
    HtmlBody: html,
    MessageStream: 'outbound'
  }

  console.log('[Email] Admin email payload prepared:')
  console.log('[Email] From:', emailPayload.From)
  console.log('[Email] To:', emailPayload.To)
  console.log('[Email] Subject:', emailPayload.Subject)
  console.log('[Email] MessageStream:', emailPayload.MessageStream)
  console.log('[Email] HtmlBody length:', html.length, 'characters')

  console.log(`[Email] Sending booking notification to admin: ${adminEmail} | booking: ${booking.id}`)
  try {
    console.log('[Email] Calling Postmark sendEmail for admin...')
    const result = await client.sendEmail(emailPayload)
    console.log(`[Email] ✅ SUCCESS: Admin notification sent!`)
    console.log(`[Email] MessageID: ${result.MessageID}`)
    console.log(`[Email] To: ${adminEmail}`)
    console.log(`[Email] ErrorCode: ${result.ErrorCode || 'none'}`)
    console.log(`[Email] Message: ${result.Message || 'none'}`)
    console.log('[Email] Full Postmark response:', JSON.stringify(result, null, 2))
    console.log('[Email] ==================== ADMIN EMAIL SUCCESS ====================')
  } catch (err: any) {
    console.error('[Email] ==================== ADMIN EMAIL FAILED ====================')
    console.error(`[Email] ❌ FAILED to send admin notification to ${adminEmail}`)
    console.error('[Email] Error type:', typeof err)
    console.error('[Email] Error message:', err?.message || 'No error message')
    console.error('[Email] Error code:', err?.code || 'No error code')
    console.error('[Email] Error details:', err?.details || 'No error details')
    console.error('[Email] Full error object:', JSON.stringify(err, null, 2))
    console.error('[Email] Error stack:', err?.stack)
    console.error('[Email] ==================== ADMIN EMAIL ERROR END ====================')
    throw err
  }
}
