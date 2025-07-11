# OneHealth Automation Processor - Final Setup

## Your Credentials Are Now Set! ✅

The workflow is configured with your n8n credentials:
- **Supabase API**: `czZG3bwVoyN4WUIu`
- **Gmail OAuth2**: `uA0l39VD4cMHN9cC`

## Quick Import Steps

1. **Copy the workflow** from `onehealth-automation-processor-final.json`
2. **Paste into n8n** (Ctrl+V on canvas)
3. **Save workflow**
4. **Add Service Key Credential** (one more step needed)

## Service Key Setup

For the SMS and Email fallback gateways, you need to create one more credential:

1. In n8n, go to **Credentials** → **Create New**
2. Choose **Header Auth**
3. Name it: "Supabase Service Key"
4. Add header:
   - Name: `Authorization`
   - Value: `Bearer YOUR_SERVICE_ROLE_KEY`
5. Save and note the credential ID

Then update these nodes to use that credential:
- Send SMS
- Email Fallback

## What This Workflow Does

This is your **master automation processor** that handles:
- ✅ ALL 25 automation types
- ✅ Welcome emails
- ✅ Appointment reminders
- ✅ Follow-ups
- ✅ Birthday wishes
- ✅ Lab results
- ✅ Payment reminders
- ✅ And everything else!

## Key Features

1. **Gmail Integration**: Uses your Gmail OAuth for sending emails
2. **Parallel Processing**: SMS and Email send simultaneously  
3. **Smart Fallback**: If Gmail fails, uses Resend
4. **Batch Processing**: Handles 50 items per minute
5. **Error Resilient**: Continues even if some fail
6. **Full Tracking**: Updates queue status for every item

## Testing

```sql
-- Create test automation
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Patient',
    'patientEmail', 'your-email@example.com',
    'patientPhone', '+27123456789'
  ),
  NOW(),
  'queued'
);
```

## Ready to Go!

Once you add the Service Key credential, your automation system is fully operational and will handle ALL automation types automatically!