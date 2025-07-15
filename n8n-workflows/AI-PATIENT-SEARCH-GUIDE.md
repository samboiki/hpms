# AI Patient Search Workflow - Comprehensive Guide

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   n8n Webhook    │────▶│  Query Cleaner  │
│   (React App)   │     │   Entry Point    │     │     Agent       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Patient Filter  │◀────│  SQL Verifier    │◀────│  SQL Generator  │
│   & Response    │     │   Agent (xAI)    │     │  Agent (OpenAI) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## 🔐 Credential Configuration

### 1. Supabase PostgreSQL
```json
{
  "id": "czZG3bwVoyN4WUIu",
  "name": "Supabase PostgreSQL",
  "type": "postgres",
  "data": {
    "host": "db.YOUR_PROJECT.supabase.co",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "YOUR_DATABASE_PASSWORD",
    "ssl": true,
    "sslmode": "require"
  }
}
```

### 2. OpenAI (SQL Generator)
```json
{
  "id": "2z0Eb5MOJcGiYyQm",
  "name": "OpenAI API",
  "type": "openAiApi",
  "data": {
    "apiKey": "YOUR_OPENAI_API_KEY"
  }
}
```

### 3. xAI (SQL Verifier)
```json
{
  "id": "ugcOBcrDwGMdyQqa",
  "name": "xAI API",
  "type": "httpRequestApi",
  "data": {
    "baseURL": "https://api.x.ai/v1",
    "headers": {
      "Authorization": "Bearer YOUR_XAI_API_KEY",
      "Content-Type": "application/json"
    }
  }
}
```

## 📋 Workflow Segments

### Segment 1: Request Processing & Validation
**Purpose**: Clean and validate incoming requests

```javascript
// Node: Query Preprocessor
const query = $input.item.json.query || '';
const practiceId = $input.item.json.practiceId || '';

// Security check - validate practice ID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!practiceId || !uuidRegex.test(practiceId)) {
  throw new Error('Invalid or missing practice ID');
}

// Query sanitization
const cleanQuery = query
  .replace(/[;'"\\]/g, '') // Remove potential SQL injection characters
  .toLowerCase()
  .trim();

// Medical context extraction
const medicalContext = {
  hasAge: /\b(\d+)\s*(year|yr)s?\s*(old)?\b/i.test(query),
  hasGender: /\b(male|female|men|women)\b/i.test(query),
  hasMedicalAid: /\b(medical aid|insurance|coverage)\b/i.test(query),
  hasCondition: /\b(diabetes|hypertension|asthma|covid)\b/i.test(query),
  hasTimeframe: /\b(last|recent|today|yesterday|month|week)\b/i.test(query)
};
```

### Segment 2: Schema Discovery
**Purpose**: Get relevant database schema for AI context

```sql
-- Node: Get Patient Schema
WITH relevant_tables AS (
  SELECT unnest(ARRAY[
    'patients', 'visits', 'medical_aid_details',
    'medical_records', 'appointments', 'branches'
  ]) as table_name
)
SELECT 
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  CASE 
    WHEN c.column_name LIKE '%_id' THEN 'FOREIGN_KEY'
    WHEN c.column_name = 'id' THEN 'PRIMARY_KEY'
    ELSE 'DATA'
  END as column_type
FROM information_schema.columns c
INNER JOIN relevant_tables rt ON c.table_name = rt.table_name
WHERE c.table_schema = 'public'
ORDER BY 
  CASE c.table_name
    WHEN 'patients' THEN 1
    WHEN 'visits' THEN 2
    WHEN 'medical_aid_details' THEN 3
    ELSE 4
  END,
  c.ordinal_position;
```

### Segment 3: SQL Generation (OpenAI)
**Purpose**: Convert natural language to SQL using GPT-4

```javascript
// Node: SQL Generator Agent Configuration
const systemPrompt = `You are a PostgreSQL expert for a healthcare system. Generate SECURE SQL queries.

