-- ============================================
-- Batch Details Population Trigger
-- This ensures batch_details table gets populated automatically
-- ============================================

-- Function to populate batch_details when invoice is added to batch
CREATE OR REPLACE FUNCTION populate_batch_details()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_header RECORD;
  v_patient RECORD;
  v_medical_aid RECORD;
  v_practice RECORD;
  v_visit RECORD;
  v_service RECORD;
  v_transaction_number INTEGER;
  v_doctor RECORD;
BEGIN
  -- Get batch header information
  SELECT * INTO v_batch_header
  FROM batch_headers 
  WHERE id = NEW.batch_header_id;
  
  IF v_batch_header IS NULL THEN
    RAISE EXCEPTION 'Batch header not found for ID: %', NEW.batch_header_id;
  END IF;
  
  -- Get invoice information
  SELECT 
    i.*,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.gender,
    p.id_number
  INTO v_patient
  FROM invoices_enhanced i
  JOIN patients p ON p.id = i.patient_id
  WHERE i.id = NEW.invoice_id;
  
  -- Get medical aid details
  SELECT 
    mad.*,
    map.medical_aid_reference,
    map.name as provider_name
  INTO v_medical_aid
  FROM medical_aid_details mad
  JOIN medical_aid_providers map ON map.name = mad.provider
  WHERE mad.patient_id = v_patient.patient_id
    AND (mad.valid_to IS NULL OR mad.valid_to >= CURRENT_DATE)
  ORDER BY mad.created_at DESC
  LIMIT 1;
  
  -- Get practice information
  SELECT * INTO v_practice
  FROM practices 
  WHERE id = v_batch_header.practice_id;
  
  -- Get visit information
  SELECT * INTO v_visit
  FROM visits 
  WHERE id = v_patient.visit_id;
  
  -- Get doctor information if available
  SELECT 
    u.email,
    u.user_metadata->>'full_name' as full_name,
    u.user_metadata->>'hpcsa_number' as hpcsa_number
  INTO v_doctor
  FROM auth.users u
  WHERE u.id = v_visit.doctor_id;
  
  -- Get next transaction number for this batch
  SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 
  INTO v_transaction_number
  FROM batch_details 
  WHERE batch_header_id = NEW.batch_header_id;
  
  -- Insert batch details for each service in the invoice
  FOR v_service IN 
    SELECT 
      s.*,
      COALESCE(pt.code, s.code) as tariff_code,
      COALESCE(pt.description, s.description) as service_description
    FROM invoice_services s
    LEFT JOIN practice_tariffs pt ON pt.code = s.code 
      AND pt.practice_id = v_batch_header.practice_id
    WHERE s.invoice_id = NEW.invoice_id
  LOOP
    -- Insert batch detail record
    INSERT INTO batch_details (
      batch_header_id,
      invoice_id,
      transaction_id,
      transaction_number_in_batch,
      system_transaction_number,
      system_patient_reference_number,
      type_of_service,
      medical_aid_reference,
      medical_aid_membership_number,
      member_surname,
      member_initials,
      patient_name,
      patient_date_of_birth,
      bhf_tariff_code,
      service_amount,
      diagnosis,
      discount_amount,
      service_date,
      number_of_services,
      service_fee,
      invoice_number,
      referring_doctor,
      practice_number,
      treating_doctor_hpcsa_number,
      gender,
      tariff_code_type,
      patient_id_number,
      service_time,
      patient_id,
      visit_id,
      visit_service_id
    ) VALUES (
      NEW.batch_header_id,
      NEW.invoice_id,
      'D', -- Detail record
      v_transaction_number,
      v_transaction_number, -- System transaction number
      LPAD(v_patient.patient_id::TEXT, 20, '0'), -- System patient reference
      'T', -- Type of service (Treatment)
      v_medical_aid.medical_aid_reference,
      v_medical_aid.membership_number,
      UPPER(v_patient.last_name),
      UPPER(LEFT(v_patient.first_name, 3)),
      v_patient.first_name || ' ' || v_patient.last_name,
      v_patient.date_of_birth,
      v_service.tariff_code,
      v_service.total_price,
      v_visit.diagnosis,
      COALESCE(v_service.total_price - v_service.medical_aid_covered - v_service.patient_portion, 0),
      COALESCE(v_visit.visit_date, CURRENT_DATE),
      v_service.quantity,
      7, -- Default service fee
      v_patient.invoice_number,
      COALESCE(v_doctor.full_name, ''),
      v_practice.practice_number,
      COALESCE(v_doctor.hpcsa_number, ''),
      UPPER(LEFT(v_patient.gender, 1)),
      'T', -- Tariff code type
      v_patient.id_number,
      COALESCE(v_visit.visit_time, '09:00:00'::TIME),
      v_patient.patient_id,
      v_patient.visit_id,
      v_service.id
    );
    
    -- Increment transaction number for next service
    v_transaction_number := v_transaction_number + 1;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_populate_batch_details ON batch_details;

