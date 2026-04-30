-- SQL functions for customer visit and expense tracking
-- These functions help maintain accurate customer statistics

-- Function to recalculate customer statistics from existing bookings
-- This can be used to fix any inconsistencies or for bulk updates
CREATE OR REPLACE FUNCTION recalculate_customer_stats(customer_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  visit_count integer;
  total_expense numeric;
BEGIN
  -- Count confirmed bookings and sum total prices
  SELECT
    COUNT(*),
    COALESCE(SUM(total_price), 0)
  INTO
    visit_count,
    total_expense
  FROM booking
  WHERE
    customer_id = customer_id_param
    AND status IN ('confirmed', 'completed');

  -- Update customer table
  UPDATE customer
  SET
    total_visits = visit_count,
    total_spent = total_expense
  WHERE id = customer_id_param;

  -- Return the calculated stats
  RETURN json_build_object(
    'success', true,
    'customer_id', customer_id_param,
    'total_visits', visit_count,
    'total_spent', total_expense
  );
END;
$$;

-- Function to recalculate ALL customer statistics
-- Use this for bulk updates or data cleanup
CREATE OR REPLACE FUNCTION recalculate_all_customer_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  -- Update all customers with recalculated stats
  UPDATE customer
  SET
    total_visits = booking_stats.visit_count,
    total_spent = booking_stats.total_expense
  FROM (
    SELECT
      customer_id,
      COUNT(*) as visit_count,
      COALESCE(SUM(total_price), 0) as total_expense
    FROM booking
    WHERE status IN ('confirmed', 'completed')
    GROUP BY customer_id
  ) AS booking_stats
  WHERE customer.id = booking_stats.customer_id;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  -- Reset customers with no bookings to zero
  UPDATE customer
  SET
    total_visits = 0,
    total_spent = 0
  WHERE id NOT IN (
    SELECT DISTINCT customer_id
    FROM booking
    WHERE status IN ('confirmed', 'completed')
  );

  RETURN json_build_object(
    'success', true,
    'customers_updated', processed_count,
    'message', 'All customer statistics recalculated'
  );
END;
$$;

-- Function to handle booking status changes and update customer stats accordingly
CREATE OR REPLACE FUNCTION update_customer_stats_on_booking_change(
  booking_id_param uuid,
  old_status text,
  new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record record;
  customer_id_val uuid;
  price_val numeric;
BEGIN
  -- Get booking details
  SELECT customer_id, total_price, status
  INTO booking_record
  FROM booking
  WHERE id = booking_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found'
    );
  END IF;

  customer_id_val := booking_record.customer_id;
  price_val := COALESCE(booking_record.total_price, 0);

  -- Handle status transitions
  IF old_status IN ('confirmed', 'completed') AND new_status = 'cancelled' THEN
    -- Booking was active, now cancelled - decrement stats
    UPDATE customer
    SET
      total_visits = GREATEST(COALESCE(total_visits, 0) - 1, 0),
      total_spent = GREATEST(COALESCE(total_spent, 0) - price_val, 0)
    WHERE id = customer_id_val;

    RETURN json_build_object(
      'success', true,
      'action', 'decremented',
      'customer_id', customer_id_val,
      'visits_change', -1,
      'spent_change', -price_val
    );

  ELSIF old_status = 'cancelled' AND new_status IN ('confirmed', 'completed') THEN
    -- Booking was cancelled, now active - increment stats
    UPDATE customer
    SET
      total_visits = COALESCE(total_visits, 0) + 1,
      total_spent = COALESCE(total_spent, 0) + price_val
    WHERE id = customer_id_val;

    RETURN json_build_object(
      'success', true,
      'action', 'incremented',
      'customer_id', customer_id_val,
      'visits_change', 1,
      'spent_change', price_val
    );
  END IF;

  -- No stats change needed
  RETURN json_build_object(
    'success', true,
    'action', 'no_change',
    'message', 'Status change does not affect customer stats'
  );
END;
$$;

-- Grant execute permissions (uncomment as needed)
-- GRANT EXECUTE ON FUNCTION recalculate_customer_stats(uuid) TO service_role;
-- GRANT EXECUTE ON FUNCTION recalculate_all_customer_stats() TO service_role;
-- GRANT EXECUTE ON FUNCTION update_customer_stats_on_booking_change(uuid, text, text) TO service_role;

-- Usage examples:
-- Recalculate stats for a specific customer:
-- SELECT recalculate_customer_stats('customer-uuid-here');

-- Recalculate stats for all customers:
-- SELECT recalculate_all_customer_stats();

-- Handle a booking status change:
-- SELECT update_customer_stats_on_booking_change('booking-uuid', 'confirmed', 'cancelled');

COMMENT ON FUNCTION recalculate_customer_stats(uuid) IS 'Recalculates visit count and total spent for a specific customer based on confirmed/completed bookings';
COMMENT ON FUNCTION recalculate_all_customer_stats() IS 'Recalculates visit count and total spent for all customers - use for data cleanup';
COMMENT ON FUNCTION update_customer_stats_on_booking_change(uuid, text, text) IS 'Updates customer stats when booking status changes between active and cancelled';
