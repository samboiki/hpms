yes# n8n Efficient Multi-Tenant Automation Architecture

## Current Situation
- 25 automation types hardcoded in frontend
- Each practice can enable/disable automations with custom settings
- Need to minimize n8n execution costs

## Proposed Architecture

### 1. Master Automation Definitions Table
First, let's store the 25 automations in the database:

```sql
-- Master automation definitions (shared across all practices)
CREATE TABLE automation_definitions (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'appointment-reminder'
    name TEXT NOT NULL,
    category VARCHAR(50),
    description TEXT,
    icon TEXT,
    trigger_events TEXT[], -- e.g., ['appointment.created', 'appointment.updated']
    default_channels JSONB,
    default_timings JSONB,
    variables TEXT[], -- template variables like {{patientName}}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice-specific automation settings
CREATE TABLE practice_automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),
    automation_id VARCHAR(50) REFERENCES automation_definitions(id),
    enabled BOOLEAN DEFAULT false,
    channels JSONB, -- practice's custom channel settings
    timings JSONB, -- practice's custom timing settings
    sms_template TEXT,
    email_subject TEXT,
    email_body TEXT,
    -- Google OAuth for practice emails
    google_refresh_token TEXT,
    last_token_refresh TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(practice_id, automation_id)
);
```

### 2. Efficient n8n Execution Strategy

**Single n8n Workflow per Automation Type**
Instead of running a workflow per practice, we run ONE workflow that handles ALL practices:

```
n8n Workflow: "HPMS Universal Automation Processor"
├── Schedule Trigger (every 1 minute)
├── Get Automation Type (parameter)
├── Query ALL Active Automations for ALL Practices
├── Process in Batches
├── Send via Centralized Gateways
└── Update Logs
```

### 3. Smart Queue Processing

```sql
-- Enhanced automation queue for batch processing
CREATE OR REPLACE VIEW automation_batch_queue AS
SELECT 
    aq.id,
    aq.practice_id,
    aq.trigger_type,
    aq.payload,
    aq.scheduled_for,
    pas.automation_id,
    pas.channels,
    pas.sms_template,
    pas.email_subject,
    pas.email_body,
    pas.google_refresh_token,
    p.name as practice_name,
    p.phone as practice_phone
FROM automation_queue aq
JOIN practice_automation_settings pas 
    ON pas.practice_id = aq.practice_id 
    AND pas.automation_id = aq.trigger_type
    AND pas.enabled = true
JOIN practices p ON p.id = aq.practice_id
WHERE aq.status = 'pending'
    AND aq.scheduled_for <= NOW()
ORDER BY aq.scheduled_for, aq.created_at;
```

### 4. n8n Workflow Examples

#### Welcome Patient Workflow (Processes ALL practices at once)
```json
{
  "name": "HPMS Welcome Patient - All Practices",
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {"interval": [{"field": "minutes", "minutesInterval": 1}]}
      }
    },
    {
      "name": "Get Welcome Queue",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT * FROM automation_batch_queue WHERE automation_id = 'welcome-new-patient' LIMIT 100"
      }
    },
    {
      "name": "Process Each",
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": {"batchSize": 10}
    },
    {
      "name": "Template Processing",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "code": "// Replace template variables\nconst template = $input.item.sms_template;\nconst data = $input.item.payload;\nreturn {\n  message: template.replace(/{{(\\w+)}}/g, (match, key) => data[key] || match)\n};"
      }
    },
    {
      "name": "Send SMS",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/functions/v1/centralized-sms-gateway",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {"name": "practiceId", "value": "={{$item.practice_id}}"},
            {"name": "recipientPhone", "value": "={{$item.payload.patient_phone}}"},
            {"name": "messageContent", "value": "={{$item.message}}"},
            {"name": "messageType", "value": "welcome_patient"},
            {"name": "patientId", "value": "={{$item.payload.patient_id}}"}
          ]
        }
      }
    },
    {
      "name": "Update Status",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "update",
        "table": "automation_queue",
        "id": "={{$item.id}}",
        "updateFields": {
          "status": "completed",
          "completed_at": "={{$now.toISO()}}"
        }
      }
    }
  ]
}
```

### 5. Implementation Plan

#### Phase 1: Database Setup
1. Create `automation_definitions` table
2. Migrate the 25 automations from frontend to database
3. Create `practice_automation_settings` table
4. Create batch processing views

#### Phase 2: Welcome Patient Implementation
1. Create trigger on patient creation
2. Build n8n workflow for welcome messages
3. Test with one practice
4. Enable for all practices

#### Phase 3: Appointment Reminders
1. Create scheduled job to queue reminders
2. Build n8n workflow for reminders
3. Process all practices in one execution

### 6. Cost Savings Analysis

**Current Approach (if implemented per practice):**
- 100 practices × 25 automations × 30 days = 75,000 executions/month

**Proposed Approach:**
- 25 automation types × 1440 minutes/day × 30 days = 1,080,000 checks
- BUT: Most checks return empty (no automations to process)
- Actual executions: ~5,000-10,000/month

**Result: 85-95% reduction in n8n executions!**

### 7. Benefits
1. **Cost Efficient**: One workflow handles all practices
2. **Scalable**: Adding practices doesn't increase executions
3. **Maintainable**: Central automation definitions
4. **Flexible**: Each practice has custom settings
5. **Trackable**: All communications logged centrally