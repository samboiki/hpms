#!/usr/bin/env node

/**
 * Privacy & HIPAA Agent - MCP Enhanced Version
 * 
 * This version properly uses Supabase MCP tools as per CLAUDE.md
 * Demonstrates the correct patterns for database access
 */

import { IntelligentAgent } from '../shared/agent-base.js';
import { mcpExecutor } from '../shared/mcp-tool-executor.js';

export class PrivacyHIPAAAgentMCP extends IntelligentAgent {
  constructor() {
    super({
      id: 'privacy-hipaa-mcp',
      name: '🔒 Privacy & HIPAA Agent (MCP Enhanced)',
      hpmsContext: {
        complianceRequirements: ['HIPAA', 'practice-isolation', 'audit-trails'],
        criticalTables: ['patients', 'visits', 'medical_records', 'vitals', 'lab_requests'],
        requiredMCPTools: [
          'mcp__supabase__list_tables',
          'mcp__supabase__execute_sql',
          'mcp__supabase__get_advisors',
          'mcp__supabase__get_table_schema'
        ]
      }
    });
  }
  
  /**
   * Analyze code for privacy violations using MCP patterns
   */
  async analyzePrivacyCompliance(content, filename) {
    const violations = [];
    const mcpRecommendations = [];
    
    // Check if code accesses critical tables
    const criticalTableAccess = this.detectCriticalTableAccess(content);
    
    if (criticalTableAccess.length > 0) {
      // Generate MCP recommendations for proper access
      for (const table of criticalTableAccess) {
        mcpRecommendations.push({
          table,
          recommendation: await this.generateMCPSecurityCheck(table),
          pattern: this.getSecureAccessPattern(table)
        });
      }
    }
    
    // Check for direct database access without MCP tools
    if (this.detectDirectDatabaseAccess(content)) {
      violations.push({
        type: 'direct_db_access',
        severity: 'high',
        message: 'Direct database access bypasses audit trails',
        fix: 'Use Supabase MCP tools for all database operations',
        mcpExample: this.getMCPAuditExample()
      });
    }
    
    // Check for missing RLS verification
    if (this.detectMissingRLSCheck(content)) {
      violations.push({
        type: 'missing_rls_check',
        severity: 'critical',
        message: 'No RLS policy verification detected',
        fix: 'Use mcp__supabase__get_advisors to verify RLS policies',
        mcpPattern: await this.getRLSCheckPattern()
      });
    }
    
    return {
      violations,
      mcpRecommendations,
      auditRequirements: this.generateAuditRequirements(content)
    };
  }
  
  /**
   * Generate MCP-based security check for a table
   */
  async generateMCPSecurityCheck(tableName) {
    return {
      description: `Security check for ${tableName} table`,
      mcpTools: [
        {
          tool: 'mcp__supabase__get_table_schema',
          purpose: 'Verify table structure and constraints',
          usage: `await mcp__supabase__get_table_schema({ table: '${tableName}' })`
        },
        {
          tool: 'mcp__supabase__execute_sql',
          purpose: 'Check RLS policies',
          usage: `await mcp__supabase__execute_sql({
  query: \`
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE tablename = '${tableName}'
  \`
})`
        },
        {
          tool: 'mcp__supabase__get_advisors',
          purpose: 'Get security recommendations',
          usage: `await mcp__supabase__get_advisors({ type: 'security' })`
        }
      ],
      fullPattern: `
// CLAUDE.md Pattern: Complete security audit for ${tableName}
async function audit${tableName}Security() {
  // Execute all security checks simultaneously
  const [schema, rlsPolicies, advisors, permissions] = await Promise.all([
    mcp__supabase__get_table_schema({ table: '${tableName}' }),
    mcp__supabase__execute_sql({
      query: \`/* RLS policy query */\`
    }),
    mcp__supabase__get_advisors({ type: 'security' }),
    mcp__supabase__execute_sql({
      query: \`/* Permission check query */\`
    })
  ]);
  
  // Analyze results
  const issues = [];
  
  // Check for missing RLS
  if (rlsPolicies.length === 0) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'No RLS policies on ${tableName}',
      hipaaViolation: 'Technical Safeguards § 164.312(a)(1)'
    });
  }
  
  // Check advisors
  advisors.forEach(advisor => {
    if (advisor.table === '${tableName}' && advisor.severity === 'critical') {
      issues.push({
        severity: 'CRITICAL',
        issue: advisor.message,
        remediation: advisor.remediationUrl
      });
    }
  });
  
  return { schema, rlsPolicies, advisors, permissions, issues };
}`
    };
  }
  
