-- Debug query to check booking status changes and customer stats
-- Run this to see what's happening with your bookings and customer stats

-- 1. Show all bookings with their current status
SELECT
  b.id as booking_id,
  b.created_at,
  b.booking_date,
  b.status,
  b.total_price,
  c.full_name as customer_name,
  c.total_visits,
  c.total_spent,
  s.name as service_name
FROM booking b
JOIN customer c ON b.customer_id = c.id
JOIN service s ON b.service_id = s.id
ORDER BY b.created_at DESC
LIMIT 20;

-- 2. Check if any bookings have 'completed' status
SELECT
  status,
  COUNT(*) as count
FROM booking
GROUP BY status
ORDER BY count DESC;

-- 3. Manual test: Update a booking to completed (replace with real booking ID)
-- Before running: note the customer's current total_visits and total_spent
-- SELECT total_visits, total_spent FROM customer WHERE id = 'customer-id-here';

-- Then update a booking to completed:
-- UPDATE booking SET status = 'completed' WHERE id = 'booking-id-here';

-- Then check if customer stats changed:
-- SELECT total_visits, total_spent FROM customer WHERE id = 'customer-id-here';

-- 4. Find a specific customer's bookings and stats
-- SELECT
--   c.full_name,
--   c.total_visits,
--   c.total_spent,
--   b.id as booking_id,
--   b.status,
--   b.total_price,
--   b.booking_date
-- FROM customer c
-- LEFT JOIN booking b ON c.id = b.customer_id
-- WHERE c.full_name ILIKE '%customer-name-here%'
-- ORDER BY b.created_at DESC;

-- 5. Quick stats verification
SELECT
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
FROM booking;
