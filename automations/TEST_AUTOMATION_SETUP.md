# Testing the Automation System

## What We've Built

1. **Database Tables**:
   - `automation_definitions` - 25 pre-defined automations
   - `practice_automation_settings` - Practice-specific settings
   - `automation_queue` - Queue for pending automations
   - `practice_oauth_credentials` - Gmail OAuth tokens

2. **Gmail OAuth Integration**:
   - UI in Settings → Social tab
   - OAuth flow with Google
   - Secure token storage

3. **n8n Workflow**:
   - Processes ALL practices in one execution
   - Calls RPC functions to get pending automations
   - Sends via centralized gateways

## Testing Steps

### 1. Enable Welcome Automation for Your Practice

```sql
-- First, find your practice ID
SELECT id, name FROM practices WHERE name LIKE '%your_practice%';

-- Enable welcome automation (replace with your practice ID)
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
    'YOUR-PRACTICE-UUID',
    'welcome-new-patient',
    true,
    true,
    true,
    'Welcome to {{practiceName}}, {{patientName}}! We''re excited to have you as our patient. Reply STOP to opt out.',
    'Welcome to {{practiceName}}!',
    '<h2>Welcome {{patientName}}!</h2><p>Thank you for choosing {{practiceName}} for your healthcare needs.</p><p>We look forward to providing you with excellent care.</p>'
);
```

### 2. Connect Gmail Account

1. Go to Settings → Social tab
2. You'll see the Gmail Integration section at the top
3. Click "Connect with Google"
4. Authorize the app
5. Your Gmail will be connected for sending automated emails

### 3. Create a Test Patient

```sql
-- This will automatically trigger the welcome automation
INSERT INTO patients (
    practice_id, 
    full_name, 
    email, 
    phone,
    date_of_birth,
    gender
) VALUES (
    'YOUR-PRACTICE-UUID',
    'Test Patient',
    'test@example.com',
    '+27123456789',
    '1990-01-01',
    'Male'
);
```

### 4. Check the Queue

```sql
-- See if automation was queued
SELECT * FROM automation_queue 
WHERE trigger_type = 'patient.created' 
ORDER BY created_at DESC;

-- Check automation status
SELECT 
    aq.id,
    aq.status,
    aq.scheduled_for,
    aq.payload->>'patientName' as patient_name,
    ad.name as automation_name
FROM automation_queue aq
JOIN automation_definitions ad ON ad.trigger_events @> ARRAY[aq.trigger_type]
WHERE aq.practice_id = 'YOUR-PRACTICE-UUID'
ORDER BY aq.created_at DESC;
```

### 5. Import n8n Workflow

1. Open n8n
2. Import `n8n-workflows/welcome-patient-workflow.json`
3. Configure Supabase credentials
4. Activate the workflow

### 6. Monitor Execution

```sql
-- Check if automations were processed
SELECT * FROM automation_queue 
WHERE status = 'completed' 
AND practice_id = 'YOUR-PRACTICE-UUID';

-- Check SMS logs
SELECT * FROM practice_sms_logs 
WHERE practice_id = 'YOUR-PRACTICE-UUID' 
ORDER BY sent_at DESC;

-- Check email logs
SELECT * FROM practice_email_logs 
WHERE practice_id = 'YOUR-PRACTICE-UUID' 
ORDER BY sent_at DESC;
```

## Environment Variables Needed

For the edge function to work, set these in Supabase:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Already set by Supabase
SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

## Troubleshooting

1. **Automation not queued?**
   - Check if practice has automation enabled
   - Verify the trigger function exists

2. **Gmail not connecting?**
   - Ensure GOOGLE_CLIENT_ID is set
   - Check OAuth redirect URI matches

3. **n8n not processing?**
   - Verify workflow is active
   - Check Supabase credentials
   - Look at n8n execution logs

## Next Steps

1. Deploy the edge function:
   ```bash
   supabase functions deploy gmail-oauth-callback
   ```

2. Set up Google OAuth:
   - Create project in Google Cloud Console
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add redirect URI: `https://your-domain.com/settings/gmail-callback`

3. Test with real patient data

4. Enable more automations (appointment reminders, etc.)