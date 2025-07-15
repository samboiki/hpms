# n8n AI Patient Search Workflow

This directory contains the n8n workflow for AI-powered patient search using natural language queries.

## Features

- **Dual AI Agent Verification**: Uses two AI agents for generating and verifying SQL queries
- **Natural Language Processing**: Convert queries like "women over 50 with diabetes" into SQL
- **Security First**: SQL verification prevents injection attacks
- **Practice Isolation**: Ensures queries are filtered by practice ID
- **Smart Schema Loading**: Dynamically loads database schema for accurate queries

## Setup Instructions

### 1. Import Workflow

1. Open your n8n instance
2. Click "Import from File" in the workflows menu
3. Select `ai-patient-search-workflow.json`
4. Save the workflow

### 2. Configure Credentials

You'll need to set up these credentials in n8n:

#### PostgreSQL (Supabase)
- **Host**: Your Supabase database host (e.g., `db.abcdef.supabase.co`)
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: Your database password
- **Port**: `5432`
- **SSL**: Enable SSL

#### OpenAI API
- **API Key**: Your OpenAI API key
- **Organization ID**: Optional

### 3. Update Workflow Settings

After importing, update these nodes:

1. **Get Patient Schema** node:
   - Replace `YOUR_POSTGRES_CRED_ID` with your PostgreSQL credential ID

2. **SQL Generator Model** & **SQL Verifier Model** nodes:
   - Replace `YOUR_OPENAI_CRED_ID` with your OpenAI credential ID

### 4. Activate Webhook

1. Open the workflow
2. Click on the "AI Search Webhook" node
3. Copy the webhook URL (it will look like: `https://your-n8n.com/webhook/ai-patient-search`)
4. Activate the workflow

### 5. Configure Frontend

Update your `.env` file:

```env
VITE_N8N_WEBHOOK_URL=https://your-n8n.com/webhook/ai-patient-search
VITE_N8N_API_KEY=your_optional_api_key
```

## How It Works

1. **User Query**: User types natural language query (e.g., "patients with hypertension who visited last month")

2. **Query Processing**:
   - Clean and normalize the query
   - Extract medical context (age, gender, conditions, etc.)

3. **Schema Loading**:
   - Dynamically fetch database schema
   - Include only relevant healthcare tables

4. **SQL Generation**:
   - First AI agent generates SQL query
   - Returns only patient IDs for security

5. **SQL Verification**:
   - Second AI agent verifies SQL safety
   - Checks for injection attempts
   - Ensures practice isolation

6. **Query Execution**:
   - Execute verified SQL
   - Return patient IDs

7. **Frontend Filtering**:
   - Frontend receives patient IDs
   - Filters local patient list
   - Shows description of search

## Example Queries

- "women over 50"
- "patients with diabetes"
- "male patients with medical aid"
- "patients who visited last month"
- "elderly patients with hypertension"
- "patients without medical aid"

## Security Features

- No direct SQL execution from user input
- Double verification of generated SQL
- Practice ID isolation enforced
- Only SELECT queries allowed
- Returns only patient IDs (no sensitive data)

## Troubleshooting

### CORS Errors
If you get CORS errors:
1. Check webhook settings in n8n
2. Ensure CORS headers are enabled
3. Verify the webhook URL matches your configuration

### SQL Generation Errors
If SQL generation fails:
1. Check OpenAI API key is valid
2. Verify database schema is accessible
3. Check n8n execution logs for details

### Performance Issues
For better performance:
1. Increase timeout in PostgreSQL nodes
2. Use GPT-4o-mini for faster responses
3. Cache schema locally if possible

## Monitoring

Monitor your workflow performance:
1. Check n8n execution history
2. Monitor OpenAI API usage
3. Track query success rates
4. Review error logs regularly