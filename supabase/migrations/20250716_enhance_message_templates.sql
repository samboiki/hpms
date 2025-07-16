-- Enhance message_templates table to support all communication templates
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('appointment', 'engagement', 'health', 'billing', 'marketing', 'custom')),
ADD COLUMN IF NOT EXISTS html_content text,
ADD COLUMN IF NOT EXISTS text_content text,
ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('email', 'sms', 'both')),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES practices(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS body text; -- For backward compatibility

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_practice_id ON message_templates(practice_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active);

-- Insert default templates for all practices
DO $$
DECLARE
    practice_record RECORD;
BEGIN
    FOR practice_record IN SELECT id FROM practices LOOP
        -- Appointment Templates
        INSERT INTO message_templates (name, type, category, channel, subject, body, text_content, html_content, variables, practice_id, is_active)
        VALUES 
        -- Appointment Reminder
        ('Appointment Reminder', 'email', 'appointment', 'both', 
         'Appointment Reminder - {{practiceName}}',
         'Dear {{patientName}},\n\nThis is a reminder about your upcoming appointment at {{practiceName}}.\n\nDate: {{appointmentDate}}\nTime: {{appointmentTime}}\n\nPlease arrive 10 minutes early to complete any necessary paperwork. If you need to reschedule, please contact us as soon as possible.',
         'Dear {{patientName}},\n\nThis is a reminder about your upcoming appointment at {{practiceName}}.\n\nDate: {{appointmentDate}}\nTime: {{appointmentTime}}\n\nPlease arrive 10 minutes early to complete any necessary paperwork. If you need to reschedule, please contact us as soon as possible.',
         NULL,
         '{"patientName": "string", "practiceName": "string", "appointmentDate": "string", "appointmentTime": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Appointment Confirmation
        ('Appointment Confirmation', 'email', 'appointment', 'both',
         'Appointment Confirmed - {{practiceName}}',
         'Dear {{patientName}},\n\nYour appointment with {{doctorName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}.\n\nConfirmation Code: {{confirmationCode}}',
         'Dear {{patientName}},\n\nYour appointment with {{doctorName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}.\n\nConfirmation Code: {{confirmationCode}}',
         NULL,
         '{"patientName": "string", "practiceName": "string", "doctorName": "string", "appointmentDate": "string", "appointmentTime": "string", "confirmationCode": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- No-Show Follow-up
        ('No-Show Follow-up', 'sms', 'appointment', 'sms',
         NULL,
         'Hi {{patientName}}, we missed you at your appointment today. Please call {{practicePhone}} to reschedule. We care about your health!',
         'Hi {{patientName}}, we missed you at your appointment today. Please call {{practicePhone}} to reschedule. We care about your health!',
         NULL,
         '{"patientName": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Health Templates
        ('Test Results Available', 'email', 'health', 'email',
         'Your Test Results are Ready - {{practiceName}}',
         'Dear {{patientName}},\n\nYour recent test results are now available. Please contact our office to discuss your results or schedule a follow-up appointment.',
         'Dear {{patientName}},\n\nYour recent test results are now available. Please contact our office to discuss your results or schedule a follow-up appointment.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Follow-up Required', 'email', 'health', 'email',
         'Follow-up Appointment Needed - {{practiceName}}',
         'Dear {{patientName}},\n\nWe would like to schedule a follow-up appointment with you. Please contact our office at your earliest convenience to arrange a suitable time.',
         'Dear {{patientName}},\n\nWe would like to schedule a follow-up appointment with you. Please contact our office at your earliest convenience to arrange a suitable time.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Lab Results Ready', 'email', 'health', 'email',
         'Your Lab Results Are Ready',
         'Dear {{patientName}},\n\nYour lab results from {{testDate}} are now available. Please log in to your patient portal or call {{practicePhone}} to discuss with your doctor.',
         'Dear {{patientName}},\n\nYour lab results from {{testDate}} are now available. Please log in to your patient portal or call {{practicePhone}} to discuss with your doctor.',
         NULL,
         '{"patientName": "string", "testDate": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Imaging Results Ready', 'email', 'health', 'email',
         'Your Imaging Results Are Ready',
         'Dear {{patientName}},\n\nYour imaging results from {{imagingDate}} are now available. Please log in to your patient portal or call {{practicePhone}} to discuss with your doctor.',
         'Dear {{patientName}},\n\nYour imaging results from {{imagingDate}} are now available. Please log in to your patient portal or call {{practicePhone}} to discuss with your doctor.',
         NULL,
         '{"patientName": "string", "imagingDate": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Billing Templates
        ('Payment Reminder', 'email', 'billing', 'both',
         'Payment Reminder - {{practiceName}}',
         'Dear {{patientName}},\n\nThis is a friendly reminder that you have an outstanding balance on your account. Please contact our billing department if you have any questions or would like to arrange a payment plan.',
         'Dear {{patientName}},\n\nThis is a friendly reminder that you have an outstanding balance on your account. Please contact our billing department if you have any questions or would like to arrange a payment plan.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Invoice Sent', 'email', 'billing', 'email',
         'Invoice from {{practiceName}}',
         'Dear {{patientName}},\n\nPlease find attached your invoice for services rendered on {{visitDate}}.\n\nAmount Due: {{amountDue}}\nDue Date: {{dueDate}}\n\nFor questions, please contact our billing department at {{billingPhone}}.',
         'Dear {{patientName}},\n\nPlease find attached your invoice for services rendered on {{visitDate}}.\n\nAmount Due: {{amountDue}}\nDue Date: {{dueDate}}\n\nFor questions, please contact our billing department at {{billingPhone}}.',
         NULL,
         '{"patientName": "string", "practiceName": "string", "visitDate": "string", "amountDue": "string", "dueDate": "string", "billingPhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Payment Received', 'sms', 'billing', 'sms',
         NULL,
         'Hi {{patientName}}, we received your payment of {{paymentAmount}}. Thank you! Your account balance is now {{remainingBalance}}.',
         'Hi {{patientName}}, we received your payment of {{paymentAmount}}. Thank you! Your account balance is now {{remainingBalance}}.',
         NULL,
         '{"patientName": "string", "paymentAmount": "string", "remainingBalance": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Engagement Templates
        ('Birthday Wishes', 'email', 'engagement', 'email',
         'Happy Birthday from {{practiceName}}! 🎉',
         'Dear {{patientName}},\n\nThe entire team at {{practiceName}} wishes you a very happy birthday! We hope you have a wonderful day filled with joy and good health.',
         'Dear {{patientName}},\n\nThe entire team at {{practiceName}} wishes you a very happy birthday! We hope you have a wonderful day filled with joy and good health.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Welcome New Patient', 'email', 'engagement', 'email',
         'Welcome to {{practiceName}}!',
         'Dear {{patientName}},\n\nWelcome to our practice! We are excited to be your healthcare partner. If you have any questions, please call {{practicePhone}}.',
         'Dear {{patientName}},\n\nWelcome to our practice! We are excited to be your healthcare partner. If you have any questions, please call {{practicePhone}}.',
         NULL,
         '{"patientName": "string", "practiceName": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Marketing Templates
        ('Review Request', 'sms', 'marketing', 'sms',
         NULL,
         'Hi {{patientName}}, thank you for visiting {{practiceName}}! If you had a great experience, please leave us a review: {{reviewLink}}',
         'Hi {{patientName}}, thank you for visiting {{practiceName}}! If you had a great experience, please leave us a review: {{reviewLink}}',
         NULL,
         '{"patientName": "string", "practiceName": "string", "reviewLink": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Health Maintenance Templates
        ('Prescription Refill Reminder', 'sms', 'health', 'sms',
         NULL,
         'Hi {{patientName}}, your {{medicationName}} prescription is running low. Contact {{practicePhone}} for a refill.',
         'Hi {{patientName}}, your {{medicationName}} prescription is running low. Contact {{practicePhone}} for a refill.',
         NULL,
         '{"patientName": "string", "medicationName": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Annual Check-up Reminder', 'email', 'health', 'email',
         'Time for Your Annual Check-up!',
         'Dear {{patientName}},\n\nIt has been a year since your last comprehensive health check-up. Regular check-ups help detect health issues early.\n\nPlease call {{practicePhone}} to schedule your annual examination.\n\nStay healthy!',
         'Dear {{patientName}},\n\nIt has been a year since your last comprehensive health check-up. Regular check-ups help detect health issues early.\n\nPlease call {{practicePhone}} to schedule your annual examination.\n\nStay healthy!',
         NULL,
         '{"patientName": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        -- Additional SMS Templates
        ('Appointment Reminder SMS', 'sms', 'appointment', 'sms',
         NULL,
         'Hi {{patientName}}, reminder: You have an appointment at {{practiceName}} on {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM to confirm or CANCEL to cancel.',
         'Hi {{patientName}}, reminder: You have an appointment at {{practiceName}} on {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM to confirm or CANCEL to cancel.',
         NULL,
         '{"patientName": "string", "practiceName": "string", "appointmentDate": "string", "appointmentTime": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Test Results SMS', 'sms', 'health', 'sms',
         NULL,
         'Hi {{patientName}}, your test results are ready. Please contact {{practiceName}} to discuss your results.',
         'Hi {{patientName}}, your test results are ready. Please contact {{practiceName}} to discuss your results.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Follow-up SMS', 'sms', 'health', 'sms',
         NULL,
         'Hi {{patientName}}, please schedule a follow-up appointment at {{practiceName}}. Call us at {{practicePhone}}.',
         'Hi {{patientName}}, please schedule a follow-up appointment at {{practiceName}}. Call us at {{practicePhone}}.',
         NULL,
         '{"patientName": "string", "practiceName": "string", "practicePhone": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Payment Reminder SMS', 'sms', 'billing', 'sms',
         NULL,
         'Hi {{patientName}}, you have an outstanding balance at {{practiceName}}. Please contact our billing department.',
         'Hi {{patientName}}, you have an outstanding balance at {{practiceName}}. Please contact our billing department.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true),
         
        ('Medication Reminder SMS', 'sms', 'health', 'sms',
         NULL,
         'Hi {{patientName}}, this is a reminder to take your medication as prescribed. If you have any questions, contact {{practiceName}}.',
         'Hi {{patientName}}, this is a reminder to take your medication as prescribed. If you have any questions, contact {{practiceName}}.',
         NULL,
         '{"patientName": "string", "practiceName": "string"}'::jsonb,
         practice_record.id,
         true)
         
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Create RLS policies
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their practice templates" ON message_templates
    FOR SELECT USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admin users can manage templates" ON message_templates
    FOR ALL USING (
        practice_id IN (
            SELECT practice_id FROM practice_staff 
            WHERE user_id = auth.uid() 
            AND is_active = true 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Create a function to copy templates from one practice to another
CREATE OR REPLACE FUNCTION copy_templates_to_new_practice(new_practice_id uuid)
RETURNS void AS $$
BEGIN
    -- Copy all active templates from the first practice (or a template practice)
    INSERT INTO message_templates (
        name, type, category, channel, subject, body, text_content, 
        html_content, variables, practice_id, is_active
    )
    SELECT 
        name, type, category, channel, subject, body, text_content, 
        html_content, variables, new_practice_id, is_active
    FROM message_templates
    WHERE practice_id = (SELECT id FROM practices LIMIT 1)
    AND is_active = true
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically create templates for new practices
CREATE OR REPLACE FUNCTION create_templates_for_new_practice()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM copy_templates_to_new_practice(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_templates_on_practice_insert
    AFTER INSERT ON practices
    FOR EACH ROW
    EXECUTE FUNCTION create_templates_for_new_practice();