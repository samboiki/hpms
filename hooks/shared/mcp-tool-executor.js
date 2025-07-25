#!/usr/bin/env node

/**
 * MCP Tool Executor
 * 
 * Provides proper Supabase MCP tool execution for agents
 * Following CLAUDE.md guidelines for database access
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MCPToolExecutor {
  constructor() {
    this.projectRef = 'jjxlfunlbyayxwvlpgwt'; // HPMS project reference
  }
  
  /**
   * Execute MCP tools through Claude Code CLI
   * This simulates what Claude would do when using MCP tools
   */
  async executeMCPTool(toolName, params) {
    // For hooks, we can't directly execute MCP tools
    // Instead, we return structured data that Claude can use
    return {
      tool: toolName,
      params,
      recommendation: this.getToolRecommendation(toolName, params)
    };
  }
  
  /**
   * Get table schema using MCP pattern from CLAUDE.md
   */
  async getTableSchema(tableName) {
    return {
      tool: 'mcp__supabase__get_table_schema',
      params: { table: tableName },
      recommendation: `Use mcp__supabase__get_table_schema to analyze ${tableName} structure`,
      pattern: `
// CLAUDE.md Pattern: Comprehensive Table Analysis
// 1. Get schema
const schema = await mcp__supabase__get_table_schema({ table: '${tableName}' });

// 2. Get relationships (execute simultaneously)
const relationships = await mcp__supabase__execute_sql({
  query: \`
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = '${tableName}';
  \`
});

// 3. Get sample data
const sampleData = await mcp__supabase__execute_sql({
  query: \`SELECT * FROM ${tableName} LIMIT 5\`
});

// 4. Get indexes
const indexes = await mcp__supabase__execute_sql({
  query: \`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = '${tableName}'
  \`
});`
    };
  }
  
  /**
   * Execute SQL query using MCP pattern
   */
  async executeSQL(query) {
    return {
      tool: 'mcp__supabase__execute_sql',
      params: { query },
      recommendation: 'Use mcp__supabase__execute_sql for data queries',
      securityCheck: this.validateQuery(query)
    };
  }
  
  /**
   * List tables using MCP pattern
   */
  async listTables(schemas = ['public']) {
    return {
      tool: 'mcp__supabase__list_tables',
      params: { schemas },
      recommendation: 'Use mcp__supabase__list_tables to discover database structure',
      pattern: `
// CLAUDE.md Pattern: Multi-tool execution
const [tables, extensions, health] = await Promise.all([
  mcp__supabase__list_tables({ schemas: ['public'] }),
  mcp__supabase__list_extensions(),
  mcp__supabase__get_project_health()
]);`
    };
  }
  
  /**
   * Get security advisors using MCP pattern
   */
  async getSecurityAdvisors() {
    return {
      tool: 'mcp__supabase__get_advisors',
      params: { type: 'security' },
      recommendation: 'Check security advisors after DDL changes',
      pattern: `
// CLAUDE.md Pattern: Security check after changes
const securityAdvisors = await mcp__supabase__get_advisors({ type: 'security' });
const performanceAdvisors = await mcp__supabase__get_advisors({ type: 'performance' });

// Check for missing RLS policies
securityAdvisors.forEach(advisor => {
  if (advisor.severity === 'critical') {
    console.error('🚨 CRITICAL Security Issue:', advisor.message);
    console.log('Remediation:', advisor.remediationUrl);
  }
});`
    };
  }
  
  /**
   * Validate query for security
   */
  validateQuery(query) {
    const issues = [];
    
    // Check for practice isolation
    if (!query.includes('practice_id') && !query.includes('information_schema')) {
      issues.push({
        type: 'missing_practice_isolation',
        severity: 'high',
        message: 'Query missing practice_id filter'
      });
    }
    
    // Check for SELECT *
    if (query.match(/SELECT\s+\*/i)) {
      issues.push({
        type: 'select_star',
        severity: 'medium',
        message: 'Avoid SELECT *, specify needed columns'
      });
    }
    
    // Check for missing LIMIT
    if (query.match(/SELECT/i) && !query.match(/LIMIT/i) && !query.match(/information_schema/i)) {
      issues.push({
        type: 'missing_limit',
        severity: 'medium',
        message: 'Add LIMIT clause for performance'
      });
    }
    
    return issues;
  }
  
  /**
   * Get tool recommendation based on CLAUDE.md patterns
   */
  getToolRecommendation(toolName, params) {
    const recommendations = {
      'mcp__supabase__get_table_schema': `
Execute these MCP tools simultaneously for comprehensive analysis:
1. mcp__supabase__get_table_schema - Get structure
2. mcp__supabase__execute_sql - Get relationships and constraints  
3. mcp__supabase__execute_sql - Get sample data
4. mcp__supabase__get_advisors - Check for security issues`,
      
      'mcp__supabase__execute_sql': `
Ensure query follows HPMS patterns:
- Always include practice_id filter
- Use specific column selection
- Add proper indexes for WHERE clauses
- Consider React Query caching on frontend`,
      
      'mcp__supabase__list_tables': `
Use with these complementary tools:
- mcp__supabase__list_extensions - Check available extensions
- mcp__supabase__get_advisors - Security recommendations
- mcp__supabase__list_migrations - Migration history`,
      
      'mcp__supabase__apply_migration': `
Follow migration best practices:
1. Test on branch first (mcp__supabase__create_branch)
2. Apply migration (mcp__supabase__apply_migration)
3. Run security check (mcp__supabase__get_advisors)
4. Generate types (mcp__supabase__generate_typescript_types)`
    };
    
    return recommendations[toolName] || 'Follow CLAUDE.md MCP tool patterns';
  }
  
  /**
   * Generate MCP tool usage examples for agents
   */
  getMCPExamples() {
    return {
      tableAnalysis: `
// CLAUDE.md Pattern: Complete table analysis
async function analyzeTable(tableName) {
  // Execute ALL tools simultaneously
  const [schema, relationships, data, indexes, advisors] = await Promise.all([
    mcp__supabase__get_table_schema({ table: tableName }),
    mcp__supabase__execute_sql({
      query: \`/* Get foreign keys */\`
    }),
    mcp__supabase__execute_sql({
      query: \`SELECT * FROM \${tableName} LIMIT 10\`
    }),
    mcp__supabase__execute_sql({
      query: \`/* Get indexes */\`
    }),
    mcp__supabase__get_advisors({ type: 'security' })
  ]);
  
  return { schema, relationships, data, indexes, advisors };
}`,
      
      secureQuery: `
// CLAUDE.md Pattern: Secure HPMS query
async function getPatientVisits(practiceId, patientId) {
  const { data, error } = await mcp__supabase__execute_sql({
    query: \`
      SELECT 
        v.id,
        v.visit_date,
        v.visit_type,
        v.status,
        p.full_name as patient_name,
        u.full_name as doctor_name
      FROM visits v
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.assigned_to_user_id = u.id
      WHERE v.practice_id = $1 
        AND v.patient_id = $2
        AND p.practice_id = $1  -- Double-check practice isolation
      ORDER BY v.visit_date DESC
      LIMIT 50
    \`,
    params: [practiceId, patientId]
  });
  
  return data;
}`,
      
      performanceOptimization: `
// CLAUDE.md Pattern: Performance analysis
async function optimizeQuery(slowQuery) {
  // Get query plan
  const plan = await mcp__supabase__execute_sql({
    query: \`EXPLAIN ANALYZE \${slowQuery}\`
  });
  
  // Get missing indexes
  const advisors = await mcp__supabase__get_advisors({ 
    type: 'performance' 
  });
  
  // Check table statistics
  const stats = await mcp__supabase__execute_sql({
    query: \`/* Table statistics query */\`
  });
  
  return { plan, advisors, stats };
}`
    };
  }
}

// Export singleton instance
export const mcpExecutor = new MCPToolExecutor();