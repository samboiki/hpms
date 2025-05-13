/*
  # Create Sample Appointments Data

  1. Sample Data
    - Add appointments for existing patients
    - Include various appointment types and statuses
*/

-- Insert sample appointments
INSERT INTO appointments (patient_id, date, time, duration, type, status, notes) VALUES
  ('03dd4f09-67a8-4796-8e72-9f6356160178', CURRENT_DATE + 2, '09:00', 30, 'consultation', 'scheduled', 'Follow-up on lab results'),
  ('2a2136ad-7af7-47d0-b431-7dcef3411859', CURRENT_DATE + 3, '10:30', 45, 'follow-up', 'confirmed', 'Review medication'),
  ('327925ed-6d7d-4464-8581-5a6fae75931e', CURRENT_DATE + 1, '14:15', 30, 'consultation', 'scheduled', 'Thyroid check'),
  ('d09ad54c-b7df-4c1f-b11b-994048aa730b', CURRENT_DATE + 4, '11:00', 60, 'procedure', 'confirmed', 'Annual physical examination');

-- Insert sample invoices
INSERT INTO invoices (patient_id, issue_date, due_date, subtotal, total, payment_status, payment_method)
SELECT
  id as patient_id,
  CURRENT_DATE as issue_date,
  CURRENT_DATE + 30 as due_date,
  250.00 as subtotal,
  250.00 as total,
  'pending' as payment_status,
  'medical-aid' as payment_method
FROM patients;

-- Insert sample invoice items
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
SELECT
  id as invoice_id,
  'Consultation' as description,
  1 as quantity,
  250.00 as unit_price,
  250.00 as total
FROM invoices;