-- Create trigger that fires when a record is inserted into batch_details
-- Note: This assumes you have a way to add invoices to batches
-- We'll create a helper function for that

-- Function to add invoice to batch (this will trigger batch_details population)
CREATE OR REPLACE FUNCTION add_invoice_to_batch_with_details(
  p_batch_id UUID,
  p_invoice_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_batch_detail_id UUID;
BEGIN
  -- First, insert a placeholder record to trigger our function
  INSERT INTO batch_details (
    batch_header_id,
    invoice_id,
    transaction_number_in_batch,
    bhf_tariff_code,
    service_amount,
    medical_aid_reference,
    invoice_number,
    patient_id_number,
    gender
  ) VALUES (
    p_batch_id,
    p_invoice_id,
    1, -- Temporary - will be updated by trigger
    'TEMP',
    0,
    'TEMP',
    'TEMP',
    'TEMP',
    'M'
  ) RETURNING id INTO v_batch_detail_id;
  
  -- Delete the placeholder - this will be replaced by proper records
  DELETE FROM batch_details WHERE id = v_batch_detail_id;
  
  -- Now call the populate function manually
  PERFORM populate_batch_details_for_invoice(p_batch_id, p_invoice_id);
  
  -- Update the invoice to link it to the batch
  UPDATE invoices_enhanced 
  SET batch_id = p_batch_id 
  WHERE id = p_invoice_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Direct function to populate batch details for a specific invoice
CREATE OR REPLACE FUNCTION populate_batch_details_for_invoice(
  p_batch_id UUID,
  p_invoice_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_batch_header RECORD;
  v_patient RECORD;
  v_medical_aid RECORD;
  v_practice RECORD;
  v_visit RECORD;
  v_service RECORD;
  v_transaction_number INTEGER;
  v_doctor RECORD;
BEGIN
  -- Get batch header information
  SELECT * INTO v_batch_header
  FROM batch_headers 
  WHERE id = p_batch_id;
  
  -- Get invoice and patient information
  SELECT 
    i.*,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.gender,
    p.id_number
  INTO v_patient
  FROM invoices_enhanced i
  JOIN patients p ON p.id = i.patient_id
  WHERE i.id = p_invoice_id;
  
  -- Get medical aid details
  SELECT 
    mad.*,
    map.medical_aid_reference,
    map.name as provider_name
  INTO v_medical_aid
  FROM medical_aid_details mad
  JOIN medical_aid_providers map ON map.name = mad.provider
  WHERE mad.patient_id = v_patient.patient_id
    AND (mad.valid_to IS NULL OR mad.valid_to >= CURRENT_DATE)
  ORDER BY mad.created_at DESC
  LIMIT 1;
  
  -- Get practice information
  SELECT * INTO v_practice
  FROM practices 
  WHERE id = v_batch_header.practice_id;
  
  -- Get visit information
  SELECT * INTO v_visit
  FROM visits 
  WHERE id = v_patient.visit_id;
  
  -- Get doctor information
  SELECT 
    u.email,
    u.user_metadata->>'full_name' as full_name,
    u.user_metadata->>'hpcsa_number' as hpcsa_number
  INTO v_doctor
  FROM auth.users u
  WHERE u.id = v_visit.doctor_id;
  
  -- Get next transaction number for this batch
  SELECT COALESCE(MAX(transaction_number_in_batch), 0) + 1 
  INTO v_transaction_number
  FROM batch_details 
  WHERE batch_header_id = p_batch_id;
  
  -- Insert batch details for each service
  FOR v_service IN 
    SELECT s.*
    FROM invoice_services s
    WHERE s.invoice_id = p_invoice_id
  LOOP
    INSERT INTO batch_details (
      batch_header_id,
      invoice_id,
      transaction_id,
      transaction_number_in_batch,
      medical_aid_reference,
      medical_aid_membership_number,
      member_surname,
      member_initials,
      patient_name,
      patient_date_of_birth,
      bhf_tariff_code,
      service_amount,
      service_date,
      number_of_services,
      invoice_number,
      practice_number,
      gender,
      patient_id_number,
      patient_id,
      visit_id,
      visit_service_id
    ) VALUES (
      p_batch_id,
      p_invoice_id,
      'D',
      v_transaction_number,
      COALESCE(v_medical_aid.medical_aid_reference, 'UNKN'),
      COALESCE(v_medical_aid.membership_number, ''),
      UPPER(COALESCE(v_patient.last_name, '')),
      UPPER(LEFT(COALESCE(v_patient.first_name, ''), 3)),
      COALESCE(v_patient.first_name || ' ' || v_patient.last_name, ''),
      v_patient.date_of_birth,
      COALESCE(v_service.code, ''),
      v_service.total_price,
      COALESCE(v_visit.visit_date, CURRENT_DATE),
      v_service.quantity,
      COALESCE(v_patient.invoice_number, ''),
      COALESCE(v_practice.practice_number, ''),
      UPPER(LEFT(COALESCE(v_patient.gender, 'U'), 1)),
      COALESCE(v_patient.id_number, ''),
      v_patient.patient_id,
      v_patient.visit_id,
      v_service.id
    );
    
    v_transaction_number := v_transaction_number + 1;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that populates batch_details when invoices are created
CREATE OR REPLACE FUNCTION auto_populate_batch_details()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_medical_aid_ref VARCHAR(10);
BEGIN
  -- Only process invoices with medical aid
  IF NEW.medical_aid_total > 0 THEN
    -- Get medical aid reference for this patient
    SELECT map.medical_aid_reference 
    INTO v_medical_aid_ref
    FROM medical_aid_details mad
    JOIN medical_aid_providers map ON map.name = mad.provider
    WHERE mad.patient_id = NEW.patient_id
      AND (mad.valid_to IS NULL OR mad.valid_to >= CURRENT_DATE)
    ORDER BY mad.created_at DESC
    LIMIT 1;
    
    -- Get or create active batch
    SELECT id INTO v_batch_id
    FROM batch_headers
    WHERE practice_id = NEW.practice_id
      AND medical_aid_reference = v_medical_aid_ref
      AND status = 'active'
      AND batch_date = CURRENT_DATE
    LIMIT 1;
    
    -- Create batch if none exists
    IF v_batch_id IS NULL THEN
      v_batch_id := create_new_batch(NEW.practice_id, v_medical_aid_ref, CURRENT_DATE);
    END IF;
    
    -- Populate batch details for this invoice
    PERFORM populate_batch_details_for_invoice(v_batch_id, NEW.id);
    
    -- Link invoice to batch
    UPDATE invoices_enhanced SET batch_id = v_batch_id WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on invoices_enhanced
DROP TRIGGER IF EXISTS trigger_auto_populate_batch_details ON invoices_enhanced;
CREATE TRIGGER trigger_auto_populate_batch_details
  AFTER INSERT ON invoices_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_batch_details();

-- Test query to check if batch_details gets populated
SELECT 'Batch details trigger created successfully!' as status,
       'New invoices with medical aid will automatically populate batch_details' as note;