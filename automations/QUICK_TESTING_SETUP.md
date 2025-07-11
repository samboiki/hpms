# Quick Testing Setup Guide

## 1. Apply Database Migration
```bash
# Run the migration to create testing tables
npx supabase db push
```

## 2. Import the Enhanced Workflow
1. Copy content from `onehealth-automation-with-testing.json`
2. In n8n, press Ctrl+V on the canvas
3. Save the workflow

## 3. Configure SMTP Credential
Since you're using Gmail SMTP instead of Gmail OAuth node:
1. Go to Credentials → Create New → SMTP
2. Configure with your Gmail settings:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: Your Gmail address
   - Password: App-specific password
3. Note the credential ID and update the workflow

## 4. Test the Validation
```sql
-- Test with missing data
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Validation Test'
    -- Missing email and phone!
  ),
  NOW(),
  'queued',
  true
);

-- Check validation errors
SELECT * FROM automation_test_logs 
WHERE test_type = 'validation_failed'
ORDER BY created_at DESC
LIMIT 1;
```

## 5. Test in Test Mode
```sql
-- Create test automation
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode  -- This enables test mode!
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Test Mode Patient',
    'patientEmail', 'test@example.com',
    'patientPhone', '+27123456789'
  ),
  NOW(),
  'queued',
  true
);

-- Check test results
SELECT * FROM automation_test_logs 
WHERE test_type = 'test_mode_execution'
ORDER BY created_at DESC
LIMIT 1;
```

## 6. Run Production Test
```sql
-- Real automation (test_mode = false)
INSERT INTO automation_queue (
  practice_id,
  trigger_type,
  payload,
  scheduled_for,
  status,
  test_mode
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'patient.created',
  jsonb_build_object(
    'patient_id', gen_random_uuid(),
    'patientName', 'Real Patient',
    'patientEmail', 'your-real-email@example.com',
    'patientPhone', '+27123456789'
  ),
  NOW(),
  'queued',
  false  -- Production mode!
);
```

## 7. Monitor Performance
```sql
-- View latest performance metrics
SELECT 
  timestamp,
  metrics->>'total_processed' as items,
  metrics->>'processing_time_ms' as time_ms,
  metrics->>'avg_time_per_item' as avg_ms,
  metrics->>'success_rate' as success_rate
FROM automation_performance_logs
ORDER BY timestamp DESC
LIMIT 5;
```

## Key Features in This Workflow

### 1. **Validation Node**
- Validates all required fields
- Checks email/phone formats
- Logs validation errors

### 2. **Test Mode Branch**
- Simulates sending without actually sending
- Logs what would be sent
- Perfect for testing templates

### 3. **Performance Tracking**
- Measures processing time
- Tracks success/failure rates
- Calculates averages

### 4. **Error Handling**
- Continues on failure
- Logs all errors
- Updates queue status appropriately

### 5. **Batch Processing**
- Processes 10 items at a time
- Prevents overload
- Maintains performance

## Testing Checklist

- [ ] Database migration applied
- [ ] Workflow imported to n8n
- [ ] SMTP credential configured
- [ ] Test validation with bad data
- [ ] Test in test mode
- [ ] Test in production mode
- [ ] Check performance logs
- [ ] Verify error handling

## What's Next?

1. **Set up monitoring dashboard** in Grafana
2. **Create automated tests** that run daily
3. **Configure alerts** for failures
4. **Analyze performance** trends
5. **Optimize batch sizes** based on metrics