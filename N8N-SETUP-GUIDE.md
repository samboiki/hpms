# n8n Webhook Setup Guide for AI Patient Search

## Important: Test vs Production URLs

n8n uses DIFFERENT URLs for testing and production!

### During Development:
1. Click "Listen for Test Event" button in the webhook node
2. Use the TEST URL shown (e.g., `https://onehealthsystems.app.n8n.cloud/webhook-test/abc-123`)
3. This URL only works while listening for test events

### For Production:
1. Save and activate your workflow
2. Use the PRODUCTION URL (e.g., `https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search`)
3. This URL works permanently after activation

## Step-by-Step Setup:

### 1. Import the Workflow
- Use `ai-patient-search-fixed.json`
- It includes proper CORS headers and "Respond to Webhook" node

### 2. Configure Webhook Node
- HTTP Method: POST
- Response Mode: "Using 'Respond to Webhook' node" (CRITICAL!)
- Path: onehealth-search

### 3. Testing Phase
```bash
# Update your .env temporarily for testing:
VITE_N8N_WEBHOOK_URL=https://onehealthsystems.app.n8n.cloud/webhook-test/[your-test-id]
```
- Click "Listen for Test Event"
- Test with the AI button
- Check execution results in n8n

### 4. Production Activation
```bash
# Update your .env for production:
VITE_N8N_WEBHOOK_URL=https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search
```
- Save the workflow
- Activate the workflow (toggle the Active switch)
- The production URL is now live

## Workflow Structure:
```
Webhook (POST) 
  ↓
Validate Request
  ↓
Process Search (Database/AI)
  ↓
Respond to Webhook (with CORS headers) ← CRITICAL!
```

## CORS Headers (in Respond to Webhook node):
- Access-Control-Allow-Origin: *
- Access-Control-Allow-Methods: GET, POST, OPTIONS
- Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization
- Access-Control-Max-Age: 86400

## Common Issues:

1. **CORS Error**: Make sure you have "Respond to Webhook" node with headers
2. **404 Error**: Check if workflow is activated and using production URL
3. **No Response**: Ensure Response Mode is set to "Using 'Respond to Webhook' node"
4. **Test URL Not Working**: Click "Listen for Test Event" again (it expires)

## Testing Checklist:
- [ ] Workflow imported
- [ ] Credentials configured (Supabase, OpenAI, xAI)
- [ ] Webhook Response Mode = "Using 'Respond to Webhook' node"
- [ ] "Respond to Webhook" node at the end with CORS headers
- [ ] For testing: Using webhook-test URL with "Listen for Test Event"
- [ ] For production: Workflow activated and using webhook URL