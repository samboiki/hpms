# n8n Workflow Setup Guide for OneHealth

## Quick Start

Use the **onehealth-automation-processor-v2.json** file - it's a simplified, working version.

## Workflow Overview

The workflow consists of these connected nodes:

1. **Every Minute** (Schedule Trigger)
   - Runs the workflow every minute
   - Connects to → Get Pending Automations

2. **Get Pending Automations** (HTTP Request)
   - Fetches pending automations from Supabase
   - Uses Supabase API credentials
   - Connects to → Check If Any

3. **Check If Any** (IF Node)
   - Checks if there are automations to process
   - True path → Prepare Messages
   - False path → No Items

4. **Prepare Messages** (Set Node)
   - Prepares SMS and email content
   - Applies template variables
   - Connects to → Send Gmail AND Send SMS (parallel)

5. **Send Gmail** (Gmail Node)
   - Sends email via Gmail OAuth
   - Uses practice's Gmail credentials
   - Connects to → Mark Complete

6. **Send SMS** (HTTP Request)
   - Sends SMS via centralized gateway
   - Uses Supabase service key
   - Connects to → Mark Complete

7. **Mark Complete** (HTTP Request)
   - Updates automation queue status
   - Marks item as completed

## Required Credentials

### 1. Supabase API
```json
{
  "host": "https://jjxlfunlbyayxwvlpgwt.supabase.co",
  "apiKey": "your-anon-key"
}
```

### 2. Gmail OAuth2
- Create in n8n UI
- Use existing Google OAuth app
- Authorize with practice Gmail account

### 3. Supabase Service Key (HTTP Header Auth)
```json
{
  "name": "Authorization",
  "value": "Bearer your-service-role-key"
}
```

## Import Steps

1. **Copy the JSON** from `onehealth-automation-processor-v2.json`
2. **In n8n**, click anywhere on canvas and paste (Ctrl+V)
3. **Configure credentials** for each node
4. **Test** with manual execution
5. **Activate** when ready

## Common Issues

### "Credential not found"
- Click on the node
- Select or create the required credential
- Save the workflow

### "Invalid JSON"
- Check that all template variables are properly escaped
- Use the expression editor for complex values

### "Connection refused"
- Verify Supabase URL is correct
- Check API keys are valid

## Testing

1. Create a test patient in NewCharm
2. Manually execute the workflow
3. Check the execution log
4. Verify email/SMS delivery

## Expanding the Workflow

To add more automation types:
1. Modify the RPC call to fetch all automation types
2. Add conditional logic based on automation_id
3. Create specific message templates for each type
4. Test thoroughly before activating

This simplified workflow is much easier to maintain and debug!