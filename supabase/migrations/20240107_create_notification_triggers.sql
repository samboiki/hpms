-- Create notification_triggers table for managing smart notification rules
CREATE TABLE IF NOT EXISTS notification_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    notification_type TEXT NOT NULL,
    template TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    icon TEXT,
    color TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notification_triggers_practice ON notification_triggers(practice_id);
CREATE INDEX idx_notification_triggers_event_type ON notification_triggers(event_type);
CREATE INDEX idx_notification_triggers_enabled ON notification_triggers(enabled);

-- Enable RLS
ALTER TABLE notification_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their practice's notification triggers"
    ON notification_triggers FOR SELECT
    USING (
        practice_id IN (
            SELECT practice_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin users can manage notification triggers"
    ON notification_triggers FOR ALL
    USING (
        practice_id IN (
            SELECT practice_id FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Function to process notification triggers
CREATE OR REPLACE FUNCTION process_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_trigger RECORD;
    v_notification_data JSONB;
BEGIN
    -- Find matching triggers for the event
    FOR v_trigger IN 
        SELECT * FROM notification_triggers 
        WHERE enabled = true 
        AND event_type = TG_ARGV[0]
        AND practice_id = NEW.practice_id
    LOOP
        -- Check if conditions match
        IF check_trigger_conditions(v_trigger.conditions, NEW) THEN
            -- Build notification data
            v_notification_data := jsonb_build_object(
                'trigger_id', v_trigger.id,
                'event_type', v_trigger.event_type,
                'record_data', to_jsonb(NEW)
            );
            
            -- Create notification
            INSERT INTO system_notifications (
                practice_id,
                user_id,
                notification_type,
                priority,
                title,
                message,
                action_data,
                action_required
            )
            SELECT 
                NEW.practice_id,
                u.id,
                v_trigger.notification_type,
                CASE 
                    WHEN v_trigger.notification_type = 'critical_result' THEN 'critical'
                    WHEN v_trigger.notification_type = 'urgent' THEN 'urgent'
                    ELSE 'normal'
                END,
                v_trigger.name,
                replace_template_variables(v_trigger.template, NEW),
                v_notification_data,
                true
            FROM users u
            WHERE u.practice_id = NEW.practice_id
            AND u.role IN ('doctor', 'admin', 'super_admin');
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check trigger conditions
CREATE OR REPLACE FUNCTION check_trigger_conditions(conditions JSONB, record_data RECORD)
RETURNS BOOLEAN AS $$
BEGIN
    -- This is a simplified version - implement more complex condition checking as needed
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Helper function to replace template variables
CREATE OR REPLACE FUNCTION replace_template_variables(template TEXT, record_data RECORD)
RETURNS TEXT AS $$
DECLARE
    v_result TEXT := template;
BEGIN
    -- Replace common variables - extend as needed
    v_result := REPLACE(v_result, '{{patient_name}}', COALESCE(record_data.patient_name, 'Patient'));
    v_result := REPLACE(v_result, '{{test_name}}', COALESCE(record_data.test_name, 'Test'));
    v_result := REPLACE(v_result, '{{appointment_time}}', COALESCE(record_data.appointment_time::TEXT, 'Time'));
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Example trigger for visit status changes
CREATE TRIGGER trigger_visit_status_notification
    AFTER UPDATE OF status ON visits
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION process_notification_trigger('visit_status_changed');

-- Example trigger for lab results
CREATE TRIGGER trigger_lab_results_notification
    AFTER INSERT OR UPDATE ON lab_requests
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION process_notification_trigger('lab_results_uploaded');