  /**
   * Get secure access pattern for a table
   */
  getSecureAccessPattern(tableName) {
    const patterns = {
      patients: `
// HIPAA-Compliant Patient Access Pattern
async function getPatientData(patientId, practiceId, userId) {
  // 1. Verify practice access first
  const practiceCheck = await mcp__supabase__execute_sql({
    query: \`
      SELECT 1 FROM practice_staff 
      WHERE practice_id = $1 
        AND user_id = $2 
        AND status = 'active'
    \`,
    params: [practiceId, userId]
  });
  
  if (!practiceCheck.data?.length) {
    throw new Error('Unauthorized practice access');
  }
  
  // 2. Get patient with audit
  const patient = await mcp__supabase__execute_sql({
    query: \`
      SELECT 
        p.*,
        -- Exclude sensitive fields unless required
        CASE 
          WHEN $3 = true THEN p.id_number 
          ELSE 'REDACTED' 
        END as id_number
      FROM patients p
      WHERE p.id = $1 
        AND p.practice_id = $2
    \`,
    params: [patientId, practiceId, hasPermissionForSSN]
  });
  
  // 3. Log HIPAA audit
  await mcp__supabase__execute_sql({
    query: \`
      INSERT INTO hipaa_audit_logs 
      (user_id, action, resource_type, resource_id, practice_id, metadata)
      VALUES ($1, 'VIEW_PATIENT', 'patients', $2, $3, $4)
    \`,
    params: [userId, patientId, practiceId, { timestamp: new Date() }]
  });
  
  return patient;
}`,
      
      visits: `
// Secure Visit Access with Relationships
async function getVisitWithSecurity(visitId, practiceId, userId) {
  // Use MCP tools for comprehensive data with security
  const visitData = await mcp__supabase__execute_sql({
    query: \`
      SELECT 
        v.*,
        p.full_name as patient_name,
        -- Only show patient ID if visit belongs to practice
        CASE 
          WHEN v.practice_id = $2 THEN p.system_patient_reference_number
          ELSE NULL
        END as patient_ref,
        u.full_name as doctor_name
      FROM visits v
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.assigned_to_user_id = u.id
      WHERE v.id = $1
        AND v.practice_id = $2  -- Practice isolation
        AND p.practice_id = $2  -- Double-check patient belongs to practice
    \`,
    params: [visitId, practiceId]
  });
  
  // Verify user has access to this visit type
  const accessCheck = await mcp__supabase__execute_sql({
    query: \`/* Role-based access check */\`
  });
  
  return visitData;
}`,
      
      medical_records: `
// Ultra-Secure Medical Records Access
async function getMedicalRecords(patientId, practiceId, userId, recordType) {
  // 1. Multi-level security check
  const [practiceAccess, roleCheck, patientConsent] = await Promise.all([
    mcp__supabase__execute_sql({ /* Practice access query */ }),
    mcp__supabase__execute_sql({ /* Role permission query */ }),
    mcp__supabase__execute_sql({ /* Patient consent query */ })
  ]);
  
  if (!practiceAccess || !roleCheck || !patientConsent) {
    throw new Error('Insufficient permissions for medical records');
  }
  
  // 2. Get records with field-level security
  const records = await mcp__supabase__execute_sql({
    query: \`
      SELECT 
        mr.id,
        mr.record_date,
        mr.record_type,
        -- Sensitive data only for authorized roles
        CASE 
          WHEN $4 IN ('doctor', 'nurse') THEN mr.diagnosis
          ELSE 'AUTHORIZATION_REQUIRED'
        END as diagnosis,
        CASE
          WHEN $4 IN ('doctor', 'nurse') THEN mr.treatment_plan  
          ELSE 'AUTHORIZATION_REQUIRED'
        END as treatment_plan
      FROM medical_records mr
      WHERE mr.patient_id = $1
        AND mr.practice_id = $2
        AND ($5 IS NULL OR mr.record_type = $5)
      ORDER BY mr.record_date DESC
      LIMIT 50
    \`,
    params: [patientId, practiceId, userId, userRole, recordType]
  });
  
  // 3. Comprehensive audit with viewed fields
  await mcp__supabase__execute_sql({
    query: \`/* Detailed HIPAA audit insert */\`
  });
  
  return records;
}`
    };
    
    return patterns[tableName] || this.getGenericSecurePattern(tableName);
  }
  
