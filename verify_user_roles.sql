-- SQL script to verify and check user roles in auth.users table
-- Run this in Supabase SQL editor to check the current state

-- 1. Check all users and their current roles
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as current_role,
  raw_user_meta_data->>'full_name' as full_name,
  created_at,
  confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 50;

-- 2. Count users by role
SELECT
  COALESCE(raw_user_meta_data->>'role', 'no_role') as role,
  COUNT(*) as user_count
FROM auth.users
GROUP BY raw_user_meta_data->>'role'
ORDER BY user_count DESC;

-- 3. Find users without any role set
SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE
  raw_user_meta_data IS NULL
  OR NOT (raw_user_meta_data ? 'role')
ORDER BY created_at DESC;

-- 4. Check if the trigger function exists
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'set_default_customer_role_on_signup';

-- 5. Check if the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_set_default_customer_role';

-- 6. Test the manual role setting function (uncomment to test)
-- SELECT set_user_role_manual('user-uuid-here', 'customer');
