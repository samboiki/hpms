/*
  # Create ensure_visit function
  
  1. Changes
    - Creates a function to ensure a visit exists for an appointment
    - Returns existing visit ID or creates a new one
    - Updates appointment status to in-progress
    
  2. Security
    - Uses SECURITY DEFINER to bypass RLS
    - Grants execute permission to authenticated users
*/

-- Create function to ensure a visit exists for an appointment
CREATE OR REPLACE FUNCTION ensure_visit(_appt uuid) 
RETURNS uuid
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  _visit uuid;
BEGIN
  -- Check if a visit already exists for this appointment
  SELECT id INTO _visit
  FROM visits 
  WHERE appointment_id = _appt AND status = 'in-progress';

  -- If no visit exists, create one
  IF _visit IS NULL THEN
    INSERT INTO visits (
      appointment_id, 
      patient_id, 
      doctor_id, 
      visit_date,
      visit_time, 
      visit_type, 
      status
    )
    SELECT 
      id, 
      patient_id, 
      doctor_id, 
      current_date, 
      current_time,
      'consultation', 
      'in-progress'
    FROM appointments 
    WHERE id = _appt
    RETURNING id INTO _visit;

    -- Update appointment status
    UPDATE appointments 
    SET status = 'in-progress' 
    WHERE id = _appt;
  END IF;

  RETURN _visit;
END $$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_visit(uuid) TO authenticated;