SECURITY RULES:
1. ONLY SELECT queries allowed
2. MUST return ONLY: SELECT DISTINCT patients.id FROM patients
3. MUST include: WHERE patients.practice_id = '${practiceId}'
4. NO subqueries in SELECT clause
5. Use parameterized values where possible

QUERY PATTERNS:
- Age: EXTRACT(YEAR FROM AGE(patients.date_of_birth))
- Gender: patients.gender = 'male' (lowercase)
- Medical Aid: EXISTS check on medical_aid_details
- Recent visits: visits.created_at >= CURRENT_DATE - INTERVAL '30 days'

RESPONSE FORMAT (JSON):
{
  "sql": "SELECT DISTINCT patients.id FROM patients WHERE ...",
  "description": "Natural language description",
  "confidence": 0.0-1.0,
  "parameters": {
    "practice_id": "${practiceId}"
  }
}`;

// Using OpenAI
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: cleanQuery }
  ],
  temperature: 0.1,
  response_format: { type: "json_object" }
});
```

### Segment 4: SQL Verification (xAI)
**Purpose**: Verify SQL safety using Grok-4

```javascript
// Node: SQL Verifier with xAI
const verificationPrompt = `You are a SQL security expert. Verify this query is SAFE.

REJECT if query contains:
- ANY write operations (INSERT, UPDATE, DELETE, DROP)
- Missing practice_id filter
- Subqueries that could leak data
- UNION operations
- System table access
- Sensitive column selection (passwords, tokens)

VERIFY:
1. Returns ONLY patient IDs
2. Filtered by practice_id
3. No SQL injection patterns
4. Proper JOIN usage

Input: ${JSON.stringify(sqlGeneratorOutput)}

Return JSON:
{
  "verified": boolean,
  "risk_level": "low|medium|high|critical",
  "issues": ["list of security issues"],
  "corrected_sql": "fixed SQL if needed"
}`;

// Using xAI Grok-4
const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${xaiApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "grok-4",
    messages: [
      { role: "system", content: verificationPrompt },
      { role: "user", content: JSON.stringify(sqlGeneratorOutput) }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  })
});
```

### Segment 5: Protected SQL Execution
**Purpose**: Execute verified SQL with additional protections

```javascript
// Node: Execute Patient Search
// Additional runtime protections
const finalSql = verifiedSql;

// Timeout protection
const queryOptions = {
  query: finalSql,
  timeout: 5000, // 5 second max
  statement_timeout: 5000
};

// Row limit protection
const protectedSql = `
  WITH limited_results AS (
    ${finalSql}
    LIMIT 1000
  )
  SELECT * FROM limited_results;
`;

try {
  const results = await supabase.rpc('execute_readonly_query', {
    query_text: protectedSql,
    query_timeout: 5000
  });
  
  return results;
} catch (error) {
  // Log for security monitoring
  await supabase.from('security_logs').insert({
    event_type: 'sql_execution_failed',
    practice_id: practiceId,
    error_message: error.message,
    query_hash: crypto.createHash('sha256').update(finalSql).digest('hex')
  });
  
  throw error;
}
```

## 🛡️ Security Protections

### 1. Input Validation
- UUID validation for practice_id
- Query length limits (max 500 chars)
- Character sanitization
- Rate limiting per practice

### 2. SQL Generation Protection
- Whitelist of allowed tables
- No system table access
- Parameterized practice_id
- Read-only operations only

### 3. Verification Layer
- Independent AI verification
- Pattern matching for dangerous SQL
- Risk scoring system
- Audit logging

### 4. Execution Protection
- Query timeout (5 seconds)
- Row limit (1000 max)
- Read-only database user
- Connection pooling limits

## 📊 Monitoring & Logging

