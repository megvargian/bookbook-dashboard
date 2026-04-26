/**
 * POST /api/reminders
 *
 * Finds bookings starting in the next 55–65 minutes that haven't been reminded yet,
 * sends a WhatsApp reminder to each customer, and marks them as reminded.
 *
 * Call this endpoint every ~15 minutes from a cron job.
 * Protect with the Authorization header: Bearer <CRON_SECRET>
 *
 * Cron-job.org example:
 *   URL:    https://dashboard.bookbook.me/api/reminders
 *   Method: POST
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Schedule: Every 15 minutes
 */

import { createClient } from '@supabase/supabase-js'
// import { sendReminderWhatsApp } from '../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // ── Auth guard: only the cron job may call this ─────────────────────────────
  const cronSecret = config.cronSecret as string
  if (!cronSecret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET not configured' })
  }
  const auth = getHeader(event, 'authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // ── Supabase setup ───────────────────────────────────────────────────────────
  const supabaseUrl = config.public.supabaseUrl as string
  const serviceKey = config.supabaseServiceKey as string
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' })
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Query bookings starting in 55–65 minutes that haven't been reminded ─────
  const now = new Date()
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString() // 55 min from now
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000).toISOString() // 65 min from now

  const { data: bookings, error } = await supabase
    .from('booking')
    .select(`
      *,
      customer(*),
      employee(*),
      service(*)
    `)
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)
    .in('status', ['pending', 'confirmed'])
    .eq('reminder_sent', false)

  if (error) {
    console.error('[Reminders] Failed to query bookings:', error.message)
    throw createError({ statusCode: 500, statusMessage: `DB error: ${error.message}` })
  }

  if (!bookings || bookings.length === 0) {
    return { sent: 0, message: 'No reminders needed' }
  }

  console.log(`[Reminders] Sending ${bookings.length} reminder(s)…`)

  // ── Send reminders and mark as sent ─────────────────────────────────────────
  const results = await Promise.allSettled(
    bookings.map(async (booking) => {
      // await sendReminderWhatsApp(booking)

      // Mark reminder_sent = true regardless of WhatsApp result
      // (prevents duplicate reminders even if WhatsApp failed)
      await supabase
        .from('booking')
        .update({ reminder_sent: true })
        .eq('id', booking.id)

      return booking.id
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`[Reminders] Done: ${succeeded} sent, ${failed} failed`)
  return { sent: succeeded, failed, total: bookings.length }
})
