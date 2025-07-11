-- HPMS Multi-Tenant Automation System Setup
-- This creates a centralized automation system that minimizes n8n execution costs

-- 1. Create master automation definitions table
CREATE TABLE IF NOT EXISTS automation_definitions (
    id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    icon TEXT,
    trigger_events TEXT[], -- Events that trigger this automation
    default_channels JSONB DEFAULT '[]'::jsonb,
    default_timings JSONB DEFAULT '[]'::jsonb,
    variables TEXT[], -- Template variables like {{patientName}}
    requires_sms BOOLEAN DEFAULT false,
    requires_email BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create practice-specific automation settings
CREATE TABLE IF NOT EXISTS practice_automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
    automation_id VARCHAR(50) REFERENCES automation_definitions(id),
    enabled BOOLEAN DEFAULT false,
    -- Channel configurations
    sms_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    -- Templates (practice can customize)
    sms_template TEXT,
    email_subject TEXT,
    email_body TEXT,
    -- Timing settings (override defaults)
    timings JSONB,
    -- Google OAuth for sending from practice email
    google_refresh_token TEXT,
    google_email TEXT, -- The email to send from
    last_token_refresh TIMESTAMPTZ,
    -- Tracking
    last_executed_at TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(practice_id, automation_id)
);

-- 3. Insert all 25 automation definitions
INSERT INTO automation_definitions (id, name, category, description, icon, trigger_events, default_channels, default_timings, variables, requires_sms, requires_email) VALUES
-- Appointment & Visit Related
('appointment-reminder', 'Appointment Reminder', 'appointment', 'Never let patients miss their appointments', 'solar:calendar-check-bold-duotone', 
 ARRAY['appointment.scheduled', 'appointment.updated'], 
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "24 hours before", "value": 24, "unit": "hours", "when": "before", "enabled": true}, {"id": "2", "label": "2 hours before", "value": 2, "unit": "hours", "when": "before", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'practiceName', 'practicePhone'],
 true, true),