### Create Monitoring Tables
```sql
-- Query audit log
CREATE TABLE ai_search_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  generated_sql TEXT,
  verification_result JSONB,
  execution_time_ms INTEGER,
  result_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security events
CREATE TABLE ai_search_security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  practice_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_search_audit_practice ON ai_search_audit(practice_id, created_at DESC);
CREATE INDEX idx_security_events_risk ON ai_search_security_events(risk_level, created_at DESC);
```

## 🚀 Deployment Checklist

### Prerequisites
- [ ] n8n instance running (self-hosted or cloud)
- [ ] Supabase project with patient data
- [ ] OpenAI API key with GPT-4 access
- [ ] xAI API key with Grok-4 access

### Setup Steps
1. **Import Workflow**
   ```bash
   # Import the workflow JSON
   n8n import:workflow ai-patient-search-workflow.json
   ```

2. **Configure Credentials**
   - Add Supabase PostgreSQL (ID: czZG3bwVoyN4WUIu)
   - Add OpenAI API (ID: 2z0Eb5MOJcGiYyQm)
   - Add xAI API (ID: ugcOBcrDwGMdyQqa)

3. **Update Node References**
   - Replace credential placeholders with your IDs
   - Update webhook path if needed

4. **Test Workflow**
   ```bash
   # Test with safe query
   curl -X POST https://your-n8n/webhook/ai-patient-search \
     -H "Content-Type: application/json" \
     -d '{
       "query": "female patients over 50",
       "practiceId": "your-practice-uuid"
     }'
   ```

5. **Monitor Performance**
   - Check n8n execution logs
   - Review security events table
   - Monitor API usage (OpenAI & xAI)

## 🎯 Example Queries & Expected SQL

### Simple Demographics
**Query**: "women over 50"
```sql
SELECT DISTINCT patients.id 
FROM patients 
WHERE patients.gender = 'female' 
AND EXTRACT(YEAR FROM AGE(patients.date_of_birth)) > 50 
AND patients.practice_id = 'PRACTICE_ID';
```

### Medical Conditions
**Query**: "patients with diabetes who visited recently"
```sql
SELECT DISTINCT patients.id 
FROM patients 
INNER JOIN visits ON visits.patient_id = patients.id 
WHERE (visits.diagnosis ILIKE '%diabetes%' OR visits.chief_complaint ILIKE '%diabetes%')
AND visits.created_at >= CURRENT_DATE - INTERVAL '30 days'
AND patients.practice_id = 'PRACTICE_ID';
```

### Insurance Status
**Query**: "patients without medical aid"
```sql
SELECT DISTINCT patients.id 
FROM patients 
LEFT JOIN medical_aid_details ON medical_aid_details.patient_id = patients.id 
WHERE medical_aid_details.id IS NULL 
AND patients.practice_id = 'PRACTICE_ID';
```

## 🔧 Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase PostgreSQL timeout
   - Optimize generated SQL
   - Add database indexes

2. **Verification Failures**
   - Check xAI API limits
   - Review SQL generation prompts
   - Verify practice_id format

3. **No Results**
   - Verify practice has patients
   - Check date calculations
   - Test SQL directly

### Debug Mode
Add these to your workflow for debugging:
```javascript
// Log all SQL before execution
console.log('Generated SQL:', generatedSql);
console.log('Verification Result:', verificationResult);
console.log('Final SQL:', finalSql);
```

## 📈 Performance Optimization

1. **Cache Common Queries**
   ```javascript
   const queryCache = new Map();
   const cacheKey = crypto.createHash('md5').update(query + practiceId).digest('hex');
   
   if (queryCache.has(cacheKey)) {
     return queryCache.get(cacheKey);
   }
   ```

2. **Batch Processing**
   - Group similar queries
   - Reuse schema information
   - Connection pooling

3. **Index Recommendations**
   ```sql
   CREATE INDEX idx_patients_practice_gender_age ON patients(practice_id, gender, date_of_birth);
   CREATE INDEX idx_visits_patient_date ON visits(patient_id, created_at DESC);
   CREATE INDEX idx_medical_aid_patient ON medical_aid_details(patient_id);
   ```