  /**
   * Detect critical table access in code
   */
  detectCriticalTableAccess(content) {
    const tables = [];
    const criticalTables = ['patients', 'visits', 'medical_records', 'vitals', 'lab_requests', 'prescriptions'];
    
    criticalTables.forEach(table => {
      if (content.includes(`from('${table}')`) || content.includes(`FROM ${table}`)) {
        tables.push(table);
      }
    });
    
    return tables;
  }
  
  /**
   * Detect direct database access without MCP tools
   */
  detectDirectDatabaseAccess(content) {
    // Check for raw SQL without MCP
    const hasRawSQL = content.includes('supabase.rpc') || 
                      content.includes('postgres://') ||
                      content.includes('pg.query');
    
    // Check for Supabase client without proper patterns
    const hasDirectClient = content.includes('createClient') && 
                           !content.includes('mcp__supabase');
    
    return hasRawSQL || hasDirectClient;
  }
  
  /**
   * Detect missing RLS checks
   */
  detectMissingRLSCheck(content) {
    const hasTableAccess = content.includes('.from(') || content.includes('FROM ');
    const hasRLSCheck = content.includes('get_advisors') || 
                        content.includes('pg_policies') ||
                        content.includes('RLS');
    
    return hasTableAccess && !hasRLSCheck;
  }
  
  /**
   * Get MCP audit example
   */
  getMCPAuditExample() {
    return `
// CLAUDE.md Pattern: Proper MCP tool usage with audit
async function secureDataAccess(resource, action) {
  try {
    // 1. Pre-access security check
    const securityCheck = await mcp__supabase__get_advisors({ 
      type: 'security' 
    });
    
    // 2. Perform data access with MCP
    const data = await mcp__supabase__execute_sql({
      query: \`/* Your secure query with practice_id */\`
    });
    
    // 3. Audit the access
    await mcp__supabase__execute_sql({
      query: \`
        INSERT INTO hipaa_audit_logs 
        (user_id, action, resource_type, timestamp, metadata)
        VALUES ($1, $2, $3, $4, $5)
      \`,
      params: [userId, action, resource, new Date(), metadata]
    });
    
    return data;
  } catch (error) {
    // Log failed access attempts too
    await mcp__supabase__execute_sql({
      query: \`/* Failed access audit */\`
    });
    throw error;
  }
}`;
  }
  
  /**
   * Get RLS check pattern
   */
  async getRLSCheckPattern() {
    return `
// CLAUDE.md Pattern: Verify RLS policies using MCP
async function verifyTableSecurity(tableName) {
  // 1. Check RLS is enabled
  const rlsEnabled = await mcp__supabase__execute_sql({
    query: \`
      SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = $1
    \`,
    params: [tableName]
  });
  
  // 2. Get all RLS policies
  const policies = await mcp__supabase__execute_sql({
    query: \`
      SELECT * FROM pg_policies 
      WHERE tablename = $1
    \`,
    params: [tableName]
  });
  
  // 3. Get security advisors
  const advisors = await mcp__supabase__get_advisors({ 
    type: 'security' 
  });
  
  // 4. Validate coverage
  const requiredPolicies = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const missingPolicies = requiredPolicies.filter(cmd => 
    !policies.data?.some(p => p.cmd === cmd)
  );
  
  if (!rlsEnabled.data?.[0]?.relrowsecurity) {
    throw new Error(\`CRITICAL: RLS not enabled on \${tableName}\`);
  }
  
  if (missingPolicies.length > 0) {
    console.warn(\`Missing RLS policies for \${tableName}: \${missingPolicies.join(', ')}\`);
  }
  
  return { rlsEnabled, policies, advisors, missingPolicies };
}`;
  }
  
