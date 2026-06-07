-- ─────────────────────────────────────────────────────────────────────────
-- Trigger: auto-create a notification for the business admin whenever a new
-- booking is inserted (from the dashboard OR from any external booking site).
--
-- HOW TO APPLY:
--   Paste this in your Supabase project → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Function that does the work
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with the role that owns the function (postgres)
AS $$
DECLARE
  v_client_profile_id uuid;
  v_customer_name     text;
  v_service_name      text;
BEGIN
  -- Resolve the admin client_profile for this business
  SELECT id INTO v_client_profile_id
  FROM public.client_profile
  WHERE client_business_id = NEW.client_business_id
    AND role = 'admin'
  LIMIT 1;

  -- Nothing to do if we can't find an admin
  IF v_client_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to get the customer's name for the notification body
  SELECT full_name INTO v_customer_name
  FROM public.customer
  WHERE id = NEW.customer_id;

  -- Try to get the service name
  SELECT name INTO v_service_name
  FROM public.service
  WHERE id = NEW.service_id;

  -- Insert the notification
  INSERT INTO public.notification (
    client_profile_id,
    type,
    title,
    body,
    is_read,
    booking_id,
    metadata
  ) VALUES (
    v_client_profile_id,
    'new_booking',
    'New Booking',
    COALESCE(v_customer_name, 'A customer') || ' booked ' || COALESCE(v_service_name, 'a service') || ' on ' || TO_CHAR(NEW.booking_date::date, 'Mon DD'),
    false,
    NEW.id,
    jsonb_build_object(
      'booking_id',    NEW.id,
      'customer_id',   NEW.customer_id,
      'employee_id',   NEW.employee_id,
      'service_id',    NEW.service_id,
      'booking_date',  NEW.booking_date,
      'start_time',    NEW.start_time
    )
  );

  RETURN NEW;
END;
$$;

-- 2. Drop old trigger if it exists, then create fresh
DROP TRIGGER IF EXISTS on_booking_insert ON public.booking;

CREATE TRIGGER on_booking_insert
  AFTER INSERT ON public.booking
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_booking();
