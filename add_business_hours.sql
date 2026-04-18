-- Migration: Add business hours to client_business table
-- Run this in your Supabase SQL Editor

-- 1. Create client_business table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS client_business (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  name text,
  description text,
  phone text,
  email text,
  address text,
  logo_url text
);

-- 2. Add business hours columns
--    opening_time / closing_time: stored as "HH:MM" strings (e.g. "09:00", "18:00")
--    open_days: integer array where 0=Sunday, 1=Monday, ..., 6=Saturday
--    Example: [1,2,3,4,5] means Mon–Fri, [0,1,2,3,4,5,6] means every day open

ALTER TABLE client_business
  ADD COLUMN IF NOT EXISTS opening_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS closing_time text DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS open_days   integer[] DEFAULT ARRAY[1,2,3,4,5];

-- 3. Add comment documentation
COMMENT ON COLUMN client_business.opening_time IS 'Business opening time in HH:MM format (24h)';
COMMENT ON COLUMN client_business.closing_time IS 'Business closing time in HH:MM format (24h)';
COMMENT ON COLUMN client_business.open_days    IS 'Array of open weekdays: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat';
