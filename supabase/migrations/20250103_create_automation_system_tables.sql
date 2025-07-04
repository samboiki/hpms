-- Create automation system tables for smart automated communications
-- This migration creates the foundation for the automation engine

-- 1. Create automation_settings table
CREATE TABLE IF NOT EXISTS automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    automation_id TEXT NOT NULL, -- e.g., 'appointment-reminder', 'birthday-wishes'
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('appointment', 'health', 'billing', 'engagement', 'marketing')),
    icon TEXT,
    is_active BOOLEAN DEFAULT false,
    
    -- Communication channels configuration
    channels JSONB DEFAULT '[]'::jsonb,
    /* Example channels structure:
    [
        {
            "type": "SMS" | "EMAIL" | "BOTH",
            "enabled": true,
            "template": {
                "subject": "Appointment Reminder",
                "body": "Hi {{patientName}}, reminder about your appointment..."
            }
        }
    ]
    */
    
    -- Timing configuration
    timings JSONB DEFAULT '[]'::jsonb,
    /* Example timings structure:
    [
        {
            "id": "1",
            "label": "24 hours before",
            "value": 24,
            "unit": "hours",
            "when": "before",
            "enabled": true
        }
    ]
    */
    
    -- Template configurations
    sms_template JSONB DEFAULT '{}'::jsonb,
    email_template JSONB DEFAULT '{}'::jsonb,
    
    -- Available variables for this automation
    variables JSONB DEFAULT '[]'::jsonb,
    /* Example: ["patientName", "appointmentDate", "appointmentTime", "doctorName"] */
    
    -- Trigger configuration
    trigger_config JSONB DEFAULT '{}'::jsonb,
    /* Example:
    {
        "table": "visits",
        "event": "INSERT",
        "conditions": {
            "is_confirmed": true
        }
    }
    */
    
    -- Additional conditions
    conditions JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Ensure unique automation per practice
    UNIQUE(practice_id, automation_id)
);

-- 2. Create automation_triggers table
CREATE TABLE IF NOT EXISTS automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automation_settings(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'scheduled', 'manual')),
    
    -- For event-based triggers
    table_name TEXT,
    event_type TEXT CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
    column_name TEXT,
    operator TEXT CHECK (operator IN ('=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL')),
    value JSONB,
    
    -- For scheduled triggers
    schedule_config JSONB,
    /* Example:
    {
        "type": "daily" | "weekly" | "monthly",
        "time": "09:00",
        "dayOfWeek": 1, // For weekly
        "dayOfMonth": 1 // For monthly
    }
    */
    
    -- Timing rules
    timing_rules JSONB DEFAULT '[]'::jsonb,
    
    -- Execution settings
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    max_retries INTEGER DEFAULT 3,
    retry_interval INTEGER DEFAULT 300, -- seconds
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create automation_executions table
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automation_settings(id),
    practice_id UUID NOT NULL REFERENCES practices(id),
    trigger_id UUID REFERENCES automation_triggers(id),
    
    -- Related entities
    patient_id UUID REFERENCES patients(id),
    visit_id UUID REFERENCES visits(id),
    invoice_id UUID REFERENCES invoices_enhanced(id),
    related_table TEXT,
    related_record_id UUID,
    
    -- Execution details
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    channel TEXT CHECK (channel IN ('SMS', 'EMAIL')),
    
    -- Timing
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Results
    message_id UUID, -- Reference to practice_sms_logs or practice_email_logs
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Template data at time of execution
    template_data JSONB,
    variables_used JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create automation_templates table for custom templates
CREATE TABLE IF NOT EXISTS automation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('appointment', 'health', 'billing', 'engagement', 'marketing', 'custom')),
    icon TEXT,
    
    -- Template configuration (same structure as automation_settings)
    channels JSONB DEFAULT '[]'::jsonb,
    timings JSONB DEFAULT '[]'::jsonb,
    sms_template JSONB DEFAULT '{}'::jsonb,
    email_template JSONB DEFAULT '{}'::jsonb,
    variables JSONB DEFAULT '[]'::jsonb,
    trigger_config JSONB DEFAULT '{}'::jsonb,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Metadata
    is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(practice_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_automation_settings_practice ON automation_settings(practice_id);
CREATE INDEX idx_automation_settings_active ON automation_settings(practice_id, is_active);
CREATE INDEX idx_automation_triggers_automation ON automation_triggers(automation_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(status, scheduled_at);
CREATE INDEX idx_automation_executions_practice ON automation_executions(practice_id, status);
CREATE INDEX idx_automation_executions_patient ON automation_executions(patient_id);
CREATE INDEX idx_automation_templates_practice ON automation_templates(practice_id);

-- Enable RLS
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_settings
CREATE POLICY "Practice staff can view their automation settings"
    ON automation_settings FOR SELECT
    USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Practice managers can manage automation settings"
    ON automation_settings FOR ALL
    USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() 
            AND is_active = true
            AND role IN ('practice_admin', 'practice_manager')
        )
    );

-- RLS Policies for automation_triggers
CREATE POLICY "Practice staff can view their automation triggers"
    ON automation_triggers FOR SELECT
    USING (
        automation_id IN (
            SELECT id FROM automation_settings
            WHERE practice_id IN (
                SELECT practice_id FROM practice_staff 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "Practice managers can manage automation triggers"
    ON automation_triggers FOR ALL
    USING (
        automation_id IN (
            SELECT id FROM automation_settings
            WHERE practice_id IN (
                SELECT practice_id FROM practice_staff 
                WHERE user_id = auth.uid() 
                AND is_active = true
                AND role IN ('practice_admin', 'practice_manager')
            )
        )
    );

-- RLS Policies for automation_executions
CREATE POLICY "Practice staff can view their automation executions"
    ON automation_executions FOR SELECT
    USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can manage automation executions"
    ON automation_executions FOR ALL
    USING (auth.role() = 'service_role');

-- RLS Policies for automation_templates
CREATE POLICY "Practice staff can view their automation templates"
    ON automation_templates FOR SELECT
    USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
        OR is_system = true
    );

CREATE POLICY "Practice managers can manage automation templates"
    ON automation_templates FOR ALL
    USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() 
            AND is_active = true
            AND role IN ('practice_admin', 'practice_manager')
        )
        AND is_system = false
    );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_settings_updated_at
    BEFORE UPDATE ON automation_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_triggers_updated_at
    BEFORE UPDATE ON automation_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_executions_updated_at
    BEFORE UPDATE ON automation_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_templates_updated_at
    BEFORE UPDATE ON automation_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE automation_settings IS 'Stores practice-specific automation configurations';
COMMENT ON TABLE automation_triggers IS 'Defines what events or schedules trigger automations';
COMMENT ON TABLE automation_executions IS 'Tracks the execution history of automations';
COMMENT ON TABLE automation_templates IS 'Stores reusable automation templates';

COMMENT ON COLUMN automation_settings.channels IS 'JSON array of channel configurations (SMS/EMAIL/BOTH)';
COMMENT ON COLUMN automation_settings.timings IS 'JSON array of timing rules (before/after events)';
COMMENT ON COLUMN automation_settings.trigger_config IS 'JSON configuration for what triggers this automation';
COMMENT ON COLUMN automation_executions.message_id IS 'References the actual message in practice_sms_logs or practice_email_logs';