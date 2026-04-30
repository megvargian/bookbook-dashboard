-- SQL script to ensure all new users in auth.users get a 'customer' role by default
-- This serves as a backup mechanism for any authentication flow that doesn't explicitly set the role

-- Function to automatically set 'customer' role for new users
CREATE OR REPLACE FUNCTION set_default_customer_role_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only set role if it doesn't already exist in the metadata
  IF NEW.raw_user_meta_data IS NULL OR NOT (NEW.raw_user_meta_data ? 'role') THEN
    NEW.raw_user_meta_data = COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || '{"role": "customer"}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger that runs before user insert
DROP TRIGGER IF EXISTS trigger_set_default_customer_role ON auth.users;
CREATE TRIGGER trigger_set_default_customer_role
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION set_default_customer_role_on_signup();

-- Update existing users who don't have a role set to be 'customer'
-- (Only run this once during setup)
UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "customer"}'::jsonb
WHERE
  raw_user_meta_data IS NULL
  OR NOT (raw_user_meta_data ? 'role');

-- Optional: Function to manually set user role if needed
CREATE OR REPLACE FUNCTION set_user_role_manual(user_id_param uuid, role_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's metadata with the role
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', role_param)
  WHERE id = user_id_param;

  -- Check if the update was successful
  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Role updated successfully',
      'user_id', user_id_param,
      'role', role_param
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', user_id_param
    );
  END IF;
END;
$$;

-- Grant necessary permissions (uncomment if needed)
-- GRANT EXECUTE ON FUNCTION set_user_role_manual(uuid, text) TO service_role;

COMMENT ON FUNCTION set_default_customer_role_on_signup() IS 'Automatically assigns customer role to new auth users';
COMMENT ON FUNCTION set_user_role_manual(uuid, text) IS 'Manually set user role - usage: SELECT set_user_role_manual(user_id, role_name)';
