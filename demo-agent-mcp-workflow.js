/**
 * Demo: How Agents Guide MCP Tool Usage
 * 
 * This shows the complete workflow of:
 * 1. Agent detecting issues
 * 2. Agent recommending MCP tools
 * 3. Claude executing the MCP tools
 */

// SCENARIO 1: Privacy Agent Detects Security Issue
// ================================================

// Your code with security issue:
async function getPatients(practiceId) {
  // BAD: Direct database access without MCP
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId || 'default'); // Security issue!
}

// AGENT DETECTION (happens via hook):
/*
🚨 Privacy & HIPAA Agent Alert:
- Violation: Practice ID fallback detected
- Risk: HIPAA breach - cross-practice data access
- Recommendation: Use MCP tools with proper validation
*/

// AGENT PROVIDES MCP PATTERN:
/*
Use these MCP tools:
1. mcp__supabase__execute_sql for secure queries
2. mcp__supabase__get_advisors to verify security
3. Add HIPAA audit logging
*/

// CLAUDE EXECUTES (based on agent recommendation):
async function getPatientsSecure(practiceId, userId) {
  // Step 1: Validate practice access using MCP
  const accessCheck = await mcp__supabase__execute_sql({
    query: `
      SELECT 1 FROM practice_staff 
      WHERE practice_id = $1 AND user_id = $2
    `,
    params: [practiceId, userId]
  });
  
  if (!accessCheck.data?.length) {
    throw new Error('Unauthorized practice access');
  }
  
  // Step 2: Get patients with MCP (not direct supabase)
  const patients = await mcp__supabase__execute_sql({
    query: `
      SELECT 
        id, full_name, system_patient_reference_number,
        date_of_birth, phone, email
      FROM patients
      WHERE practice_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
    params: [practiceId]
  });
  
  // Step 3: Audit the access
  await mcp__supabase__execute_sql({
    query: `
      INSERT INTO hipaa_audit_logs 
      (user_id, action, resource_type, practice_id, timestamp)
      VALUES ($1, 'LIST_PATIENTS', 'patients', $2, $3)
    `,
    params: [userId, practiceId, new Date()]
  });
  
  return patients;
}

// SCENARIO 2: Performance Agent Detects Slow Query
// ================================================

// Your code with performance issue:
async function getPatientVisits(patientId) {
  // BAD: N+1 query pattern
  const patient = await supabase.from('patients').select().single();
  const visits = await supabase.from('visits').select().eq('patient_id', patientId);
  const vitals = [];
  for (const visit of visits) {
    const vital = await supabase.from('vitals').select().eq('visit_id', visit.id);
    vitals.push(vital);
  }
}

// AGENT DETECTION:
/*
⚡ Performance Engine Agent Alert:
- Issue: N+1 query pattern detected
- Impact: 100+ queries for single patient
- Recommendation: Use MCP with JOIN queries
*/

// CLAUDE EXECUTES (based on agent recommendation):
async function getPatientVisitsOptimized(patientId, practiceId) {
  // Single MCP query with JOINs
  const result = await mcp__supabase__execute_sql({
    query: `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', v.id,
            'visit_date', v.visit_date,
            'visit_type', v.visit_type,
            'vitals', (
              SELECT json_agg(vt.*)
              FROM vitals vt
              WHERE vt.visit_id = v.id
            )
          )
          ORDER BY v.visit_date DESC
        ) as visits
      FROM patients p
      LEFT JOIN visits v ON p.id = v.patient_id
      WHERE p.id = $1 
        AND p.practice_id = $2
        AND v.practice_id = $2
      GROUP BY p.id
    `,
    params: [patientId, practiceId]
  });
  
  return result.data?.[0];
}

// SCENARIO 3: Business Logic Agent Detects Workflow Issue
// =======================================================

// Your code with workflow violation:
async function createInvoice(amount, patientId) {
  // BAD: Creating invoice without visit
  const invoice = await supabase
    .from('invoices_enhanced')
    .insert({
      amount: amount,
      patient_id: patientId,
      status: 'paid' // Direct status change!
    });
}

// AGENT DETECTION:
/*
💼 Business Logic Validator Alert:
- Violation: Invoice created without visit link
- Violation: Direct status change to 'paid'
- Recommendation: Follow proper billing workflow
*/

// CLAUDE EXECUTES (based on agent recommendation):
async function createInvoiceProper(visitId, services, practiceId) {
  // Step 1: Verify visit exists and belongs to practice
  const visitCheck = await mcp__supabase__execute_sql({
    query: `
      SELECT id, patient_id, status 
      FROM visits 
      WHERE id = $1 AND practice_id = $2 AND status = 'completed'
    `,
    params: [visitId, practiceId]
  });
  
  if (!visitCheck.data?.length) {
    throw new Error('Visit must be completed before billing');
  }
  
  // Step 2: Calculate invoice with tax
  const subtotal = services.reduce((sum, s) => sum + s.amount, 0);
  const tax = subtotal * 0.15; // Get from practice settings
  
  // Step 3: Create invoice with proper workflow
  const invoice = await mcp__supabase__execute_sql({
    query: `
      INSERT INTO invoices_enhanced 
      (visit_id, patient_id, practice_id, subtotal, tax, total, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
      RETURNING *
    `,
    params: [
      visitId, 
      visitCheck.data[0].patient_id,
      practiceId,
      subtotal,
      tax,
      subtotal + tax,
      userId
    ]
  });
  
  // Step 4: Add line items
  for (const service of services) {
    await mcp__supabase__execute_sql({
      query: `
        INSERT INTO invoice_items 
        (invoice_id, service_id, description, amount, quantity)
        VALUES ($1, $2, $3, $4, $5)
      `,
      params: [invoice.data[0].id, service.id, service.description, service.amount, service.quantity]
    });
  }
  
  return invoice.data[0];
}

// SCENARIO 4: Complete Security Audit Using MCP
// =============================================

// When agent recommends security audit:
async function performSecurityAudit(tableName) {
  console.log(`🔒 Performing security audit on ${tableName} table...`);
  
  // Execute all security checks in parallel (CLAUDE.md pattern)
  const [schema, policies, indexes, advisors] = await Promise.all([
    mcp__supabase__get_table_schema({ table: tableName }),
    
    mcp__supabase__execute_sql({
      query: `
        SELECT policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE tablename = $1
      `,
      params: [tableName]
    }),
    
    mcp__supabase__execute_sql({
      query: `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
      `,
      params: [tableName]
    }),
    
    mcp__supabase__get_advisors({ type: 'security' })
  ]);
  
  // Analyze results
  const report = {
    table: tableName,
    hasRLS: policies.data?.length > 0,
    rlsPolicies: policies.data || [],
    indexes: indexes.data || [],
    securityIssues: advisors.filter(a => a.severity === 'critical'),
    recommendations: []
  };
  
  // Generate recommendations
  if (!report.hasRLS) {
    report.recommendations.push({
      severity: 'CRITICAL',
      action: 'Enable RLS on table',
      mcp: `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`
    });
  }
  
  const requiredPolicies = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  requiredPolicies.forEach(cmd => {
    if (!report.rlsPolicies.some(p => p.cmd === cmd)) {
      report.recommendations.push({
        severity: 'HIGH',
        action: `Add ${cmd} RLS policy`,
        mcp: `CREATE POLICY ${tableName}_${cmd.toLowerCase()}_policy ON ${tableName} FOR ${cmd} ...`
      });
    }
  });
  
  return report;
}

// EXAMPLE OUTPUT:
/*
🔒 Performing security audit on patients table...
{
  table: 'patients',
  hasRLS: true,
  rlsPolicies: [
    { policyname: 'patients_select_policy', cmd: 'SELECT', ... },
    { policyname: 'patients_insert_policy', cmd: 'INSERT', ... }
  ],
  securityIssues: [],
  recommendations: [
    {
      severity: 'HIGH',
      action: 'Add UPDATE RLS policy',
      mcp: 'CREATE POLICY patients_update_policy ON patients FOR UPDATE ...'
    },
    {
      severity: 'HIGH', 
      action: 'Add DELETE RLS policy',
      mcp: 'CREATE POLICY patients_delete_policy ON patients FOR DELETE ...'
    }
  ]
}
*/

console.log(`
✅ Agent-Guided MCP Workflow Summary:
====================================

1. Agents detect issues in your code via hooks
2. Agents provide specific MCP tool recommendations
3. You (Claude) execute the MCP tools following their patterns
4. All database access uses MCP tools, not direct Supabase client
5. Security, performance, and business logic are validated

Remember: Agents are advisors, you are the executor!
`);