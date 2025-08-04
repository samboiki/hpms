# 🔧 MCP Tool Usage Guide for AI Agents

## ⚠️ CRITICAL: Agents MUST Use Supabase MCP Tools

As per CLAUDE.md, all database operations must use Supabase MCP tools. The agents in the hook system should guide Claude to use these tools properly.

## 🎯 Correct MCP Tool Usage Patterns

### 1. **Table Analysis Pattern** (CLAUDE.md Approved)
```javascript
// ✅ CORRECT: Using MCP tools with simultaneous execution
async function analyzeTable(tableName) {
  // Execute ALL analysis tools simultaneously
  const [schema, relationships, sampleData, indexes, security] = await Promise.all([
    mcp__supabase__get_table_schema({ table: tableName }),
    mcp__supabase__execute_sql({
      query: `/* Get foreign key relationships */`
    }),
    mcp__supabase__execute_sql({
      query: `SELECT * FROM ${tableName} LIMIT 10`
    }),
    mcp__supabase__execute_sql({
      query: `/* Get indexes */`
    }),
    mcp__supabase__get_advisors({ type: 'security' })
  ]);
  
  return { schema, relationships, sampleData, indexes, security };
}

// ❌ WRONG: Using Supabase client directly
const { data } = await supabase.from('table').select('*');
```

### 2. **Secure Query Pattern** (HIPAA Compliant)
```javascript
// ✅ CORRECT: Using MCP tools with practice isolation
async function getPatientData(patientId, practiceId) {
  const { data, error } = await mcp__supabase__execute_sql({
    query: `
      SELECT 
        p.*,
        COUNT(v.id) as visit_count
      FROM patients p
      LEFT JOIN visits v ON p.id = v.patient_id
      WHERE p.id = $1 
        AND p.practice_id = $2
        AND v.practice_id = $2  -- Double-check isolation
      GROUP BY p.id
    `,
    params: [patientId, practiceId]
  });
  
  // Audit trail using MCP
  await mcp__supabase__execute_sql({
    query: `INSERT INTO hipaa_audit_logs ...`
  });
  
  return data;
}
```

### 3. **Migration Pattern** (Safe DDL Operations)
```javascript
// ✅ CORRECT: Using MCP migration tools
async function addNewColumn() {
  // 1. Create branch for testing
  await mcp__supabase__create_branch({ name: 'add-column-feature' });
  
  // 2. Apply migration
  await mcp__supabase__apply_migration({
    name: 'add_patient_preferences',
    query: `
      ALTER TABLE patients 
      ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
    `
  });
  
  // 3. Check security impact
  const advisors = await mcp__supabase__get_advisors({ type: 'security' });
  
  // 4. Generate new types
  await mcp__supabase__generate_typescript_types();
}
```

### 4. **Performance Analysis Pattern**
```javascript
// ✅ CORRECT: Using MCP for performance optimization
async function analyzeSlowQuery(query) {
  // Get query execution plan
  const plan = await mcp__supabase__execute_sql({
    query: `EXPLAIN ANALYZE ${query}`
  });
  
  // Get performance advisors
  const advisors = await mcp__supabase__get_advisors({ 
    type: 'performance' 
  });
  
  // Check missing indexes
  const indexCheck = await mcp__supabase__execute_sql({
    query: `/* Index analysis query */`
  });
  
  return { plan, advisors, indexCheck };
}
```

## 🚨 Common Mistakes to Avoid

### ❌ **Direct Supabase Client Usage**
```javascript
// WRONG - Bypasses MCP tools
const { data } = await supabase
  .from('patients')
  .select('*')
  .eq('practice_id', practiceId);
```

### ❌ **Raw SQL Without MCP**
```javascript
// WRONG - No audit trail
const result = await db.query('SELECT * FROM patients');
```

### ❌ **Missing Practice Isolation**
```javascript
// WRONG - No practice_id filter
const { data } = await mcp__supabase__execute_sql({
  query: 'SELECT * FROM visits'  // Missing WHERE practice_id = ?
});
```

## 📋 MCP Tool Reference

### **Data Operations**
- `mcp__supabase__execute_sql` - Execute queries with audit
- `mcp__supabase__get_table_schema` - Get table structure
- `mcp__supabase__list_tables` - List all tables

### **Security & Compliance**
- `mcp__supabase__get_advisors` - Security/performance checks
- `mcp__supabase__list_extensions` - Check available extensions

### **Schema Management**
- `mcp__supabase__apply_migration` - Apply DDL changes
- `mcp__supabase__list_migrations` - View migration history
- `mcp__supabase__generate_typescript_types` - Generate types

### **Branch Operations**
- `mcp__supabase__create_branch` - Create dev branch
- `mcp__supabase__merge_branch` - Merge to production
- `mcp__supabase__list_branches` - List branches

### **Communication**
- Use `communicationService` (not MCP) for SMS/Email
- Logs stored in `practice_sms_logs` and `practice_email_logs`

## 🎯 How Agents Should Guide Claude

When agents detect database operations, they should:

1. **Recommend MCP tools** instead of direct access
2. **Provide complete patterns** from CLAUDE.md
3. **Show simultaneous execution** for performance
4. **Include security checks** with every operation
5. **Add audit trails** for HIPAA compliance

## 📝 Example Agent Recommendation

```javascript
// Agent detects: supabase.from('patients').select()

// Agent recommends:
"Use MCP tools for database access:
- mcp__supabase__execute_sql for queries
- Include practice_id filter for isolation
- Add HIPAA audit logging
- Run security advisors after changes

Example pattern:
const patients = await mcp__supabase__execute_sql({
  query: 'SELECT * FROM patients WHERE practice_id = $1',
  params: [practiceId]
});

await mcp__supabase__execute_sql({
  query: 'INSERT INTO hipaa_audit_logs ...'
});"
```

## 🔄 Integration with Hook System

The hook system agents should:
1. **Detect** non-MCP database access
2. **Flag** as violations
3. **Provide** MCP alternatives
4. **Show** correct patterns
5. **Track** MCP tool usage in session reports

This ensures all database operations follow CLAUDE.md guidelines! 🚀