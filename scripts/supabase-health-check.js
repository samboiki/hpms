import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SupabaseHealthChecker {
  constructor() {
    this.supabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
    );
    this.issues = [];
    this.suggestions = [];
    this.tables = [];
  }

  async analyzeTables() {
    console.log('🔍 Analyzing Tables...');
    
    // Get all tables
    const { data: tablesData, error: tablesError } = await this.supabase.rpc('exec', {
      sql: `
        SELECT table_name, table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return;
    }

    // For each table, get column information
    for (const table of tablesData) {
      const tableName = table.table_name;
      
      const { data: columnsData, error: columnsError } = await this.supabase.rpc('exec', {
        sql: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          ORDER BY ordinal_position;
        `
      });

      if (!columnsError) {
        this.tables.push({
          name: tableName,
          columns: columnsData,
          type: table.table_type
        });
        
        this.analyzeTableStructure(tableName, columnsData);
      }
    }
  }

  analyzeTableStructure(tableName, columns) {
    // Check for primary key
    const hasPrimaryKey = columns.some(col => 
      col.column_name === 'id' || 
      col.column_default?.includes('gen_random_uuid()')
    );

    if (!hasPrimaryKey) {
      this.issues.push({
        type: 'MISSING_PRIMARY_KEY',
        table: tableName,
        severity: 'HIGH',
        description: `Table ${tableName} appears to lack a proper primary key`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();`
      });
    }

    // Check for timestamp columns
    const hasCreatedAt = columns.some(col => col.column_name === 'created_at');
    const hasUpdatedAt = columns.some(col => col.column_name === 'updated_at');

    if (!hasCreatedAt) {
      this.suggestions.push({
        type: 'MISSING_CREATED_AT',
        table: tableName,
        severity: 'MEDIUM',
        description: `Table ${tableName} missing created_at timestamp for audit trail`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`
      });
    }

    if (!hasUpdatedAt) {
      this.suggestions.push({
        type: 'MISSING_UPDATED_AT',
        table: tableName,
        severity: 'MEDIUM',
        description: `Table ${tableName} missing updated_at timestamp for audit trail`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();`
      });
    }

    // Check for common healthcare table patterns
    this.analyzeHealthcarePatterns(tableName, columns);
  }

  analyzeHealthcarePatterns(tableName, columns) {
    const columnNames = columns.map(c => c.column_name);

    // Patient table checks
    if (tableName === 'patients') {
      const requiredFields = ['first_name', 'last_name', 'date_of_birth'];
      const missingFields = requiredFields.filter(field => !columnNames.includes(field));
      
      if (missingFields.length > 0) {
        this.issues.push({
          type: 'MISSING_REQUIRED_FIELDS',
          table: tableName,
          severity: 'HIGH',
          description: `Patients table missing required fields: ${missingFields.join(', ')}`,
          fix: `-- Add missing required fields to patients table`
        });
      }

      // Check for unique constraints
      if (!columnNames.includes('id_number') && !columnNames.includes('medical_record_number')) {
        this.suggestions.push({
          type: 'MISSING_UNIQUE_IDENTIFIER',
          table: tableName,
          severity: 'MEDIUM',
          description: 'Patients table should have a unique identifier (ID number or medical record number)',
          fix: `ALTER TABLE patients ADD COLUMN medical_record_number TEXT UNIQUE;`
        });
      }
    }

    // Appointments table checks
    if (tableName === 'appointments') {
      const requiredFields = ['patient_id', 'appointment_date', 'appointment_time', 'status'];
      const missingFields = requiredFields.filter(field => !columnNames.includes(field));
      
      if (missingFields.length > 0) {
        this.issues.push({
          type: 'MISSING_REQUIRED_FIELDS',
          table: tableName,
          severity: 'HIGH',
          description: `Appointments table missing required fields: ${missingFields.join(', ')}`,
          fix: `-- Add missing required fields to appointments table`
        });
      }
    }

    // Medical records checks
    if (tableName === 'medical_records' || tableName === 'visits') {
      if (!columnNames.includes('patient_id')) {
        this.issues.push({
          type: 'MISSING_PATIENT_REFERENCE',
          table: tableName,
          severity: 'HIGH',
          description: `${tableName} table must reference patient_id`,
          fix: `ALTER TABLE ${tableName} ADD COLUMN patient_id UUID REFERENCES patients(id);`
        });
      }
    }
  }

  async analyzeRelationships() {
    console.log('🔗 Analyzing Relationships...');
    
    // Common relationship patterns to check
    const expectedRelationships = [
      { from: 'appointments', column: 'patient_id', to: 'patients' },
      { from: 'visits', column: 'patient_id', to: 'patients' },
      { from: 'medical_records', column: 'patient_id', to: 'patients' },
      { from: 'medical_records', column: 'visit_id', to: 'visits' },
      { from: 'vitals', column: 'visit_id', to: 'visits' },
      { from: 'lab_results', column: 'patient_id', to: 'patients' },
      { from: 'lab_results', column: 'visit_id', to: 'visits' },
      { from: 'prescriptions', column: 'patient_id', to: 'patients' },
      { from: 'billing_invoices', column: 'patient_id', to: 'patients' },
      { from: 'appointments', column: 'doctor_id', to: 'users' },
      { from: 'visits', column: 'doctor_id', to: 'users' }
    ];

    for (const rel of expectedRelationships) {
      const fromTable = this.tables.find(t => t.name === rel.from);
      const toTable = this.tables.find(t => t.name === rel.to);
      
      if (fromTable && toTable) {
        const hasColumn = fromTable.columns.some(c => c.column_name === rel.column);
        
        if (!hasColumn) {
          this.issues.push({
            type: 'MISSING_FOREIGN_KEY_COLUMN',
            table: rel.from,
            severity: 'HIGH',
            description: `Table ${rel.from} missing ${rel.column} reference to ${rel.to}`,
            fix: `ALTER TABLE ${rel.from} ADD COLUMN ${rel.column} UUID REFERENCES ${rel.to}(id);`
          });
        }
      } else if (fromTable && !toTable) {
        this.suggestions.push({
          type: 'MISSING_REFERENCE_TABLE',
          table: rel.from,
          severity: 'LOW',
          description: `Table ${rel.from} references ${rel.to} which doesn't exist`,
          fix: `-- Consider creating ${rel.to} table or removing reference`
        });
      }
    }
  }

  async analyzeDataIntegrity() {
    console.log('🔍 Analyzing Data Integrity...');
    
    // Check for common data integrity issues
    const checks = [
      {
        name: 'Future appointment dates',
        table: 'appointments',
        query: `SELECT COUNT(*) as count FROM appointments WHERE appointment_date > CURRENT_DATE + INTERVAL '1 year'`,
        threshold: 0,
        message: 'Appointments scheduled more than 1 year in the future'
      },
      {
        name: 'Past birth dates',
        table: 'patients',
        query: `SELECT COUNT(*) as count FROM patients WHERE date_of_birth > CURRENT_DATE`,
        threshold: 0,
        message: 'Patients with future birth dates'
      },
      {
        name: 'Invalid ages',
        table: 'patients',
        query: `SELECT COUNT(*) as count FROM patients WHERE date_of_birth < '1900-01-01'`,
        threshold: 10,
        message: 'Patients with birth dates before 1900 (may be data entry errors)'
      }
    ];

    for (const check of checks) {
      try {
        const { data, error } = await this.supabase.rpc('exec', { sql: check.query });
        
        if (!error && data && data[0]?.count > check.threshold) {
          this.suggestions.push({
            type: 'DATA_INTEGRITY_ISSUE',
            table: check.table,
            severity: 'MEDIUM',
            description: `${check.message}: ${data[0].count} records`,
            fix: `-- Review and clean up data: ${check.query}`
          });
        }
      } catch (error) {
        // Table might not exist, skip
      }
    }
  }

  async analyzeIndexes() {
    console.log('📊 Analyzing Indexes...');
    
    // Suggest indexes for common query patterns
    const indexSuggestions = [
      { table: 'appointments', column: 'appointment_date', reason: 'Date-based queries' },
      { table: 'appointments', column: 'patient_id', reason: 'Patient appointment lookups' },
      { table: 'appointments', column: 'doctor_id', reason: 'Doctor schedule lookups' },
      { table: 'appointments', column: 'status', reason: 'Status filtering' },
      { table: 'patients', column: 'last_name', reason: 'Name-based searches' },
      { table: 'patients', column: 'id_number', reason: 'ID number lookups' },
      { table: 'visits', column: 'patient_id', reason: 'Patient visit history' },
      { table: 'visits', column: 'visit_date', reason: 'Date-based queries' },
      { table: 'medical_records', column: 'patient_id', reason: 'Patient record lookups' },
      { table: 'lab_results', column: 'patient_id', reason: 'Patient lab history' },
      { table: 'billing_invoices', column: 'patient_id', reason: 'Patient billing lookups' }
    ];

    for (const suggestion of indexSuggestions) {
      const table = this.tables.find(t => t.name === suggestion.table);
      
      if (table && table.columns.some(c => c.column_name === suggestion.column)) {
        this.suggestions.push({
          type: 'PERFORMANCE_INDEX',
          table: suggestion.table,
          severity: 'LOW',
          description: `Consider adding index on ${suggestion.table}.${suggestion.column} for ${suggestion.reason}`,
          fix: `CREATE INDEX IF NOT EXISTS idx_${suggestion.table}_${suggestion.column} ON ${suggestion.table}(${suggestion.column});`
        });
      }
    }
  }

  async generateFixScript() {
    console.log('🔧 Generating Fix Script...');
    
    const criticalFixes = this.issues.filter(i => i.severity === 'HIGH').map(i => i.fix).filter(Boolean);
    const mediumFixes = this.suggestions.filter(s => s.severity === 'MEDIUM').map(s => s.fix).filter(Boolean);
    
    const script = `-- Database Health Fix Script
-- Generated: ${new Date().toISOString()}
-- Run these fixes in order

-- CRITICAL FIXES (Run these first)
${criticalFixes.map(fix => `${fix}\n`).join('')}

-- MEDIUM PRIORITY FIXES
${mediumFixes.map(fix => `${fix}\n`).join('')}

-- PERFORMANCE IMPROVEMENTS (Optional)
${this.suggestions.filter(s => s.type === 'PERFORMANCE_INDEX').map(s => s.fix).join('\n')}

-- Updated_at trigger function (if needed)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to tables that need them
${this.suggestions
  .filter(s => s.type === 'MISSING_UPDATE_TRIGGER')
  .map(s => s.fix)
  .join('\n')}
`;

    const outputPath = path.join(process.cwd(), 'supabase/migrations/database_health_fixes.sql');
    await fs.writeFile(outputPath, script);
    console.log(`✅ Fix script saved to ${outputPath}`);
    
    return script;
  }

  async generateReport() {
    console.log('📋 Generating Health Report...');
    
    await this.analyzeTables();
    await this.analyzeRelationships();
    await this.analyzeDataIntegrity();
    await this.analyzeIndexes();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_tables: this.tables.length,
        critical_issues: this.issues.filter(i => i.severity === 'HIGH').length,
        medium_issues: this.issues.filter(i => i.severity === 'MEDIUM').length,
        suggestions: this.suggestions.filter(s => s.severity === 'LOW').length
      },
      tables: this.tables.map(t => ({ name: t.name, columns: t.columns.length })),
      critical_issues: this.issues.filter(i => i.severity === 'HIGH'),
      medium_issues: this.issues.filter(i => i.severity === 'MEDIUM'),
      suggestions: this.suggestions
    };

    // Generate markdown report
    const markdown = `# 🏥 HPMS Database Health Report

Generated: ${report.timestamp}

## 📊 Executive Summary

- **Total Tables**: ${report.summary.total_tables}
- **🚨 Critical Issues**: ${report.summary.critical_issues}
- **⚠️  Medium Issues**: ${report.summary.medium_issues}  
- **💡 Suggestions**: ${report.suggestions.length}

## 🚨 Critical Issues Requiring Immediate Attention

${report.critical_issues.length === 0 ? '✅ No critical issues found!' : ''}
${report.critical_issues.map(issue => `
### ${issue.type} - ${issue.table}
**Problem**: ${issue.description}

