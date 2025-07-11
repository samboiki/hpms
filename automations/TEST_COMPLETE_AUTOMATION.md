# Complete Automation System Test Guide

## Current Status

✅ **Database Setup Complete**
- All automation tables created
- 25 automations defined
- Trigger functions in place
- OAuth credential storage ready

✅ **Gmail Integration Complete**
- Integrated into Settings → Social tab
- OAuth flow ready (needs Google credentials)
- Edge function ready to deploy

✅ **Test Data Created**
- Practice: NewCharm Dental Practice (b64632c2-3a56-44cf-a2c9-0e42be03a2d3)
- Welcome automation enabled
- Test patient created: Welcome Test Patient
- Automation queued and ready to process

## What's Left to Test

### 1. Deploy Gmail OAuth Edge Function

```bash
cd /home/happy/projects/hpms
supabase functions deploy gmail-oauth-callback
```

### 2. Set Google OAuth Credentials

In Supabase Dashboard:
1. Go to Edge Functions → gmail-oauth-callback → Settings
2. Add environment variables:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret

### 3. Connect Gmail Account

1. Go to Settings → Social tab in the app
2. Click "Add Account"
3. Select "Gmail" from platform dropdown
4. Click "Connect with Google"
5. Authorize access
6. Save the connected account

### 4. Set Up n8n Workflow

#### Option A: n8n Cloud (Recommended for testing)
1. Import `/home/happy/projects/hpms/automations/n8n-workflows/welcome-patient-workflow.json`
2. Configure Supabase credentials:
   - URL: https://jjxlfunlbyayxwvlpgwt.supabase.co
   - Service Role Key: (from Supabase dashboard)
3. Activate the workflow

#### Option B: Self-hosted n8n
1. SSH into your DigitalOcean droplet
2. Import the workflow file
3. Configure credentials
4. Activate workflow

### 5. Monitor Automation Execution

The n8n workflow runs every minute and will:
1. Call `get_pending_welcome_automations()` to get batches
2. Process each automation
3. Send SMS via centralized gateway
4. Send Email via Gmail (if connected)
5. Update status to 'completed'

### 6. Check Results

```sql
-- Check automation queue status
SELECT 
    id,
    status,
    scheduled_for,
    processed_at,
    payload->>'patientName' as patient,
    error_message
FROM automation_queue 
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY created_at DESC;

-- Check SMS logs
SELECT * FROM practice_sms_logs 
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY sent_at DESC;

-- Check email logs  
SELECT * FROM practice_email_logs 
WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'
ORDER BY sent_at DESC;
```

## Current Test Data

### Automation Queued
- **ID**: 871b3914-1b24-4141-a756-ecd7a4e4a34d
- **Patient**: Welcome Test Patient
- **Email**: welcome.test@example.com  
- **Phone**: +27123456789
- **Scheduled**: 2025-07-08 17:07:23 UTC (1 hour after creation)
- **Status**: queued

### Templates Set
- **SMS**: "Welcome to {{practiceName}}, {{patientName}}! We're excited to have you as our patient. Your first appointment can be scheduled at your convenience. Reply STOP to opt out."
- **Email Subject**: "Welcome to {{practiceName}}!"
- **Email Body**: HTML template with welcome message

## Quick Test Commands

```bash
# Create another test patient
psql -c "INSERT INTO patients (practice_id, first_name, last_name, id_number, email, cell_number, date_of_birth, gender) VALUES ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Another', 'Test', 'TEST'||NOW()::text, 'another@test.com', '+27987654321', '1990-01-01', 'male');"

# Check queue
psql -c "SELECT id, status, payload->>'patientName' FROM automation_queue WHERE trigger_type = 'patient.created' ORDER BY created_at DESC LIMIT 5;"

# Process manually (if needed)
psql -c "SELECT * FROM get_pending_welcome_automations(10);"
```

## Troubleshooting

### Automation Not Queued?
- Check if trigger exists: `\df queue_welcome_patient_automation`
- Check if automation enabled: `SELECT * FROM practice_automation_settings WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'`

### Gmail Not Working?
- Ensure OAuth credentials are set in edge function
- Check practice_oauth_credentials table
- Verify Gmail account is connected in UI

### n8n Not Processing?
- Check workflow is active
- Verify Supabase credentials
- Check execution logs in n8n
- Ensure scheduled_for time has passed

## Next Steps After Testing

1. **Enable More Automations**
   - Appointment reminders
   - Visit follow-ups
   - Lab result notifications
   - Birthday greetings

2. **Customize Templates**
   - Add practice branding
   - Personalize messages
   - Add unsubscribe links

3. **Monitor Performance**
   - Set up alerts for failures
   - Track delivery rates
   - Monitor costs

The automation system is now ready for testing!