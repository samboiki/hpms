# Complete HPMS Automation Process Documentation

## Overview
This document explains the entire automation process from patient creation to message delivery, including all tables, triggers, and processing steps.

## Table of Contents
1. [Database Tables](#database-tables)
2. [Trigger Flow](#trigger-flow)
3. [Processing Pipeline](#processing-pipeline)
4. [Gmail OAuth Integration](#gmail-oauth-integration)
5. [SMS/Email Gateways](#smsemail-gateways)
6. [n8n Workflow Processing](#n8n-workflow-processing)

## Database Tables

### Core Automation Tables

#### 1. `automation_definitions`
Stores all available automation types (25 pre-defined automations).

**Key Columns:**
- `id`: Unique identifier (e.g., 'welcome-new-patient')
- `name`: Human-readable name
- `trigger_events`: Array of events that trigger this automation
- `default_channels`: JSON object with default SMS/Email settings
- `default_timings`: JSON object with delays and scheduling
- `variables`: Array of template variables available

#### 2. `practice_automation_settings`
Practice-specific configuration for each automation.

**Key Columns:**
- `practice_id`: Links to practice
- `automation_id`: Links to automation_definitions
- `enabled`: Whether automation is active
- `sms_enabled`: Send SMS for this automation
- `email_enabled`: Send email for this automation
- `sms_template`: Custom SMS template
- `email_subject`: Custom email subject
- `email_body`: Custom email HTML body

#### 3. `automation_queue`
Master queue for all pending automations.

**Key Columns:**
- `id`: UUID primary key
- `practice_id`: Practice that triggered this
- `trigger_type`: Event type (e.g., 'patient.created')
- `payload`: JSONB with all data for templates
- `scheduled_for`: When to process this automation
- `status`: queued → processing → completed/failed
- `attempt_count`: Number of processing attempts
- `error_message`: Last error if failed

#### 4. `practice_oauth_apps`
Stores OAuth application credentials (client_id, client_secret).

**Key Columns:**
- `practice_id`: Practice UUID
- `provider`: OAuth provider (e.g., 'google')
- `client_id`: OAuth client ID
- `client_secret`: Encrypted OAuth client secret

#### 5. `practice_oauth_credentials`
Stores user-specific OAuth tokens after authorization.

**Key Columns:**
- `practice_id`: Practice UUID
- `provider`: OAuth provider
- `access_token`: Current access token
- `refresh_token`: Token for refreshing access
- `token_expires_at`: When access token expires
- `email`: User's email address

## Trigger Flow

### Patient Creation Example

1. **New Patient Created**
   ```sql
   INSERT INTO patients (practice_id, first_name, last_name, email, cell_number)
   VALUES ('ffed1160-...', 'John', 'Doe', 'john@example.com', '+27123456789');
   ```

2. **Trigger Fires: `trigger_queue_welcome_patient`**
   - Located on `patients` table
   - Executes function: `queue_welcome_patient_automation()`
   
3. **Function Logic**
   ```sql
   -- Check if practice has automation enabled
   IF EXISTS (
     SELECT 1 FROM practice_automation_settings
     WHERE practice_id = NEW.practice_id
     AND automation_id = 'welcome-new-patient'
     AND enabled = true
   ) THEN
     -- Queue the automation
     INSERT INTO automation_queue (...)
   ```

4. **Queue Entry Created**
   ```json
   {
     "trigger_type": "patient.created",
     "scheduled_for": "NOW() + 1 hour",
     "payload": {
       "patient_id": "uuid",
       "patientName": "John Doe",
       "patientEmail": "john@example.com",
       "patientPhone": "+27123456789",
       "practiceName": "NewCharm Dental",
       "practicePhone": "+27123456789",
       "practiceEmail": "info@newcharm.com"
     }
   }
   ```

## Processing Pipeline

### n8n Workflow Process (Runs Every Minute)

1. **Fetch Pending Automations**
   - Calls RPC: `get_pending_welcome_automations(batch_size)`
   - Returns up to 100 automations where:
     - `status = 'queued'`
     - `scheduled_for <= NOW()`
     - `attempt_count < max_attempts`

2. **Process Each Automation**
   - Template variable replacement
   - Channel determination (SMS/Email/Both)
   - Send via appropriate gateway

3. **Update Queue Status**
   - Mark as 'completed' on success
   - Mark as 'failed' with error message on failure
   - Increment attempt_count for retries

## Gmail OAuth Integration

### Setup Flow

1. **Practice Admin Adds OAuth Credentials**
   - Enters Client ID and Client Secret in Settings → Social → Gmail
   - Credentials saved to `practice_oauth_apps`

2. **Connect Gmail Account**
   - Click "Connect Gmail Now" button
   - Redirected to Google OAuth consent
   - User authorizes access

3. **Token Exchange**
   - `gmail-oauth-callback` edge function handles callback
   - Exchanges authorization code for tokens
   - Stores in `practice_oauth_credentials`

4. **Token Refresh**
   - Edge function automatically refreshes expired tokens
   - Uses refresh_token to get new access_token
   - Updates `token_expires_at`

### Email Sending Process

1. **Check Gmail Connection**
   ```sql
   SELECT * FROM practice_oauth_credentials
   WHERE practice_id = ? AND provider = 'google'
   ```

2. **If Connected**: Use Gmail API
   - Construct email with Gmail API format
   - Send using OAuth access token

3. **If Not Connected**: Use centralized-email-gateway
   - Falls back to Resend API
   - Still logs in `practice_email_logs`

## SMS/Email Gateways

### Centralized SMS Gateway
**Edge Function**: `centralized-sms-gateway`

**Process**:
1. Validate practice subscription limits
2. Send SMS via SMSPortal API
3. Log to `practice_sms_logs`
4. Update subscription usage

**Logging Fields**:
- `practice_id`, `patient_id`, `recipient_phone`
- `message_content`, `message_type`
- `provider_message_id`, `status`
- `sent_at`, `delivered_at`

### Centralized Email Gateway
**Edge Function**: `centralized-email-gateway`

**Process**:
1. Check if Gmail is connected
2. If yes: Use Gmail API with OAuth
3. If no: Use Resend API
4. Log to `practice_email_logs`
5. Update subscription usage

## n8n Workflow Processing

### Workflow Structure
```json
{
  "name": "HPMS Automation Processor",
  "triggers": [
    {
      "type": "schedule",
      "interval": "1 minute"
    }
  ],
  "nodes": [
    "Fetch Pending Automations",
    "Process in Batches",
    "Template Processing",
    "Send SMS",
    "Send Email",
    "Update Queue Status"
  ]
}
```

### Key Features
1. **Batch Processing**: Handles up to 100 automations per run
2. **Multi-tenant**: One workflow serves all practices
3. **Error Handling**: Retries failed automations
4. **Template Variables**: Dynamic content replacement

## Complete Flow Example

1. **Patient Created** at 10:00 AM
2. **Trigger Fires** → Queue entry created for 11:00 AM
3. **n8n Runs** at 11:01 AM → Fetches queued automation
4. **Template Processing**:
   - SMS: "Welcome to NewCharm Dental, John Doe!"
   - Email: HTML with personalized content
5. **Send Communications**:
   - SMS via SMSPortal
   - Email via Gmail OAuth (if connected)
6. **Update Status**: Queue marked as completed
7. **Logging**: Both SMS and email logged with delivery status

## Available Automation Types

1. **Patient Management**
   - Welcome new patient
   - Birthday wishes
   - Inactive patient re-engagement

2. **Appointment Related**
   - Appointment confirmation
   - Appointment reminder (24h, 1h)
   - No-show follow-up
   - Appointment rescheduled

3. **Visit & Treatment**
   - Post-visit follow-up
   - Treatment plan reminders
   - Medication reminders

4. **Lab & Results**
   - Lab results ready
   - Imaging results ready
   - Referral notifications

5. **Financial**
   - Payment reminders
   - Payment confirmation
   - Insurance claim updates

6. **Health Campaigns**
   - Vaccination reminders
   - Health screening due
   - Chronic condition check-ins

## Security & Compliance

1. **Multi-tenant Isolation**
   - RLS policies ensure data separation
   - Practice-specific queue processing

2. **OAuth Security**
   - Tokens encrypted at rest
   - Automatic token refresh
   - Minimal required scopes

3. **Audit Trail**
   - Complete logging of all communications
   - Delivery tracking and status
   - Error logging for debugging

4. **Subscription Management**
   - Enforced SMS/Email limits
   - Usage tracking per practice
   - Automatic quota enforcement