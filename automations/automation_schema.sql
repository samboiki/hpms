-- HPMS Automation System Database Schema
-- Multi-tenant automation management with n8n integration

-- 1. Automation Templates (defines what automations are available)
CREATE TABLE automation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'welcome-patient', 'appointment-reminder'
    description TEXT,
    category VARCHAR(100), -- 'patient', 'staff', 'billing', 'clinical'
    trigger_type VARCHAR(50), -- 'event', 'scheduled', 'manual'
    default_enabled BOOLEAN DEFAULT false,
    requires_sms BOOLEAN DEFAULT false,
    requires_email BOOLEAN DEFAULT false,
    variables JSONB, -- template variables like {{patient_name}}, {{appointment_date}}
    n8n_workflow_id VARCHAR(255), -- ID of the workflow in n8n
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Practice Automation Settings (which automations each practice has enabled)
CREATE TABLE practice_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    template_id UUID REFERENCES automation_templates(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}', -- practice-specific settings like delay times, custom messages
    -- Email settings per practice
    email_enabled BOOLEAN DEFAULT true,
    email_from_name VARCHAR(255), -- e.g., "Dr. Smith's Practice"
    email_reply_to VARCHAR(255), -- practice's reply-to email
    google_refresh_token TEXT, -- OAuth refresh token for practice's Google account
    -- SMS settings (uses central SMS but can customize)
    sms_enabled BOOLEAN DEFAULT true,
    sms_sender_name VARCHAR(20), -- custom sender ID if supported
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(practice_id, template_id)
);

-- 3. Automation Triggers (queue of automations to be executed)
CREATE TABLE automation_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    template_id UUID REFERENCES automation_templates(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50), -- 'patient_created', 'appointment_scheduled', etc.
    entity_type VARCHAR(50), -- 'patient', 'appointment', 'invoice', etc.
    entity_id UUID, -- ID of the related entity
    data JSONB, -- all data needed for the automation
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    scheduled_for TIMESTAMPTZ, -- when to execute (immediate if NULL)
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    INDEX idx_triggers_status_scheduled (status, scheduled_for),
    INDEX idx_triggers_practice_status (practice_id, status)
);

-- 4. Automation Executions (history of executed automations)
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_id UUID REFERENCES automation_triggers(id) ON DELETE CASCADE,
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    template_id UUID REFERENCES automation_templates(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    -- Execution details
    status VARCHAR(50), -- 'success', 'partial', 'failed'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    execution_time_ms INTEGER,
    -- Channel results
    sms_sent BOOLEAN DEFAULT false,
    sms_delivery_id UUID REFERENCES practice_sms_logs(id),
    sms_status VARCHAR(50),
    sms_error TEXT,
    email_sent BOOLEAN DEFAULT false,
    email_delivery_id UUID REFERENCES practice_email_logs(id),
    email_status VARCHAR(50),
    email_error TEXT,
    -- n8n execution details
    n8n_execution_id VARCHAR(255),
    n8n_workflow_id VARCHAR(255),
    execution_data JSONB, -- full execution context
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Automation Variables (custom fields that can be used in templates)
CREATE TABLE automation_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(practice_id, name)
);

-- Indexes for performance
CREATE INDEX idx_automation_triggers_pending ON automation_triggers(status, scheduled_for) 
WHERE status = 'pending';

CREATE INDEX idx_automation_executions_practice_date ON automation_executions(practice_id, created_at DESC);

-- RLS Policies
ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_variables ENABLE ROW LEVEL SECURITY;

-- Practice users can only see their own automation data
CREATE POLICY "Practice users can view their automation settings" ON practice_automations
    FOR ALL USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Practice users can view their automation triggers" ON automation_triggers
    FOR ALL USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Practice users can view their automation executions" ON automation_executions
    FOR ALL USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Practice users can manage their automation variables" ON automation_variables
    FOR ALL USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

-- Everyone can view automation templates
CREATE POLICY "All users can view automation templates" ON automation_templates
    FOR SELECT USING (true);

-- Insert initial automation templates
INSERT INTO automation_templates (name, slug, description, category, trigger_type, requires_sms, requires_email, variables) VALUES
('Welcome New Patient', 'welcome-patient', 'Send welcome message to newly registered patients', 'patient', 'event', true, true, 
 '{"required": ["patient_name", "practice_name", "patient_email", "patient_phone"], "optional": ["first_appointment_date", "doctor_name"]}'),
 
('Appointment Reminder', 'appointment-reminder', 'Send reminder 24 hours before appointment', 'patient', 'scheduled', true, true,
 '{"required": ["patient_name", "appointment_date", "appointment_time", "doctor_name", "practice_name"], "optional": ["location", "instructions"]}'),
 
('Invoice Ready', 'invoice-ready', 'Notify patient when invoice is generated', 'billing', 'event', true, true,
 '{"required": ["patient_name", "invoice_number", "amount_due", "due_date"], "optional": ["invoice_link"]}'),
 
('Lab Results Ready', 'lab-results-ready', 'Notify patient when lab results are available', 'clinical', 'event', true, true,
 '{"required": ["patient_name", "test_name", "doctor_name"], "optional": ["results_link"]}'),
 
('Payment Reminder', 'payment-reminder', 'Remind patients of overdue invoices', 'billing', 'scheduled', true, true,
 '{"required": ["patient_name", "invoice_number", "amount_due", "days_overdue"], "optional": ["payment_link"]}');