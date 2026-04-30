-- SQL script to verify customer visit and expense tracking
-- Run this after implementing the tracking to verify it's working

-- 1. Check current customer stats vs actual booking data
SELECT
  c.id as customer_id,
  c.full_name,
  c.email,
  c.total_visits as recorded_visits,
  c.total_spent as recorded_spent,
  COALESCE(actual_stats.actual_visits, 0) as actual_visits,
  COALESCE(actual_stats.actual_spent, 0) as actual_spent,
  CASE
    WHEN COALESCE(c.total_visits, 0) = COALESCE(actual_stats.actual_visits, 0)
         AND COALESCE(c.total_spent, 0) = COALESCE(actual_stats.actual_spent, 0)
    THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM customer c
LEFT JOIN (
  SELECT
    customer_id,
    COUNT(*) as actual_visits,
    COALESCE(SUM(total_price), 0) as actual_spent
  FROM booking
  WHERE status IN ('confirmed', 'completed')
  GROUP BY customer_id
) actual_stats ON c.id = actual_stats.customer_id
ORDER BY c.created_at DESC;

-- 2. Find customers with mismatched stats
SELECT
  c.id as customer_id,
  c.full_name,
  c.total_visits as recorded_visits,
  c.total_spent as recorded_spent,
  COALESCE(actual_stats.actual_visits, 0) as actual_visits,
  COALESCE(actual_stats.actual_spent, 0) as actual_spent,
  (COALESCE(c.total_visits, 0) - COALESCE(actual_stats.actual_visits, 0)) as visits_diff,
  (COALESCE(c.total_spent, 0) - COALESCE(actual_stats.actual_spent, 0)) as spent_diff
FROM customer c
LEFT JOIN (
  SELECT
    customer_id,
    COUNT(*) as actual_visits,
    COALESCE(SUM(total_price), 0) as actual_spent
  FROM booking
  WHERE status IN ('confirmed', 'completed')
  GROUP BY customer_id
) actual_stats ON c.id = actual_stats.customer_id
WHERE
  COALESCE(c.total_visits, 0) != COALESCE(actual_stats.actual_visits, 0)
  OR COALESCE(c.total_spent, 0) != COALESCE(actual_stats.actual_spent, 0);

-- 3. Customer stats summary
SELECT
  COUNT(*) as total_customers,
  COUNT(CASE WHEN total_visits > 0 THEN 1 END) as customers_with_visits,
  AVG(COALESCE(total_visits, 0)) as avg_visits_per_customer,
  AVG(COALESCE(total_spent, 0)) as avg_spent_per_customer,
  MAX(total_visits) as max_visits,
  MAX(total_spent) as max_spent
FROM customer;

-- 4. Recent bookings and their impact on customer stats
SELECT
  b.id as booking_id,
  b.created_at as booking_created,
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
LIMIT 10;

-- 5. Customers with highest visits and spending
SELECT
  id,
  full_name,
  email,
  total_visits,
  total_spent,
  CASE WHEN total_visits > 0 THEN total_spent / total_visits ELSE 0 END as avg_spent_per_visit
FROM customer
WHERE total_visits > 0
ORDER BY total_spent DESC, total_visits DESC
LIMIT 20;

-- If you find mismatched data, run this to fix all customer stats:
-- SELECT recalculate_all_customer_stats();

-- Or fix a specific customer:
-- SELECT recalculate_customer_stats('customer-uuid-here');
