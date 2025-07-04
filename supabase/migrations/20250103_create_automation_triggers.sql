-- Create automation event triggers for monitoring database changes
-- These triggers will create automation executions based on configured automations

-- Function to process automation triggers
CREATE OR REPLACE FUNCTION process_automation_trigger()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  timing_record RECORD;
  scheduled_time TIMESTAMPTZ;
  execution_id UUID;
BEGIN
  -- Find active automations for this trigger
  FOR automation_record IN
    SELECT 
      a.*,
      t.trigger_type,
      t.table_name,
      t.event_type
    FROM automation_settings a
    JOIN automation_triggers t ON t.automation_id = a.id
    WHERE a.is_active = true
      AND t.is_active = true
      AND t.table_name = TG_TABLE_NAME
      AND t.event_type = TG_OP
  LOOP
    -- Check if conditions match (simplified for now)
    -- In production, this would evaluate the conditions JSONB
    
    -- Process each timing for this automation
    FOR timing_record IN
      SELECT * FROM jsonb_array_elements(automation_record.timings) AS t(timing)
      WHERE (t.timing->>'enabled')::boolean = true
    LOOP
      -- Calculate scheduled time based on timing configuration
      scheduled_time := calculate_automation_schedule(
        timing_record.timing,
        CASE 
          WHEN TG_TABLE_NAME = 'visits' THEN NEW.scheduled_date::date + NEW.scheduled_time::time
          WHEN TG_TABLE_NAME = 'invoices_enhanced' THEN NEW.due_date::timestamptz
          ELSE NOW()
        END
      );
      
      -- Create automation execution record
      INSERT INTO automation_executions (
        automation_id,
        practice_id,
        trigger_id,
        patient_id,
        visit_id,
        invoice_id,
        related_table,
        related_record_id,
        scheduled_at,
        status,
        template_data
      ) VALUES (
        automation_record.id,
        CASE 
          WHEN TG_TABLE_NAME = 'visits' THEN NEW.practice_id
          WHEN TG_TABLE_NAME = 'patients' THEN NEW.practice_id
          WHEN TG_TABLE_NAME = 'invoices_enhanced' THEN NEW.practice_id
        END,
        automation_record.trigger_id,
        CASE 
          WHEN TG_TABLE_NAME = 'visits' THEN NEW.patient_id
          WHEN TG_TABLE_NAME = 'patients' THEN NEW.id
          WHEN TG_TABLE_NAME = 'invoices_enhanced' THEN NEW.patient_id
        END,
        CASE WHEN TG_TABLE_NAME = 'visits' THEN NEW.id END,
        CASE WHEN TG_TABLE_NAME = 'invoices_enhanced' THEN NEW.id END,
        TG_TABLE_NAME,
        NEW.id,
        scheduled_time,
        'pending',
        jsonb_build_object(
          'trigger_event', TG_OP,
          'trigger_time', NOW()
        )
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate automation schedule based on timing rules
CREATE OR REPLACE FUNCTION calculate_automation_schedule(
  timing JSONB,
  reference_time TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  value INTEGER;
  unit TEXT;
  when_type TEXT;
  calculated_time TIMESTAMPTZ;
BEGIN
  value := (timing->>'value')::INTEGER;
  unit := timing->>'unit';
  when_type := timing->>'when';
  
  -- Calculate based on before/after
  IF when_type = 'before' THEN
    CASE unit
      WHEN 'minutes' THEN calculated_time := reference_time - (value || ' minutes')::INTERVAL;
      WHEN 'hours' THEN calculated_time := reference_time - (value || ' hours')::INTERVAL;
      WHEN 'days' THEN calculated_time := reference_time - (value || ' days')::INTERVAL;
      WHEN 'weeks' THEN calculated_time := reference_time - (value || ' weeks')::INTERVAL;
      WHEN 'months' THEN calculated_time := reference_time - (value || ' months')::INTERVAL;
      ELSE calculated_time := reference_time;
    END CASE;
  ELSE -- after
    CASE unit
      WHEN 'minutes' THEN calculated_time := reference_time + (value || ' minutes')::INTERVAL;
      WHEN 'hours' THEN calculated_time := reference_time + (value || ' hours')::INTERVAL;
      WHEN 'days' THEN calculated_time := reference_time + (value || ' days')::INTERVAL;
      WHEN 'weeks' THEN calculated_time := reference_time + (value || ' weeks')::INTERVAL;
      WHEN 'months' THEN calculated_time := reference_time + (value || ' months')::INTERVAL;
      ELSE calculated_time := reference_time;
    END CASE;
  END IF;
  
  -- Don't schedule in the past
  IF calculated_time < NOW() THEN
    calculated_time := NOW() + INTERVAL '1 minute';
  END IF;
  
  RETURN calculated_time;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on key tables

-- 1. Visits table - for appointment reminders, confirmations, no-shows
CREATE TRIGGER automation_trigger_visits_insert
  AFTER INSERT ON visits
  FOR EACH ROW
  EXECUTE FUNCTION process_automation_trigger();

CREATE TRIGGER automation_trigger_visits_update
  AFTER UPDATE ON visits
  FOR EACH ROW
  WHEN (
    OLD.is_confirmed IS DISTINCT FROM NEW.is_confirmed OR
    OLD.visit_status IS DISTINCT FROM NEW.visit_status OR
    OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date OR
    OLD.scheduled_time IS DISTINCT FROM NEW.scheduled_time
  )
  EXECUTE FUNCTION process_automation_trigger();

-- 2. Invoices table - for payment reminders and confirmations
CREATE TRIGGER automation_trigger_invoices_insert
  AFTER INSERT ON invoices_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION process_automation_trigger();

CREATE TRIGGER automation_trigger_invoices_update
  AFTER UPDATE ON invoices_enhanced
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION process_automation_trigger();

-- 3. Lab requests - for results ready notifications
CREATE TRIGGER automation_trigger_lab_requests_update
  AFTER UPDATE ON lab_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION process_automation_trigger();

-- 4. Patients table - for welcome messages
CREATE TRIGGER automation_trigger_patients_insert
  AFTER INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION process_automation_trigger();

-- Function to process birthday automations (runs daily via cron)
CREATE OR REPLACE FUNCTION process_birthday_automations()
RETURNS void AS $$
DECLARE
  patient_record RECORD;
  automation_record RECORD;
  timing_record RECORD;
  scheduled_time TIMESTAMPTZ;
BEGIN
  -- Find all patients with birthdays today
  FOR patient_record IN
    SELECT p.*, pr.id as practice_id
    FROM patients p
    JOIN practices pr ON pr.id = p.practice_id
    WHERE EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM p.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
  LOOP
    -- Find active birthday automations for this practice
    FOR automation_record IN
      SELECT *
      FROM automation_settings
      WHERE practice_id = patient_record.practice_id
        AND automation_id = 'birthday-wishes'
        AND is_active = true
    LOOP
      -- Check if we already sent birthday wishes today
      IF NOT EXISTS (
        SELECT 1 
        FROM automation_executions
        WHERE automation_id = automation_record.id
          AND patient_id = patient_record.id
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        -- Process each timing
        FOR timing_record IN
          SELECT * FROM jsonb_array_elements(automation_record.timings) AS t(timing)
          WHERE (t.timing->>'enabled')::boolean = true
        LOOP
          -- For birthdays, schedule based on configured time of day
          scheduled_time := CURRENT_DATE + ((timing_record.timing->>'value')::integer || ' hours')::interval;
          
          -- Create execution
          INSERT INTO automation_executions (
            automation_id,
            practice_id,
            patient_id,
            scheduled_at,
            status,
            template_data
          ) VALUES (
            automation_record.id,
            patient_record.practice_id,
            patient_record.id,
            scheduled_time,
            'pending',
            jsonb_build_object(
              'patient_age', EXTRACT(YEAR FROM AGE(patient_record.date_of_birth))::text,
              'birthday_date', TO_CHAR(CURRENT_DATE, 'Month DD')
            )
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial automation triggers for default automations
INSERT INTO automation_triggers (automation_id, trigger_type, table_name, event_type, is_active)
SELECT 
  id,
  'event',
  CASE 
    WHEN automation_id IN ('appointment-reminder', 'appointment-confirmation', 'no-show-followup') THEN 'visits'
    WHEN automation_id IN ('payment-reminder', 'payment-confirmation') THEN 'invoices_enhanced'
    WHEN automation_id = 'lab-results' THEN 'lab_requests'
    WHEN automation_id = 'welcome-new-patient' THEN 'patients'
    ELSE NULL
  END,
  CASE 
    WHEN automation_id IN ('appointment-confirmation', 'welcome-new-patient') THEN 'INSERT'
    ELSE 'UPDATE'
  END,
  true
FROM automation_settings
WHERE trigger_config IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON FUNCTION process_automation_trigger() IS 'Processes automation triggers when database events occur';
COMMENT ON FUNCTION calculate_automation_schedule() IS 'Calculates when an automation should be executed based on timing rules';
COMMENT ON FUNCTION process_birthday_automations() IS 'Processes birthday automations daily - should be called by a cron job';