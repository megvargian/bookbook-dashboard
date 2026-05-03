-- Test query to verify customer statistics are updating properly when bookings are completed
-- Run this in Supabase SQL editor to check current state

-- 1. Show customers with their current stats vs actual completed bookings
SELECT
  c.id as customer_id,
  c.full_name,
  c.total_visits as recorded_visits,
  c.total_spent as recorded_spent,
  COALESCE(actual_stats.completed_visits, 0) as actual_completed_visits,
  COALESCE(actual_stats.completed_spent, 0) as actual_completed_spent,
  CASE
    WHEN COALESCE(c.total_visits, 0) = COALESCE(actual_stats.completed_visits, 0)
         AND COALESCE(c.total_spent, 0) = COALESCE(actual_stats.completed_spent, 0)
    THEN '✅ CORRECT'
    ELSE '❌ NEEDS UPDATE'
  END as status
FROM customer c
LEFT JOIN (
  SELECT
    customer_id,
    COUNT(*) as completed_visits,
    COALESCE(SUM(total_price::numeric), 0) as completed_spent
  FROM booking
  WHERE status IN ('confirmed', 'completed')
  GROUP BY customer_id
) actual_stats ON c.id = actual_stats.customer_id
ORDER BY c.created_at DESC;

-- 2. Show recent booking status changes and their impact
SELECT
  b.id as booking_id,
  b.created_at,
  b.status,
  b.total_price,
  c.full_name as customer_name,
  c.total_visits,
  c.total_spent,
  s.name as service_name
FROM booking b
JOIN customer c ON b.customer_id = c.id
JOIN service s ON b.service_id = s.id
WHERE b.status = 'completed'
ORDER BY b.updated_at DESC
LIMIT 10;

-- 3. Test updating a booking to completed status (replace 'booking-id-here' with real booking ID)
-- UPDATE booking SET status = 'completed' WHERE id = 'booking-id-here';
-- Then check if customer stats updated by running query #1 again

-- 4. Customer statistics summary
SELECT
  COUNT(*) as total_customers,
  COUNT(CASE WHEN total_visits > 0 THEN 1 END) as customers_with_visits,
  ROUND(AVG(COALESCE(total_visits, 0)), 2) as avg_visits_per_customer,
  ROUND(AVG(COALESCE(total_spent, 0)), 2) as avg_spent_per_customer,
  MAX(total_visits) as max_visits,
  ROUND(MAX(total_spent), 2) as max_spent
FROM customer;
