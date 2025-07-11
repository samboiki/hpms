# Bulletproof Automation System Guide

## Overview
This is a comprehensive, production-ready automation system that handles all edge cases and ensures reliable message delivery.

## Key Improvements

### 1. **Database Function Robustness**
- Automatic recovery from stuck records
- Comprehensive error handling
- Default values for all fields
- Proper phone number formatting
- JSON wrapper for n8n compatibility

### 2. **Trigger Function Improvements**
- Automatic phone number formatting (+264 prefix)
- Error handling that doesn't break patient creation
- Validation of practice data
- Consistent payload structure

### 3. **n8n Workflow Enhancements**
- Uses JSON endpoint for better compatibility
- Handles empty responses gracefully
- Validates all data before processing
- Phone number formatting validation
- Comprehensive error messages

## How It Works

### Patient Creation Flow
1. Patient created in frontend
2. Trigger function formats data and creates automation
3. 1-hour delay for welcome message (configurable)
4. n8n picks up due automations every minute
5. Templates processed with variable replacement
6. SMS/Email sent via centralized gateways
7. Status updated to completed/failed

### Data Validation
- Phone numbers automatically formatted to international (+264)
- Missing data handled with defaults
- Template variables safely replaced
- Invalid records marked as failed (no retry)

## Testing Instructions

### 1. Create Test Patient
```sql
-- Insert test patient
INSERT INTO patients (
    practice_id,
    first_name,
    last_name,
    id_number,
    email,
    cell_number,
    date_of_birth,
    gender
) VALUES (
    'ffed1160-00ec-4c4f-8810-913a24348d90',
    'Test',
    'Patient',
    'TEST' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'test@example.com',
    '0812345678',  -- Will be auto-formatted to +264812345678
    '1990-01-01',
    'male'
) RETURNING id;
```

### 2. Check Automation Created
```sql
-- View recent automations
SELECT 
    id,
    trigger_type,
    payload->>'patientName' as patient,
    payload->>'patientPhone' as phone,
    status,
    scheduled_for,
    NOW() as current_time,
    scheduled_for - NOW() as time_until_due
FROM automation_queue
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
ORDER BY created_at DESC
LIMIT 5;
```

### 3. Make Automation Due Immediately (for testing)
```sql
-- Update to process immediately
UPDATE automation_queue
SET scheduled_for = NOW() - INTERVAL '1 minute'
WHERE id = 'YOUR_AUTOMATION_ID'
AND status = 'queued';
```

### 4. Test n8n Workflow
- Import `/automations/n8n-workflows/onehealth-automation-bulletproof.json`
- Run manually or wait for cron trigger
- Check execution logs

## Monitoring

### Check Processing Status
```sql
-- View automation statistics
SELECT * FROM get_automation_statistics(
    'ffed1160-00ec-4c4f-8810-913a24348d90',
    7  -- last 7 days
);
```

### View Recent Logs
```sql
-- SMS logs
SELECT * FROM practice_sms_logs
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
ORDER BY created_at DESC
LIMIT 10;

-- Email logs  
SELECT * FROM practice_email_logs
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### No Automations Found
1. Check if automation is due: `scheduled_for <= NOW()`
2. Verify status is 'queued' not 'processing'
3. Ensure automation settings are enabled
4. Check attempt_count < max_attempts

### Phone Number Issues
- System auto-formats to +264 for Namibia
- Handles: 0812345678 → +264812345678
- Handles: 812345678 → +264812345678

### Empty Payload Issues
- Function provides defaults for all fields
- Missing patient data won't break processing
- Check trigger function is creating proper payload

### n8n Parsing Errors
- Use the JSON endpoint: `get_pending_automations_for_n8n`
- Check n8n logs for specific error messages
- Verify Supabase credentials are correct

## Configuration

### Adjust Welcome Message Delay
```sql
-- Change from 1 hour to 30 minutes
CREATE OR REPLACE FUNCTION queue_welcome_patient_automation()
-- ... (function body)
    NOW() + INTERVAL '30 minutes',  -- Changed from '1 hour'
-- ...
```

### Batch Size
- Default: 10 automations per run
- Adjust in n8n workflow or function call
- Consider API limits and processing time

### Retry Logic
- Max attempts: 3 (configurable)
- Exponential backoff on failures
- Failed permanently after max attempts

## Best Practices

1. **Monitor Daily**
   - Check failed automations
   - Review delivery rates
   - Verify phone numbers

2. **Clean Up Monthly**
   - Archive old completed records
   - Review failed patterns
   - Update templates as needed

3. **Test Regularly**
   - Create test patients monthly
   - Verify all automation types
   - Check edge cases

## Security Considerations

1. **Data Protection**
   - Patient data encrypted at rest
   - Secure API endpoints
   - Audit trails for compliance

2. **Rate Limiting**
   - Respect SMS/Email provider limits
   - Monitor usage against quotas
   - Implement backoff strategies

3. **Access Control**
   - Functions use SECURITY DEFINER
   - RLS policies on all tables
   - Credential rotation schedule

This bulletproof system ensures reliable automation delivery with comprehensive error handling and monitoring capabilities.