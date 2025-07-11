# Welcome Patient Automation Plan

## Overview
Multi-tenant welcome automation that respects practice settings and tracks all communications through central gateways.

## Existing Database Structure

### 1. **automation_templates** (Practice-specific templates)
- `practice_id` - Each template belongs to a practice
- `automation_id` - Unique identifier (e.g., 'welcome-patient')
- `channels` - JSON array of enabled channels (SMS, Email)
- `sms_template` - SMS message template
- `email_template_subject` - Email subject
- `email_template_body` - Email body HTML
- `variables` - Array of template variables

### 2. **automation_queue** (Execution queue)
- `practice_id` - Which practice triggered it
- `payload` - All data needed for execution
- `scheduled_for` - When to execute
- `status` - pending/processing/completed/failed

### 3. **practice_sms_logs** & **practice_email_logs**
- Complete tracking of all communications
- Usage counting for subscription limits

## Welcome Patient Workflow Design

### Step 1: Database Trigger
When a new patient is created:
1. Insert record into `automation_queue` with:
   - `trigger_type`: 'patient_created'
   - `payload`: patient data + practice data
   - `scheduled_for`: NOW() or delayed based on practice settings

### Step 2: n8n Workflow
The n8n workflow will:
1. **Poll Supabase** every minute for pending automations
2. **Fetch practice settings** and templates
3. **Handle Google OAuth** for practice email sending
4. **Send communications** via centralized gateways
5. **Update status** and logs

### Step 3: Multi-Channel Execution
- **SMS**: Via centralized-sms-gateway edge function
- **Email**: Via practice's Google account (OAuth) OR centralized-email-gateway

## Implementation Steps

### 1. Create Welcome Patient Template
```sql
-- Insert default welcome template for each practice
INSERT INTO automation_templates (
    practice_id,
    automation_id,
    name,
    category,
    channels,
    sms_template,
    email_template_subject,
    email_template_body,
    variables
) VALUES (
    [practice_id],
    'welcome-patient',
    'Welcome New Patient',
    'patient',
    '[{"type": "SMS", "enabled": true}, {"type": "Email", "enabled": true}]'::jsonb,
    'Welcome to {{practice_name}}, {{patient_name}}! We look forward to caring for you. Save our number for easy access. Reply STOP to opt out.',
    'Welcome to {{practice_name}}!',
    '<h2>Welcome {{patient_name}}!</h2><p>Thank you for choosing {{practice_name}}...</p>',
    ARRAY['patient_name', 'patient_phone', 'patient_email', 'practice_name', 'practice_phone']
);
```

### 2. Database Function to Queue Welcome
```sql
CREATE OR REPLACE FUNCTION queue_welcome_patient()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if practice has welcome automation enabled
    IF EXISTS (
        SELECT 1 FROM automation_templates 
        WHERE practice_id = NEW.practice_id 
        AND automation_id = 'welcome-patient'
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(channels) AS c 
            WHERE c->>'enabled' = 'true'
        )
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
            'patient_created',
            jsonb_build_object(
                'patient_id', NEW.id,
                'patient_name', NEW.full_name,
                'patient_email', NEW.email,
                'patient_phone', NEW.phone,
                'practice_id', NEW.practice_id,
                'created_at', NEW.created_at
            ),
            NOW(), -- Immediate execution
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_welcome_patient
AFTER INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION queue_welcome_patient();
```

### 3. n8n Workflow Structure
```json
{
  "name": "HPMS Welcome Patient Processor",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{"field": "minutes", "minutesInterval": 1}]
        }
      }
    },
    {
      "name": "Fetch Pending Automations",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "get",
        "table": "automation_queue",
        "filters": {
          "status": "pending",
          "trigger_type": "patient_created"
        }
      }
    },
    {
      "name": "Process Each Automation",
      "type": "n8n-nodes-base.splitInBatches"
    },
    {
      "name": "Get Practice Template",
      "type": "n8n-nodes-base.supabase"
    },
    {
      "name": "Send SMS",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-sms-gateway"
      }
    },
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.gmail"
    },
    {
      "name": "Update Queue Status",
      "type": "n8n-nodes-base.supabase"
    }
  ]
}
```

## Google OAuth Setup
For each practice to send emails from their domain:
1. Create Google Cloud Project
2. Enable Gmail API
3. Set up OAuth 2.0 credentials
4. Store refresh token in practice settings
5. n8n uses refresh token to send emails

## Next Steps
1. ✅ Understand existing structure
2. Create welcome patient template function
3. Create n8n workflow JSON
4. Set up Google OAuth flow
5. Test with single practice
6. Roll out to all practices