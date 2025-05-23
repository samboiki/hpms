/*
  # Update vitals table to link with visits

  1. Changes
    - Drop foreign key constraint from vitals to medical_records
    - Add new foreign key constraint from vitals to visits
    - Drop medical_records table as it's no longer needed

  2. Security
    - RLS is already disabled for vitals table
*/

-- First drop the foreign key constraint
ALTER TABLE vitals
DROP CONSTRAINT IF EXISTS vitals_medical_record_id_fkey;

-- Rename the column to visit_id
ALTER TABLE vitals
RENAME COLUMN medical_record_id TO visit_id;

-- Add the new foreign key constraint
ALTER TABLE vitals
ADD CONSTRAINT vitals_visit_id_fkey
FOREIGN KEY (visit_id)
REFERENCES visits(id)
ON DELETE CASCADE;

-- Drop the medical_records table
DROP TABLE IF EXISTS medical_records CASCADE;