# Complete Automation System Flow - HPMS

## 🏗️ System Architecture Overview

The HPMS automation system consists of multiple layers working together:

### Edge Functions (Created in July 2025):
1. **automation-engine** - Core processor for automation executions
2. **automation-queue-worker** - Processes items from automation_queue table
3. **automation-webhook** - Handles real-time notifications (not created/missing)
4. **centralized-sms-gateway** - Sends SMS via SMSPortal
5. **centralized-email-gateway** - Sends emails via Resend
6. **follow-up-automation-engine** - Handles follow-up automations
7. **test-email-env** - Test function for environment variables
8. **test-sms-debug** - Test function for SMS debugging

## 📊 Database Tables

### Core Tables:
- `automation_settings` - Stores automation configurations per practice
- `automation_executions` - Individual automation runs
- `automation_queue` - Queue for processing executions
- `automation_triggers` - Defines what triggers each automation
- `practice_sms_logs` - SMS sending history
- `practice_email_logs` - Email sending history
- `practice_sms_subscriptions` - SMS quotas per practice
- `practice_email_subscriptions` - Email quotas per practice

## 🔄 Complete Flow (Current State)

### 1. **Trigger Phase** ✅ WORKING
When a patient is created:
```
patients table INSERT
    ↓
process_patient_automation_queue() trigger
    ↓
Creates automation_execution (status: 'pending')
    ↓
Calls enqueue_automation() 
    ↓
Creates automation_queue entry (status: 'queued')
```

### 2. **Notification Phase** ⚠️ PARTIALLY WORKING
```
automation_queue INSERT
    ↓
notify_queue_webhook() trigger
    ↓
pg_notify('automation_queue_webhook', ...) → No listener configured
    ↓
automation_webhook edge function → NOT CREATED/DEPLOYED
```

### 3. **Processing Phase** ❌ BROKEN
```
React App (automationQueueService)
    ↓ Every 15 seconds
Calls automation-queue-worker edge function
    ↓ 
❌ FAILS: Authentication error (401 Invalid JWT)
    ↓
Never reaches automation-engine
```

### 4. **Execution Phase** ❓ UNTESTED
```
automation-engine (if called)
    ↓
Fetches pending executions
    ↓
Prepares variables (patientName, practiceName, etc.)
    ↓
For each channel (SMS/EMAIL):
    ↓
Calls centralized-sms-gateway / centralized-email-gateway
    ↓
Updates execution status
```

## 🔍 Root Cause Analysis

### Primary Issues:
1. **Authentication Problem**: 
   - automationQueueService uses anonymous key
   - Edge functions require proper JWT authentication
   - No service role key in frontend (security risk)

2. **Missing Webhook Function**:
   - automation-webhook is referenced but doesn't exist
   - Real-time processing is broken

3. **Design Flaw**:
   - Frontend shouldn't be responsible for critical backend processing
   - Queue processing should be server-side

## 🛠️ Permanent Solution

### Option 1: Cron-Based Processing (Recommended)
1. Create a Supabase cron job that runs every minute
2. Calls automation-queue-worker with service role auth
3. Removes dependency on frontend

### Option 2: Database-Driven Processing
1. Use pg_cron extension in PostgreSQL
2. Schedule direct calls to process queue
3. No edge function authentication needed

### Option 3: Webhook-Based Processing
1. Properly implement automation-webhook
2. Use external service (Zapier/n8n) to listen to webhooks
3. Call back to process queue

## 📝 Implementation Plan

### Step 1: Fix Authentication
```sql
-- Create a database function that can call edge functions
CREATE OR REPLACE FUNCTION trigger_queue_processing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pg_net to call edge function with proper auth
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-queue-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'process',
      'source', 'database_trigger'
    )
  );
END;
$$;
```

### Step 2: Create Cron Job
```sql
-- Using pg_cron extension
SELECT cron.schedule(
  'process-automation-queue',
  '* * * * *', -- Every minute
  'SELECT trigger_queue_processing();'
);
```

### Step 3: Remove Frontend Dependency
- Keep automationQueueService for monitoring only
- All processing happens server-side
- Frontend just displays status

## 🚨 Current State for Happy Joy

1. **automation_execution**: Created ✅ (pending)
2. **automation_queue**: Created ✅ (queued)
3. **Processing**: Stuck ❌ (authentication failure)
4. **SMS/Email**: Not sent ❌

## 🔧 Immediate Fix

To process Happy Joy's welcome immediately while implementing permanent solution:

```sql
-- Direct database processing
DO $$
DECLARE
  v_execution record;
BEGIN
  -- Get Happy Joy's execution
  SELECT * INTO v_execution
  FROM automation_executions
  WHERE patient_id = '54c9df8a-257b-463c-b43d-5c2db19c000a'
  AND status = 'pending';
  
  -- Call edge function with proper auth
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-engine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('executionId', v_execution.id)
  );
END $$;
```

## 📋 Action Items

1. **Immediate**: Process stuck queue items
2. **Short-term**: Implement cron-based processing
3. **Long-term**: Redesign to remove frontend dependency
4. **Monitor**: Add proper logging and alerting