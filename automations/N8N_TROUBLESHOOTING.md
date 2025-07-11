# n8n Troubleshooting Guide

## Common Issues and Solutions

### 1. "Unrecognized node type: n8n-nodes-gmail.gmail"

**Problem**: The Gmail node is not installed in your n8n instance.

**Solutions**:

#### Option A: Install Gmail Node
```bash
# In your n8n installation directory
npm install n8n-nodes-gmail

# Or if using Docker, add to your docker-compose.yml:
environment:
  - N8N_CUSTOM_EXTENSIONS=n8n-nodes-gmail
```

#### Option B: Use HTTP Version (Recommended)
Use `onehealth-enterprise-automation-v2.json` which uses HTTP requests instead of Gmail node. This version:
- Works with any n8n installation
- Uses centralized-email-gateway for all emails
- No additional nodes required

### 2. "Invalid credentials"

**Problem**: Credentials not properly configured.

**Solution**:
1. Create these credentials in n8n:
   - **Supabase API**: Header Auth with `apikey` header
   - **Supabase Service Key**: Header Auth with `Authorization` header (Bearer token)

2. Update credential IDs in workflow:
   - Replace `{{SUPABASE_API_CRED_ID}}` with actual ID
   - Replace `{{SUPABASE_SERVICE_KEY_ID}}` with actual ID

### 3. "Execution timeout"

**Problem**: Too many items processing at once.

**Solution**:
- Reduce batch size from 100 to 50
- Decrease batch processing from 10 to 5
- Increase timeout in workflow settings

### 4. "functionCode is not a valid property"

**Problem**: Using old n8n version.

**Solution**:
- Update n8n to latest version
- Or change `functionCode` to `jsCode` in Code nodes

### 5. "Cannot read property 'length' of undefined"

**Problem**: RPC function returning unexpected format.

**Solution**:
Check the function returns an array:
```sql
-- Test the function
SELECT * FROM get_all_pending_automations(batch_size := 5);
```

### 6. Gmail vs HTTP Gateway Decision

**When to use Gmail node**:
- You want to send from practice's actual Gmail
- You have n8n-nodes-gmail installed
- You need Gmail-specific features

**When to use HTTP Gateway** (Recommended):
- Simpler setup
- Works everywhere
- Centralized logging
- No additional dependencies

## Quick Fixes

### Fix 1: Simplest Working Version
```json
{
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{"field": "minutes", "minutesInterval": 5}]
        }
      }
    },
    {
      "name": "Get Automations",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300],
      "parameters": {
        "method": "POST",
        "url": "https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/get_all_pending_automations",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "supabaseApi",
        "sendBody": true,
        "jsonBody": "{\"batch_size\": 10}"
      }
    }
  ],
  "connections": {
    "Schedule": {
      "main": [[{"node": "Get Automations", "type": "main", "index": 0}]]
    }
  }
}
```

### Fix 2: Test Individual Components

**Test SMS Gateway**:
```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-sms-gateway \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "ffed1160-00ec-4c4f-8810-913a24348d90",
    "recipientPhone": "+27123456789",
    "messageContent": "Test SMS",
    "messageType": "test"
  }'
```

**Test Email Gateway**:
```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-email-gateway \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "ffed1160-00ec-4c4f-8810-913a24348d90",
    "recipientEmail": "test@example.com",
    "subject": "Test Email",
    "htmlContent": "<p>Test</p>",
    "emailType": "test"
  }'
```

## Recommended Approach

1. Use `onehealth-enterprise-automation-v2.json` (HTTP version)
2. Start with small batch sizes (10 items)
3. Test with manual execution first
4. Monitor execution logs
5. Scale up gradually

The HTTP version is more reliable and doesn't require special nodes!