-- Fix the automation trigger function that's causing the null automation_id error
-- This fix ensures triggers only fire when there's an active automation
-- Normal visit scheduling will not be affected

-- Create or replace the fixed function (no need to drop triggers)
CREATE OR REPLACE FUNCTION process_automation_trigger()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  timing_record RECORD;
  scheduled_time TIMESTAMPTZ;
  execution_id UUID;
  trigger_record RECORD;
BEGIN
  -- Find active automations for this trigger
  -- Only process if there are active automations for this event
  FOR automation_record IN
    SELECT 
      a.*,
      t.id as trigger_id,
      t.trigger_type,
      t.table_name,
      t.event_type
    FROM automation_settings a
    JOIN automation_triggers t ON t.automation_id = a.id
    WHERE a.is_active = true
      AND t.is_active = true
      AND t.table_name = TG_TABLE_NAME
      AND t.event_type = TG_OP
      AND a.practice_id = CASE 
        WHEN TG_TABLE_NAME = 'visits' THEN NEW.practice_id
        WHEN TG_TABLE_NAME = 'patients' THEN NEW.practice_id
        WHEN TG_TABLE_NAME = 'invoices_enhanced' THEN NEW.practice_id
        WHEN TG_TABLE_NAME = 'lab_requests' THEN (SELECT practice_id FROM visits WHERE id = NEW.visit_id)
        ELSE NULL
      END
  LOOP
    -- Check if conditions match (simplified for now)
    -- In production, this would evaluate the conditions JSONB
    
    -- Process each timing for this automation
    -- Skip if no timings are configured
    IF automation_record.timings IS NOT NULL AND jsonb_array_length(automation_record.timings) > 0 THEN
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
        automation_record.trigger_id, -- This is now correctly set from the JOIN above
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
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the fix
COMMENT ON FUNCTION process_automation_trigger() IS 'Processes automation triggers only when active automations exist for the practice. Fixed to properly reference trigger_id and prevent null automation_id errors.';