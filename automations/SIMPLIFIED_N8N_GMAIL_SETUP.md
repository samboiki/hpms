# Ultra-Simplified n8n Gmail Setup

## What We're Doing

Using n8n's built-in Gmail integration to send emails. No complex service accounts, no domain delegation - just simple OAuth that n8n manages for you.

## Database Setup

We're storing the n8n credential ID in the existing `practice_oauth_credentials` table:

```sql
-- Add n8n credential ID column if not exists
ALTER TABLE practice_oauth_credentials 
ADD COLUMN IF NOT EXISTS n8n_credential_id TEXT;
```

## Frontend Changes

The OAuth form now has an optional field for n8n Credential ID. When you save Google OAuth credentials, you can also specify the n8n credential ID to use.

## n8n Workflow Setup

### 1. Import the New Workflow

Import `/automations/n8n-workflows/onehealth-automation-processor.json` into n8n.

### 2. Configure Gmail Credential in n8n

1. In the Gmail node, click on **Credentials**
2. Click **Create New**
3. Follow the OAuth flow (uses your existing Google OAuth app)
4. Note the credential ID (usually "1" for first credential)

### 3. Update Database

For NewCharm practice:

```sql
-- Update the OAuth credentials with n8n credential ID
UPDATE practice_oauth_credentials
SET n8n_credential_id = '1'
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
  AND provider = 'google';
```

## How It Works

1. **Workflow triggers** every minute
2. **Fetches pending automations** from queue
3. **Gets n8n credential ID** from practice_oauth_credentials
4. **Sends email via Gmail** using n8n's OAuth
5. **Falls back to Resend** if Gmail fails
6. **Updates queue status**

## Benefits

- ✅ No service account complexity
- ✅ n8n handles token refresh automatically
- ✅ Works with any Gmail account
- ✅ Visual debugging in n8n
- ✅ Fallback to Resend if needed

## Testing

1. Create a test patient in NewCharm
2. Watch n8n workflow execute
3. Check email delivery
4. View logs in practice_email_logs

## Multiple Practices

Each practice can:
1. Add their Gmail OAuth in Settings
2. Create Gmail credential in n8n
3. Store credential ID in database
4. Emails sent with their Gmail

## That's It!

Much simpler than service accounts. The workflow handles everything else automatically.