# Improved n8n Automation Workflow Guide

## Overview
This improved workflow addresses the "No output data returned" issue by implementing proper error handling, status management, and automatic recovery from stuck processes.

## Key Improvements

### 1. **Automatic Processing Timeout Recovery**
The `get_all_pending_automations` function now automatically resets records stuck in "processing" status after 5 minutes:
```sql
-- Records stuck in processing > 5 minutes are reset to queued
UPDATE automation_queue
SET status = 'queued'
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '5 minutes'
```

### 2. **Proper Status Management**
We now have dedicated functions for status updates:
- `complete_automation(queue_id, success_message)` - Mark as completed
- `fail_automation(queue_id, error_message, retry)` - Mark as failed with optional retry
- `get_automation_statistics(practice_id, days)` - Monitor automation performance

### 3. **Enhanced Error Handling**
The workflow now:
- Validates all data before processing
- Handles "no data" scenarios gracefully
- Implements retry logic with exponential backoff
- Logs validation errors for debugging

### 4. **Improved n8n Workflow Features**

#### Always Output Data
All HTTP Request nodes now have `"alwaysOutputData": true` to prevent workflow stops.

#### Data Validation
```javascript
// Validates required fields
// Checks communication channel requirements
// Validates phone/email formats
// Processes template variables
```

#### Status Updates
- Successfully sent automations → `completed`
- Failed with retry → `queued` (with exponential backoff)
- Failed permanently → `failed`

## Implementation Steps

### Step 1: Import the Improved Workflow
1. Open n8n at https://n8n.onehealthsystems.com
2. Create a new workflow
3. Import `/automations/n8n-workflows/onehealth-automation-improved.json`
4. Update credentials if needed

### Step 2: Configure Settings
In the "Get Pending Automations" node:
- `batch_size`: 10 (adjust based on volume)
- `max_attempts`: 3 (retry limit)

### Step 3: Test the Workflow
```sql
-- Create a test automation
INSERT INTO automation_queue (
    practice_id,
    trigger_type,
    status,
    scheduled_for,
    payload,
    test_mode
) VALUES (
    'ffed1160-00ec-4c4f-8810-913a24348d90',
    'patient.created',
    'queued',
    NOW(),
    jsonb_build_object(
        'patient_id', 'test-123',
        'patientName', 'Test Patient',
        'patientPhone', '+27123456789',
        'patientEmail', 'test@example.com'
    ),
    true
);
```

### Step 4: Monitor Performance
```sql
-- Check automation statistics
SELECT * FROM get_automation_statistics(
    'ffed1160-00ec-4c4f-8810-913a24348d90', 
    7 -- last 7 days
);
```

## Workflow Logic Flow

1. **Every Minute**: Cron trigger activates
2. **Get Pending Automations**: Fetches up to 10 queued automations
3. **Check Data**: Branches based on data availability
   - No data → Output message and stop
   - Has data → Continue processing
4. **Process Templates**: Validates and replaces template variables
5. **Validation Check**: 
   - Invalid → Fail permanently (no retry)
   - Valid → Continue to send
6. **Send Communications**:
   - Check SMS enabled → Send via centralized gateway
   - Check Email enabled → Send via centralized gateway
7. **Merge Results**: Combine SMS/Email results
8. **Update Status**:
   - Success → Mark as completed
   - Failure → Mark for retry with backoff

## Troubleshooting

### No Data Returned
- Check if automations exist: `SELECT * FROM automation_queue WHERE status = 'queued'`
- Verify automation settings are enabled
- Check for stuck processing records

### Communications Not Sending
- Verify practice has SMS/Email credits
- Check centralized gateway logs
- Ensure templates have all required variables

### High Failure Rate
```sql
-- Find common failure reasons
SELECT 
    error_message,
    COUNT(*) as count
FROM automation_queue
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC;
```

## Best Practices

1. **Keep batch sizes small** (10-20) to prevent timeouts
2. **Monitor processing times** to adjust timeout settings
3. **Use test_mode** for testing new automations
4. **Review failed automations** weekly for patterns
5. **Clean up old completed records** monthly

## Database Maintenance

```sql
-- Archive old completed automations (run monthly)
INSERT INTO automation_queue_archive
SELECT * FROM automation_queue
WHERE status IN ('completed', 'failed')
  AND created_at < NOW() - INTERVAL '30 days';

DELETE FROM automation_queue
WHERE status IN ('completed', 'failed')
  AND created_at < NOW() - INTERVAL '30 days';
```