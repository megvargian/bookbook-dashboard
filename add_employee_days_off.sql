-- Add days_off column to employee table for storing specific dates when employees are not available
-- This column stores an array of ISO date strings (YYYY-MM-DD format)

ALTER TABLE employee 
ADD COLUMN IF NOT EXISTS days_off JSONB DEFAULT '[]';

-- Create index for faster queries on days_off column
CREATE INDEX IF NOT EXISTS idx_employee_days_off ON employee USING GIN (days_off);

-- Add comment for documentation
COMMENT ON COLUMN employee.days_off IS 'Array of ISO date strings (YYYY-MM-DD) when the employee is not available for bookings';

-- Update existing employees to have empty days_off array if NULL
UPDATE employee 
SET days_off = '[]' 
WHERE days_off IS NULL;