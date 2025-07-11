# Multi-Practice Gmail Setup Guide

## Overview

This guide explains how to set up Gmail for multiple practices in the OneHealth automation system.

## Current Architecture

### 1. Gmail Credentials in n8n
Each practice connects their Gmail account in n8n:
- NewCharm: `admin@newcharmdentalpractice.com` (ID: 7cZTuNlEe2mn9xhn)
- Practice B: `info@practiceb.com` (ID: abc123...)
- Practice C: `noreply@practicec.com` (ID: xyz789...)

### 2. Credential Mapping in Database
Store the n8n credential ID in `practice_oauth_credentials`:
```sql
-- Example for NewCharm
UPDATE practice_oauth_credentials
SET n8n_credential_id = '7cZTuNlEe2mn9xhn'
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  AND provider = 'google';
```

### 3. Dynamic Selection in Workflow
The workflow uses the credential ID from the database to select the right Gmail account.

## Setup Process for New Practice

### Step 1: Practice Admin Actions
1. Go to Settings → Social → Gmail
2. Add Google OAuth credentials (Client ID & Secret)
3. Save configuration

### Step 2: n8n Configuration
1. In n8n, go to Credentials
2. Add new Gmail OAuth2 credential
3. Name it: "[Practice Name] Gmail"
4. Connect and authorize with practice's Gmail
5. Note the credential ID

### Step 3: Database Update
```sql
-- Insert or update credential mapping
INSERT INTO practice_oauth_credentials (
  practice_id,
  provider,
  email,
  n8n_credential_id,
  connected_at,
  metadata
) VALUES (
  'practice-uuid-here',
  'google',
  'practice@example.com',
  'n8n-credential-id-here',
  NOW(),
  '{"source": "n8n_oauth"}'
)
ON CONFLICT (practice_id, provider) 
DO UPDATE SET 
  n8n_credential_id = EXCLUDED.n8n_credential_id,
  email = EXCLUDED.email,
  updated_at = NOW();
```

## Enhanced Workflow for Multiple Practices

### Option 1: Single Workflow, Dynamic Credentials
```javascript
// In Code node, map practice to credential
const practiceCredentials = {
  'ffed1160-00ec-4c4f-8810-913a24348d90': '7cZTuNlEe2mn9xhn', // NewCharm
  'practice-b-uuid': 'credential-b-id',
  'practice-c-uuid': 'credential-c-id'
};

const credentialId = practiceCredentials[$json.practice_id] || 'default-id';
```

### Option 2: Credential from Database (Recommended)
The current workflow already supports this - it uses `n8n_credential_id` from the database.

## Testing Multi-Practice Setup

### 1. Create Test Automations for Different Practices
```sql
-- Test for Practice A
INSERT INTO automation_queue (practice_id, trigger_type, payload, scheduled_for, status)
VALUES ('practice-a-uuid', 'patient.created', '{"patientName": "Test A", "patientEmail": "test@example.com"}', NOW(), 'queued');

-- Test for Practice B  
INSERT INTO automation_queue (practice_id, trigger_type, payload, scheduled_for, status)
VALUES ('practice-b-uuid', 'patient.created', '{"patientName": "Test B", "patientEmail": "test@example.com"}', NOW(), 'queued');
```

### 2. Verify Correct Gmail Used
Check email headers to confirm emails sent from correct practice Gmail account.

## Security Considerations

### 1. Credential Isolation
- Each practice can only use their own Gmail
- n8n handles OAuth securely
- No access to other practices' credentials

### 2. Audit Trail
```sql
-- Track which practice sent which email
SELECT 
  pel.practice_id,
  p.name as practice_name,
  pel.recipient_email,
  pel.sent_at,
  pel.provider,
  pel.metadata->>'gmail_account' as sent_from
FROM practice_email_logs pel
JOIN practices p ON p.id = pel.practice_id
WHERE pel.provider = 'gmail'
ORDER BY pel.sent_at DESC;
```

## Scaling Considerations

### For 10-50 Practices
- Current approach works well
- Manual credential setup acceptable
- Single workflow handles all

### For 50+ Practices
Consider:
- Automated credential provisioning
- Multiple workflow instances
- Load balancing by practice size

## Troubleshooting

### "Invalid credential ID"
- Verify n8n_credential_id in database
- Check credential exists in n8n
- Ensure credential is for Gmail OAuth2

### "Wrong email sender"
- Check practice_id in automation_queue
- Verify credential mapping
- Test credential in n8n directly

### "Token expired"
- n8n should auto-refresh
- If not, reconnect in n8n
- Check refresh token validity

## Best Practices

1. **Naming Convention**: "[Practice Name] Gmail" for credentials
2. **Documentation**: Keep spreadsheet of practice → credential mappings
3. **Testing**: Test each new practice setup immediately
4. **Monitoring**: Regular checks on email delivery rates
5. **Backup**: Have fallback to Resend if Gmail fails

This architecture supports unlimited practices with their own Gmail accounts!