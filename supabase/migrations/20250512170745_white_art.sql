/*
  # Create patient data view

  1. New View
    - Creates a comprehensive view that joins patients with their medical aid and next of kin details
    - Simplifies data fetching by providing a single query endpoint
    
  2. Changes
    - Adds patient_details_view for easier data access
    - Includes all related information in a single view
*/

-- Create a view for comprehensive patient details
CREATE VIEW patient_details_view AS
SELECT 
  p.*,
  json_agg(DISTINCT mad.*) FILTER (WHERE mad.id IS NOT NULL) as medical_aid_details,
  json_agg(DISTINCT nok.*) FILTER (WHERE nok.id IS NOT NULL) as next_of_kin
FROM patients p
LEFT JOIN medical_aid_details mad ON p.id = mad.patient_id
LEFT JOIN next_of_kin nok ON p.id = nok.patient_id
GROUP BY p.id;