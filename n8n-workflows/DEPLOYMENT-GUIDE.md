# n8n Workflow Deployment Guide

## Workflow File
Use only: `ai-patient-search-advanced.json`

## Key Changes Made:
1. **Webhook Configuration**:
   - Changed `responseMode` from `"lastNode"` to `"responseNode"`
   - Removed separate OPTIONS webhook (n8n doesn't support it)
   - Set HTTP Method to POST only

2. **Response Nodes Updated**:
   - Added CORS headers to both "Send Success Response" and "Send Error Response" nodes
   - Using `respondWith: "json"` for proper JSON responses
   - All CORS headers included in response

## Deployment Steps:

### 1. Import Workflow
- Import `ai-patient-search-advanced.json` into n8n cloud
- Configure the three credentials:
  - Supabase PostgreSQL (ID: czZG3bwVoyN4WUIu)
  - OpenAI API (ID: 2z0Eb5MOJcGiYyQm)
  - xAI API (ID: ugcOBcrDwGMdyQqa)

### 2. Testing Phase
- Click "Listen for Test Event" on the webhook node
- Copy the test URL (format: `https://onehealthsystems.app.n8n.cloud/webhook-test/[id]`)
- Update `.env` temporarily:
  ```
  VITE_N8N_WEBHOOK_URL=https://onehealthsystems.app.n8n.cloud/webhook-test/[your-test-id]
  ```
- Test with the AI button on patient page

### 3. Production Activation
- Save the workflow
- Activate the workflow (toggle Active switch)
- Update `.env` for production:
  ```
  VITE_N8N_WEBHOOK_URL=https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search
  ```

## Critical Configuration:
- Webhook Response Mode: **"Using 'Respond to Webhook' node"**
- Both success and error paths end with "Respond to Webhook" nodes
- All CORS headers are in the response nodes (not webhook settings)

## Workflow Features:
1. **AI-Powered Search**: Uses GPT-4 to understand natural language queries
2. **Security Verification**: Grok-3 validates all queries for security
3. **Dynamic Schema Discovery**: Automatically finds all patient-related tables
4. **Progress Updates**: Real-time progress notifications (if supported)
5. **Comprehensive Results**: Detailed analysis and suggestions

## Troubleshooting:
- **CORS Error**: Ensure workflow is activated and using correct URL
- **404 Error**: Check if using test URL vs production URL
- **No Response**: Verify "Respond to Webhook" nodes are properly connected