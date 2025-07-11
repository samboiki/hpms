# Simplified Gmail Setup Using n8n

## Why Use n8n for Gmail?

Instead of complex service account setup, n8n provides built-in Gmail authentication that:
- ✅ Handles OAuth automatically
- ✅ Manages token refresh for you
- ✅ No manual JSON key management
- ✅ Visual interface for configuration
- ✅ Test directly in n8n

## Setup Steps

### 1. Configure Gmail in n8n

1. **Open n8n** and go to your workflow
2. **Add Gmail Node** to your workflow
3. **Click on Credentials** → "Create New"
4. **Select "Gmail OAuth2"**
5. **n8n will provide**:
   - OAuth Redirect URL (copy this)
   - Instructions for Google Cloud setup

### 2. Quick Google Cloud Setup

Since you already have:
- Service account created: `hpms-email-service@central-rush-465202-g9.iam.gserviceaccount.com`
- Client ID: `108876554304515556743`

You now need to:

1. **Create OAuth 2.0 Credentials** (not service account):
   ```
   Google Cloud Console → APIs & Services → Credentials
   → Create Credentials → OAuth client ID
   → Application type: Web application
   → Name: n8n Gmail Integration
   → Authorized redirect URIs: [paste from n8n]
   → Create
   ```

2. **Copy Client ID and Client Secret**

3. **Back in n8n**:
   - Paste Client ID
   - Paste Client Secret
   - Click "Connect My Account"
   - Authorize access

### 3. Update Your Workflow

Instead of calling edge functions, update the email sending nodes:

```json
{
  "name": "Send Email via Gmail",
  "type": "n8n-nodes-gmail.gmail",
  "typeVersion": 2,
  "position": [1440, 380],
  "credentials": {
    "gmailOAuth2": {
      "id": "1",
      "name": "Gmail account"
    }
  },
  "parameters": {
    "operation": "send",
    "to": "={{ $json.payload.patientEmail }}",
    "subject": "={{ $json.email_subject }}",
    "message": "={{ $json.email_body }}",
    "options": {
      "attachments": [],
      "ccList": "",
      "bccList": "",
      "replyTo": "={{ $json.practice_email }}"
    }
  }
}
```

### 4. Benefits of n8n Approach

1. **Automatic Token Management**
   - n8n handles refresh tokens
   - No manual token refresh needed
   - No expiration issues

2. **Per-Practice Credentials**
   - Each practice can connect their own Gmail
   - Store credential ID in database
   - Select appropriate credential per practice

3. **Built-in Error Handling**
   - n8n shows clear error messages
   - Easy debugging in UI
   - Retry logic built-in

4. **Direct Testing**
   - Test emails directly in n8n
   - See results immediately
   - No edge function complexity

## Updated Architecture

### Database Changes

```sql
-- Simpler approach - just store n8n credential reference
ALTER TABLE practice_automation_settings 
ADD COLUMN n8n_gmail_credential_id TEXT,
ADD COLUMN n8n_gmail_email TEXT;
```

### Workflow Logic

```javascript
// In n8n Function node before sending
const practiceSettings = $json;

// Determine which credential to use
const credentialId = practiceSettings.n8n_gmail_credential_id || 'default';

// Pass to Gmail node
return {
  ...items[0].json,
  credentialId: credentialId,
  fromEmail: practiceSettings.n8n_gmail_email
};
```

## Migration Path

### For NewCharm Practice

1. **In n8n**:
   - Create Gmail OAuth2 credential
   - Name it "NewCharm Gmail"
   - Connect and authorize

2. **In Database**:
   ```sql
   UPDATE practice_automation_settings
   SET n8n_gmail_credential_id = 'newcharm-gmail-id',
       n8n_gmail_email = 'info@newcharmdental.com'
   WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90';
   ```

3. **Test**:
   - Create test patient
   - Watch n8n execution
   - Verify email delivery

## Comparison

### Service Account Approach
- ❌ Complex setup in Google Cloud
- ❌ Domain-wide delegation configuration
- ❌ Manual key management
- ❌ Custom edge functions
- ❌ Token handling code

### n8n OAuth Approach
- ✅ Simple OAuth flow
- ✅ Visual configuration
- ✅ Automatic token refresh
- ✅ Built-in error handling
- ✅ Direct testing in n8n

## Security Benefits

1. **No Private Keys** - OAuth tokens only
2. **Scoped Access** - Only email permissions
3. **Easy Revocation** - Through Google account
4. **Audit Trail** - n8n execution logs

## Quick Start for Practices

1. **Admin provides**:
   - Google account for sending
   - Access to authorize OAuth

2. **You configure**:
   - n8n credential
   - Database reference
   - Test and verify

3. **Practice gets**:
   - Reliable email delivery
   - No maintenance needed
   - Full automation benefits

This approach leverages n8n's built-in capabilities, making it much simpler and more maintainable than managing service accounts!