# Deploying Edge Functions for Automation System

## Edge Functions Overview

The automation system uses several edge functions:

1. **gmail-oauth-callback** - Handles OAuth token exchange for Gmail
2. **centralized-sms-gateway** - Sends SMS messages with full logging and tracking
3. **centralized-email-gateway** - Sends emails with full logging and tracking
4. **process-automation-queue** - Processes pending automations from the queue

## Deployment Steps

### 1. Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to Your Project

```bash
cd /home/happy/projects/hpms
supabase link --project-ref jjxlfunlbyayxwvlpgwt
```

### 4. Deploy All Edge Functions

```bash
# Deploy Gmail OAuth callback
supabase functions deploy gmail-oauth-callback

# Deploy SMS gateway
supabase functions deploy centralized-sms-gateway

# Deploy Email gateway
supabase functions deploy centralized-email-gateway

# Deploy automation processor
supabase functions deploy process-automation-queue
```

### 5. Set Environment Variables

In the Supabase Dashboard, go to Edge Functions → Settings and add these secrets:

#### For Gmail OAuth:
```
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

#### For SMS Gateway:
```
SMS_PORTAL_CLIENT_ID=your-smsportal-client-id
SMS_PORTAL_API_SECRET=your-smsportal-api-secret
```

#### For Email Gateway (Resend):
```
RESEND_API_KEY=your-resend-api-key
```

## Testing the Functions

### Test Gmail OAuth Callback

This is triggered automatically when users connect Gmail through the UI.

### Test SMS Gateway

```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-sms-gateway \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "b64632c2-3a56-44cf-a2c9-0e42be03a2d3",
    "recipientPhone": "+27123456789",
    "messageContent": "Test SMS from HPMS",
    "messageType": "general"
  }'
```

### Test Email Gateway

```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/centralized-email-gateway \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "b64632c2-3a56-44cf-a2c9-0e42be03a2d3",
    "recipientEmail": "test@example.com",
    "subject": "Test Email",
    "htmlContent": "<h1>Test Email from HPMS</h1>",
    "emailType": "general"
  }'
```

### Test Automation Processor

```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/process-automation-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 10
  }'
```

## n8n Integration

Instead of deploying the process-automation-queue function, you can use n8n to call it periodically:

1. Create an HTTP Request node in n8n
2. Method: POST
3. URL: `https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/process-automation-queue`
4. Headers:
   - Authorization: `Bearer YOUR_SERVICE_ROLE_KEY`
   - Content-Type: `application/json`
5. Body: `{ "batchSize": 50 }`
6. Schedule: Every 1 minute

## Monitoring

### Check Function Logs

```bash
# View logs for a specific function
supabase functions logs gmail-oauth-callback
supabase functions logs centralized-sms-gateway
supabase functions logs centralized-email-gateway
supabase functions logs process-automation-queue
```

### Monitor in Dashboard

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on each function to see:
   - Invocation count
   - Error rate
   - Response times
   - Logs

## Troubleshooting

### Function Not Found
- Ensure function is deployed: `supabase functions list`
- Check function name matches exactly

### Authentication Errors
- Verify environment variables are set
- Check API keys are valid
- Ensure using correct auth header

### SMS/Email Not Sending
- Check subscription limits in database
- Verify provider credentials
- Look at function logs for specific errors

### OAuth Issues
- Ensure redirect URI matches in Google Console
- Check GOOGLE_CLIENT_ID and SECRET are set
- Verify OAuth consent screen is configured

## Security Notes

1. **Service Role Key** - Only use for server-side operations
2. **Anon Key** - Use for client-side authenticated requests
3. **OAuth Tokens** - Stored encrypted in database
4. **API Keys** - Keep secure, rotate regularly

## Cost Optimization

- Edge Functions are billed per invocation
- Use n8n for scheduled tasks instead of cron-like edge functions
- Batch process automations to reduce invocations
- Monitor usage in Supabase dashboard

## Next Steps

After deploying all functions:

1. Test Gmail OAuth flow in the app
2. Create test patients to trigger automations
3. Monitor logs to ensure everything works
4. Set up n8n workflow to process queue
5. Enable more automation types as needed