**Solution**:
\`\`\`sql
${issue.fix}
\`\`\`
`).join('')}

## ⚠️ Medium Priority Issues

${report.medium_issues.length === 0 ? '✅ No medium priority issues found!' : ''}
${report.medium_issues.map(issue => `
### ${issue.type} - ${issue.table}
**Problem**: ${issue.description}

**Solution**:
\`\`\`sql
${issue.fix}
\`\`\`
`).join('')}

## 💡 Suggestions for Improvement

${this.suggestions.map(suggestion => `
### ${suggestion.type} - ${suggestion.table || 'General'}
**Suggestion**: ${suggestion.description}

**Implementation**:
\`\`\`sql
${suggestion.fix}
\`\`\`
`).join('')}

## 📋 Database Structure Overview

### Tables Found (${report.tables.length})
${report.tables.map(table => `- **${table.name}** (${table.columns} columns)`).join('\n')}

## 🎯 Recommended Actions

1. **Priority 1**: Fix all critical issues immediately
2. **Priority 2**: Address medium priority issues
3. **Priority 3**: Implement suggested improvements for better performance
4. **Priority 4**: Set up automated health checks

## 🔧 Next Steps

1. Review and run the generated fix script: \`supabase/migrations/database_health_fixes.sql\`
2. Test all changes in a development environment first
3. Schedule regular health checks (weekly/monthly)
4. Monitor query performance after implementing indexes

---
*This report was generated automatically. Always review and test changes before applying to production.*
`;

    const outputPath = path.join(process.cwd(), 'docs/DATABASE_HEALTH_REPORT.md');
    await fs.writeFile(outputPath, markdown);
    
    await this.generateFixScript();
    
    console.log('\n🎯 Database Health Check Complete!');
    console.log(`📊 Found ${report.summary.critical_issues} critical issues`);
    console.log(`💡 Found ${this.suggestions.length} suggestions`);
    console.log('📄 Full report saved to docs/DATABASE_HEALTH_REPORT.md');
    console.log('🔧 Fix script saved to supabase/migrations/database_health_fixes.sql');
    
    return report;
  }
}

// Run the health check
async function main() {
  const checker = new SupabaseHealthChecker();
  
  try {
    await checker.generateReport();
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

main();