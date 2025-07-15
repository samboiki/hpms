# AI Patient Search Workflow - Setup & Configuration Guide

## Overview
This advanced AI-powered patient search workflow uses GPT-4 and Grok-3 to convert natural language queries into secure SQL queries that search across all patient-related tables in your healthcare database.

## Key Improvements Made

### 1. **Fixed Progress Notifications**
- Replaced webhook nodes with proper HTTP Request nodes
- Progress updates now send to a dynamic webhook URL based on session ID
- All progress nodes are properly connected in the workflow
- Progress continues even if the webhook endpoint is unavailable (continueOnFail: true)

### 2. **Enhanced Database Schema Discovery**
- Now uses a recursive CTE to find ALL tables related to patients
- Automatically discovers:
  - Tables that patients reference (through foreign keys)
  - Tables that reference patients
  - All indirect relationships
- Provides comprehensive schema documentation to the AI

### 3. **Proper API Authentication**
- Fixed xAI (Grok-3) authentication using httpHeaderAuth
- Properly configured OpenAI credentials
- Supabase PostgreSQL credentials are correctly referenced

### 4. **Enhanced Security**
- Multiple layers of SQL validation
- Practice ID enforcement at every step
- Prevention of SQL injection attacks
- Dangerous operation detection (DROP, DELETE, UPDATE, etc.)
- Cross-practice data leak prevention

### 5. **Improved AI Instructions**
- AI now searches across multiple related tables
- Better understanding of medical conditions across different tables
- Smarter JOIN strategies (LEFT vs INNER)
- More accurate patient filtering

## Required Credentials Setup

### 1. **Supabase PostgreSQL** (ID: czZG3bwVoyN4WUIu)
```json
{
  "host": "db.jjxlfunlbyayxwvlpgwt.supabase.co",
  "port": 5432,
  "database": "postgres",
  "user": "postgres",
  "password": "YOUR_SUPABASE_DB_PASSWORD",
  "ssl": {
    "rejectUnauthorized": false
  }
}
```

### 2. **OpenAI API** (ID: 2z0Eb5MOJcGiYyQm)
```json
{
  "apiKey": "YOUR_OPENAI_API_KEY"
}
```

### 3. **xAI API** (ID: ugcOBcrDwGMdyQqa)
In n8n, create HTTP Header Auth credentials with:
- **Header Name**: `Authorization`
- **Header Value**: `Bearer YOUR_XAI_API_KEY`

## Webhook Configuration

The workflow expects to be accessible at:
```
POST http://localhost:5678/webhook/ai-patient-search
```

Progress updates are sent to (optional):
```
POST http://localhost:5678/webhook/progress-{sessionId}
```

## How It Works

1. **Request Validation**
   - Validates practice ID format
   - Cleans search query to prevent injection
   - Generates session ID for tracking

2. **Schema Discovery**
   - Queries database for all patient-related tables
   - Builds comprehensive schema documentation
   - Identifies searchable columns and relationships

3. **SQL Generation (GPT-4)**
   - Uses schema to understand database structure
   - Converts natural language to SQL
   - Only returns patient IDs
   - Enforces practice_id filter

4. **Security Verification (Grok-3)**
   - Double-checks SQL for security issues
   - Verifies practice isolation
   - Analyzes performance implications
   - Provides accuracy assessment

5. **Query Execution**
   - Runs verified query with timeout protection
   - Returns only patient IDs
   - No sensitive data exposed

6. **Result Analysis**
   - Provides detailed explanation
   - Suggests improvements
   - Shows performance metrics
   - Lists tables searched

## Example Queries

### Simple Searches
- "women over 50"
- "patients with diabetes"
- "active patients"
- "patients who visited last month"

### Complex Searches
- "diabetic women over 50 who haven't visited in 6 months"
- "patients with hypertension on beta blockers"
- "children with allergies who had lab tests this year"
- "patients with chronic conditions needing follow-up"

### Multi-Table Searches
- "patients with abnormal lab results" (searches lab_requests table)
- "patients who missed appointments" (searches appointments table)
- "patients on multiple medications" (searches prescriptions table)
- "patients with unpaid invoices" (searches invoices_enhanced table)

## Frontend Integration

Your React hook (`useAiSearchN8nAdvanced`) expects these response formats:

### Success Response
```json
{
  "success": true,
  "patientIds": ["uuid1", "uuid2", ...],
  "count": 42,
  "description": "Women over 50 with diabetes",
  "detailedAnalysis": "Found 42 patients...",
  "confidence": 0.95,
  "securityScore": 1.0,
  "performanceScore": 0.85,
  "accuracyScore": 0.9,
  "suggestions": ["Consider adding..."],
  "tablesSearched": ["patients", "visits", "medical_records"],
  "timestamp": "2025-01-13T...",
  "requestId": "session-uuid",
  "executionTime": 1234
}
```

### Error Response
```json
{
  "success": false,
  "error": "Security check failed...",
  "errorType": "security",
  "suggestions": ["Try a simpler search"],
  "issues": ["Missing practice_id filter"],
  "requestId": "session-uuid",
  "timestamp": "2025-01-13T..."
}
```

### Progress Updates (via WebSocket)
```json
{
  "type": "progress",
  "data": {
    "status": "fetching_schema|generating_sql|verifying_security|executing_query|completed|error",
    "message": "Analyzing database structure...",
    "progress": 20
  }
}
```

## Testing the Workflow

1. **Import the Workflow**
   - Copy the JSON from `ai-patient-search-advanced.json`
   - Import into n8n
   - Set up the three credentials

2. **Test with cURL**
```bash
curl -X POST http://localhost:5678/webhook/ai-patient-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "women over 50 with diabetes",
    "practiceId": "YOUR-PRACTICE-UUID",
    "sessionId": "test-session-123"
  }'
```

3. **Monitor Progress**
   - Check n8n execution logs
   - Progress updates will attempt to send to the progress webhook
   - Final result returned in response

## Troubleshooting

### "Invalid practice ID"
- Ensure practice ID is a valid UUID format
- Check that the practice exists in your database

### "No patients found"
- Verify the search terms
- Check if patients exist with those criteria
- Look at the `suggestions` in the response

### "Security check failed"
- The query might be too complex
- Avoid special characters
- Ensure you're not trying to access unauthorized data

### Timeout Errors
- Complex queries might take longer
- Consider simplifying the search
- Check database indexes for performance

## Performance Optimization

1. **Add Indexes**
   - On frequently searched columns (diagnosis, chronic_conditions)
   - On foreign key columns
   - On date columns used for filtering

2. **Query Optimization**
   - The AI suggests performance improvements
   - Monitor the `performanceScore` in responses
   - Consider the `estimated_result_size`

## Security Best Practices

1. **Never expose this webhook publicly** without authentication
2. **Always validate practice_id** on the frontend before sending
3. **Monitor usage** for unusual patterns
4. **Regularly review** the queries being generated
5. **Set up rate limiting** in production

## Next Steps

1. Set up proper webhook authentication
2. Implement WebSocket server for real-time progress
3. Add query result caching
4. Set up monitoring and alerting
5. Create audit logs for all searches

## Support

For issues or questions:
1. Check n8n execution logs
2. Verify all credentials are correct
3. Ensure database connectivity
4. Check the workflow connections in n8n UI