('appointment-confirmation', 'Appointment Confirmation', 'appointment', 'Instantly confirm new appointments', 'solar:check-square-bold-duotone',
 ARRAY['appointment.created'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Immediately", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'practiceName', 'confirmationCode'],
 true, true),

('no-show-followup', 'No-Show Follow-up', 'appointment', 'Reach out to patients who missed appointments', 'solar:calendar-remove-bold-duotone',
 ARRAY['appointment.no_show'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "30 mins after", "value": 30, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'appointmentDate', 'practicePhone'],
 true, true),

-- Health & Care Related
('follow-up', 'Follow-up Care', 'health', 'Ensure patients complete their treatment plans', 'solar:health-bold-duotone',
 ARRAY['visit.completed'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "1 day after", "value": 1, "unit": "days", "when": "after", "enabled": true}, {"id": "2", "label": "1 week after", "value": 7, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'followUpInstructions', 'practicePhone'],
 true, true),

('medication-reminder', 'Medication Reminder', 'health', 'Help patients stay on track with medications', 'solar:pills-2-bold-duotone',
 ARRAY['prescription.created'],
 '[{"type": "SMS", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Daily at 9am", "value": 9, "unit": "hours", "when": "daily", "enabled": true}, {"id": "2", "label": "Daily at 6pm", "value": 18, "unit": "hours", "when": "daily", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'medicationName', 'dosageInstructions', 'practicePhone'],
 true, false),

('lab-results', 'Lab Results Ready', 'health', 'Notify when test results are available', 'solar:test-tube-bold-duotone',
 ARRAY['lab_results.ready'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Immediately", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'testDate', 'portalLink', 'practicePhone'],
 true, true),

-- Billing & Payment Related
('payment-reminder', 'Payment Reminder', 'billing', 'Gentle reminders for outstanding payments', 'solar:wallet-money-bold-duotone',
 ARRAY['invoice.overdue'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "7 days after due", "value": 7, "unit": "days", "when": "after", "enabled": true}, {"id": "2", "label": "14 days after due", "value": 14, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'amount', 'paymentLink', 'practicePhone'],
 true, true),

('payment-confirmation', 'Payment Confirmation', 'billing', 'Confirm successful payments', 'solar:check-circle-bold-duotone',
 ARRAY['payment.received'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Immediately", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'amountPaid', 'receiptNumber', 'practicePhone'],
 true, true),

('insurance-claim-update', 'Insurance Claim Updates', 'billing', 'Keep patients informed about claim status', 'solar:shield-check-bold-duotone',
 ARRAY['claim.status_changed'],
 '[{"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "When updated", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'claimNumber', 'claimStatus', 'practicePhone'],
 false, true),

-- Engagement & Marketing
('birthday-wishes', 'Birthday Wishes', 'engagement', 'Send personalized birthday greetings', 'solar:gift-bold-duotone',
 ARRAY['patient.birthday'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Birthday morning", "value": 9, "unit": "hours", "when": "on", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'practiceName'],
 true, true),

('welcome-new-patient', 'Welcome New Patients', 'engagement', 'Make new patients feel welcome', 'solar:hand-shake-bold-duotone',
 ARRAY['patient.created'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "1 hour after", "value": 1, "unit": "hours", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'practiceName', 'practicePhone', 'practiceEmail', 'portalLink'],
 true, true),

('health-tips', 'Health Tips & Newsletter', 'marketing', 'Share health tips and practice news', 'solar:heart-shine-bold-duotone',
 ARRAY['newsletter.scheduled'],
 '[{"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Monthly", "value": 1, "unit": "months", "when": "recurring", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'practiceName', 'newsletterContent'],
 false, true),

('referral-request', 'Referral Request', 'marketing', 'Ask satisfied patients for referrals', 'solar:users-group-two-rounded-bold-duotone',
 ARRAY['visit.positive_feedback'],
 '[{"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "2 weeks after visit", "value": 14, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'practiceName', 'referralLink'],
 false, true),

('review-request', 'Review Request', 'marketing', 'Request online reviews from happy patients', 'solar:star-bold-duotone',
 ARRAY['visit.completed', 'visit.positive_feedback'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "3 days after visit", "value": 3, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'practiceName', 'reviewLink', 'doctorName'],
 true, true),

('seasonal-campaign', 'Seasonal Health Campaigns', 'marketing', 'Promote seasonal health services', 'solar:calendar-mark-bold-duotone',
 ARRAY['campaign.launched'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Campaign start", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'campaignName', 'campaignDetails', 'practicePhone'],
 true, true),

-- Preventive Care
('vaccine-reminder', 'Vaccine Reminder', 'health', 'Remind patients about due vaccinations', 'solar:syringe-bold-duotone',
 ARRAY['vaccine.due'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "1 month before due", "value": 30, "unit": "days", "when": "before", "enabled": true}, {"id": "2", "label": "1 week before due", "value": 7, "unit": "days", "when": "before", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'vaccineName', 'dueDate', 'practicePhone'],
 true, true),

('prescription-refill', 'Prescription Refill Reminder', 'health', 'Alert patients when prescriptions need refilling', 'solar:pill-bold-duotone',
 ARRAY['prescription.expiring'],
 '[{"type": "SMS", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "5 days before empty", "value": 5, "unit": "days", "when": "before", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'medicationName', 'refillsRemaining', 'practicePhone'],
 true, false),

('annual-checkup', 'Annual Check-up Reminder', 'health', 'Yearly health examination reminders', 'solar:calendar-search-bold-duotone',
 ARRAY['patient.checkup_due'],
 '[{"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "11 months after last visit", "value": 11, "unit": "months", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'lastVisitDate', 'practiceName', 'practicePhone'],
 false, true),

-- Clinical Follow-ups
('test-results-follow-up', 'Test Results Follow-up', 'health', 'Follow up on abnormal test results', 'solar:test-tube-minimalistic-bold-duotone',
 ARRAY['lab_results.abnormal'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Immediately", "value": 0, "unit": "minutes", "when": "after", "enabled": true}, {"id": "2", "label": "2 days after", "value": 2, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'testName', 'doctorName', 'practicePhone'],
 true, true),

('surgery-pre-op', 'Pre-Surgery Instructions', 'health', 'Pre-operative preparation reminders', 'solar:health-bold-duotone',
 ARRAY['surgery.scheduled'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "1 week before", "value": 7, "unit": "days", "when": "before", "enabled": true}, {"id": "2", "label": "1 day before", "value": 1, "unit": "days", "when": "before", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'surgeryDate', 'surgeryTime', 'preparationInstructions', 'practicePhone'],
 true, true),

('post-procedure-care', 'Post-Procedure Care', 'health', 'After-care instructions and check-ins', 'solar:bandage-bold-duotone',
 ARRAY['procedure.completed'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "1 day after", "value": 1, "unit": "days", "when": "after", "enabled": true}, {"id": "2", "label": "3 days after", "value": 3, "unit": "days", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'procedureName', 'aftercareInstructions', 'practicePhone'],
 true, true),

('chronic-condition-monitoring', 'Chronic Condition Check-in', 'health', 'Regular monitoring for chronic conditions', 'solar:pulse-bold-duotone',
 ARRAY['patient.monitoring_due'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "3 months interval", "value": 3, "unit": "months", "when": "recurring", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'conditionName', 'lastCheckDate', 'practicePhone'],
 true, true),

('wellness-program', 'Wellness Program Updates', 'marketing', 'Health and wellness program communications', 'solar:running-bold-duotone',
 ARRAY['wellness.update'],
 '[{"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Program launch", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'programName', 'programDetails', 'practiceName'],
 false, true),

('insurance-verification', 'Insurance Verification', 'billing', 'Verify insurance before appointments', 'solar:shield-user-bold-duotone',
 ARRAY['appointment.insurance_check'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "3 days before", "value": 3, "unit": "days", "when": "before", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'appointmentDate', 'insuranceDetails', 'practicePhone'],
 true, true),

('practice-announcements', 'Practice Announcements', 'marketing', 'Important practice updates and news', 'solar:megaphone-bold-duotone',
 ARRAY['announcement.created'],
 '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
 '[{"id": "1", "label": "Send immediately", "value": 0, "unit": "minutes", "when": "after", "enabled": true}]'::jsonb,
 ARRAY['patientName', 'announcementTitle', 'announcementContent', 'practiceName'],
 true, true);

-- 4. Create efficient batch processing view
CREATE OR REPLACE VIEW automation_batch_process AS
SELECT 
    aq.id as queue_id,
    aq.practice_id,
    aq.trigger_type,
    aq.payload,
    aq.scheduled_for,
    ad.name as automation_name,
    ad.category,
    ad.variables,
    pas.enabled,
    pas.sms_enabled,
    pas.email_enabled,
    pas.sms_template,
    pas.email_subject,
    pas.email_body,
    pas.google_refresh_token,
    pas.google_email,
    p.name as practice_name,
    p.contact_phone as practice_phone,
    p.contact_email as practice_email
FROM automation_queue aq
JOIN automation_definitions ad ON ad.trigger_events @> ARRAY[aq.trigger_type]
LEFT JOIN practice_automation_settings pas 
    ON pas.practice_id = aq.practice_id 
    AND pas.automation_id = ad.id
    AND pas.enabled = true
LEFT JOIN practices p ON p.id = aq.practice_id
WHERE aq.status = 'pending'
    AND aq.scheduled_for <= NOW()
    AND pas.id IS NOT NULL -- Only include if practice has this automation enabled
ORDER BY aq.scheduled_for, aq.created_at
LIMIT 100; -- Process in batches of 100

-- 5. Create trigger function for welcome patient
CREATE OR REPLACE FUNCTION queue_welcome_patient_automation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if practice has welcome automation enabled
    IF EXISTS (
        SELECT 1 FROM practice_automation_settings 
        WHERE practice_id = NEW.practice_id 
        AND automation_id = 'welcome-new-patient'
        AND enabled = true
    ) THEN
        -- Queue the automation
        INSERT INTO automation_queue (
            practice_id,
            trigger_type,
            payload,
            scheduled_for,
            status
        ) VALUES (
            NEW.practice_id,
            'patient.created',
            jsonb_build_object(
                'patient_id', NEW.id,
                'patientName', NEW.full_name,
                'patientEmail', NEW.email,
                'patientPhone', NEW.phone,
                'practice_id', NEW.practice_id,
                'created_at', NEW.created_at,
                'practiceName', (SELECT name FROM practices WHERE id = NEW.practice_id),
                'practicePhone', (SELECT contact_phone FROM practices WHERE id = NEW.practice_id),
                'practiceEmail', (SELECT contact_email FROM practices WHERE id = NEW.practice_id)
            ),
            NOW() + INTERVAL '1 hour', -- Default 1 hour delay from automation definition
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on patient creation
DROP TRIGGER IF EXISTS trigger_queue_welcome_patient ON patients;
CREATE TRIGGER trigger_queue_welcome_patient
AFTER INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION queue_welcome_patient_automation();

-- 6. Add indexes for performance
CREATE INDEX idx_automation_queue_pending ON automation_queue(status, scheduled_for) 
WHERE status = 'pending';

CREATE INDEX idx_practice_automation_settings_enabled ON practice_automation_settings(practice_id, automation_id) 
WHERE enabled = true;

CREATE INDEX idx_automation_definitions_triggers ON automation_definitions USING GIN (trigger_events);

-- 7. Enable RLS
ALTER TABLE automation_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_automation_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view automation definitions
CREATE POLICY "All users can view automation definitions" ON automation_definitions
    FOR SELECT USING (true);

-- Practice users can manage their own automation settings
CREATE POLICY "Practice users can view their automation settings" ON practice_automation_settings
    FOR SELECT USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Practice users can update their automation settings" ON practice_automation_settings
    FOR UPDATE USING (practice_id IN (
        SELECT practice_id FROM users WHERE id = auth.uid()
    ));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_automation_definitions_updated_at BEFORE UPDATE ON automation_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_practice_automation_settings_updated_at BEFORE UPDATE ON practice_automation_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();