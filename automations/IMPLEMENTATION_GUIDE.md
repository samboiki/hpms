# HPMS Multi-Tenant Automation Implementation Guide

## Overview
This system runs ONE n8n workflow that processes automations for ALL practices, dramatically reducing n8n execution costs.

## Step 1: Database Setup

Run these migrations in order:
```bash
# 1. Create the automation system tables
psql -d your_database -f 001_setup_automation_system.sql

# 2. Create the RPC functions
psql -d your_database -f 002_automation_rpc_functions.sql
```

## Step 2: Enable Welcome Automation for a Test Practice

```sql
-- Enable welcome automation for a specific practice
INSERT INTO practice_automation_settings (
    practice_id,
    automation_id,
    enabled,
    sms_enabled,
    email_enabled,
    sms_template,
    email_subject,
    email_body
) VALUES (
    'YOUR-PRACTICE-UUID-HERE',
    'welcome-new-patient',
    true,
    true,
    true,
    'Welcome to {{practiceName}}, {{patientName}}! We''re excited to have you as our patient. Save this number for appointments: {{practicePhone}}',
    'Welcome to {{practiceName}}!',
    '<h2>Welcome {{patientName}}!</h2><p>Thank you for choosing us!</p>'
);
```

## Step 3: Import n8n Workflow

1. Open your n8n instance
2. Go to Workflows → Import
3. Import `n8n-workflows/welcome-patient-workflow.json`
4. Configure credentials:
   - Add Supabase API credentials
   - Use your service role key for the edge functions

## Step 4: Test the System

1. Create a test patient:
```sql
INSERT INTO patients (practice_id, full_name, email, phone) 
VALUES ('YOUR-PRACTICE-UUID', 'Test Patient', 'test@example.com', '+1234567890');
```

2. Check the automation queue:
```sql
SELECT * FROM automation_queue WHERE trigger_type = 'patient.created';
```

3. The n8n workflow will pick it up within 1 minute!

## Step 5: Monitor Performance

```sql
-- View pending automations
SELECT * FROM automation_batch_process;

-- Check automation statistics
SELECT * FROM get_practice_automation_stats('YOUR-PRACTICE-UUID', 30);

-- Reset any stuck automations
SELECT reset_stuck_automations();
```

## How It Works

1. **Patient Created** → Trigger fires → Adds to `automation_queue`
2. **n8n Runs Every Minute** → Calls `get_pending_welcome_automations()`
3. **Batch Processing** → Processes up to 100 automations per execution
4. **Multi-Channel Delivery** → Sends SMS/Email via centralized gateways
5. **Status Updates** → Marks as completed in the queue

## Cost Savings Example

- **Old Way**: 100 practices × 25 automations = 2,500 n8n workflows
- **New Way**: 25 automation types × 1 workflow each = 25 workflows
- **Savings**: 99% reduction in n8n workflows!

## Next Automations to Implement

1. **Appointment Reminders** - Most valuable, high volume
2. **Payment Reminders** - Direct revenue impact
3. **Lab Results Ready** - Critical for patient care
4. **Birthday Wishes** - Easy win for patient engagement

## Template Variables

All templates support these variables:
- `{{patientName}}` - Patient's full name
- `{{practiceName}}` - Practice name
- `{{practicePhone}}` - Practice phone number
- `{{practiceEmail}}` - Practice email
- `{{appointmentDate}}` - Formatted appointment date
- `{{appointmentTime}}` - Formatted appointment time
- `{{doctorName}}` - Doctor's name
- Plus any custom data in the payload

## Troubleshooting

1. **Automations not sending?**
   - Check if practice has automation enabled
   - Verify SMS/Email subscriptions are active
   - Check automation_queue status

2. **Templates not replacing variables?**
   - Ensure variable names match exactly (case-sensitive)
   - Check payload contains the required data

3. **n8n workflow errors?**
   - Verify Supabase credentials
   - Check edge function URLs
   - Review n8n execution logs