  /**
   * Generate audit requirements based on code
   */
  generateAuditRequirements(content) {
    const requirements = [];
    
    if (content.includes('patients')) {
      requirements.push({
        action: 'PATIENT_ACCESS',
        fields: ['user_id', 'patient_id', 'practice_id', 'action', 'timestamp'],
        mcpImplementation: `await mcp__supabase__execute_sql({
  query: 'INSERT INTO hipaa_audit_logs ...'
})`
      });
    }
    
    if (content.includes('DELETE') || content.includes('.delete(')) {
      requirements.push({
        action: 'DATA_DELETION',
        severity: 'CRITICAL',
        fields: ['user_id', 'resource_type', 'resource_id', 'deleted_data', 'reason'],
        note: 'Deletions require special audit with data preservation'
      });
    }
    
    return requirements;
  }
  
  /**
   * Get generic secure pattern for any table
   */
  getGenericSecurePattern(tableName) {
    return `
// Generic secure access pattern using MCP tools
async function secureAccess${tableName}(recordId, practiceId, userId) {
  // 1. Verify table has RLS
  const rlsCheck = await mcp__supabase__execute_sql({
    query: 'SELECT relrowsecurity FROM pg_class WHERE relname = $1',
    params: ['${tableName}']
  });
  
  if (!rlsCheck.data?.[0]?.relrowsecurity) {
    throw new Error('Table lacks RLS policies');
  }
  
  // 2. Access with practice isolation
  const data = await mcp__supabase__execute_sql({
    query: \`
      SELECT * FROM ${tableName}
      WHERE id = $1 AND practice_id = $2
    \`,
    params: [recordId, practiceId]
  });
  
  // 3. Audit access
  await mcp__supabase__execute_sql({
    query: 'INSERT INTO audit_logs ...'
  });
  
  return data;
}`;
  }
  
  /**
   * Main execution method for the agent
   */
  async execute(hookData) {
    const content = hookData.tool_result?.content || '';
    const filename = hookData.tool_input?.file_path || 'unknown';
    
    const analysis = await this.analyzePrivacyCompliance(content, filename);
    
    if (analysis.violations.length === 0) {
      return {
        action: 'approve',
        reason: 'Privacy compliance verified',
        mcpToolsUsed: analysis.mcpRecommendations.length > 0
      };
    }
    
    // Generate comprehensive report
    const report = {
      action: 'review',
      violations: analysis.violations,
      mcpRecommendations: analysis.mcpRecommendations,
      auditRequirements: analysis.auditRequirements,
      severity: this.calculateSeverity(analysis.violations),
      immediateActions: this.getImmediateActions(analysis)
    };
    
    // Store analysis
    await this.storeKnowledge(`privacy-${filename}`, {
      timestamp: new Date().toISOString(),
      violations: analysis.violations.length,
      criticalIssues: analysis.violations.filter(v => v.severity === 'critical').length,
      mcpRecommendations: analysis.mcpRecommendations.length
    });
    
    return report;
  }
  
  calculateSeverity(violations) {
    const hasCritical = violations.some(v => v.severity === 'critical');
    const hasHigh = violations.some(v => v.severity === 'high');
    
    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    return 'medium';
  }
  
  getImmediateActions(analysis) {
    const actions = [];
    
    if (analysis.violations.some(v => v.type === 'missing_rls_check')) {
      actions.push({
        priority: 'IMMEDIATE',
        action: 'Run mcp__supabase__get_advisors({ type: "security" })',
        reason: 'Verify all tables have proper RLS policies'
      });
    }
    
    if (analysis.violations.some(v => v.type === 'direct_db_access')) {
      actions.push({
        priority: 'HIGH',
        action: 'Refactor to use MCP tools',
        reason: 'Ensure all database access goes through proper audit trails'
      });
    }
    
    return actions;
  }
}

// Export for use in coordinator
export default PrivacyHIPAAAgentMCP;