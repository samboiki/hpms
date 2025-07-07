import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseAnalyzer {
  constructor() {
    this.issues = [];
    this.suggestions = [];
    this.tables = [];
  }

  async loadDatabaseTypes() {
    const typesPath = path.join(process.cwd(), 'src/types/database.types.ts');
    const content = await fs.readFile(typesPath, 'utf-8');
    
    // Extract table names from the types file
    const tableMatches = content.match(/\w+:\s*{[\s\S]*?Relationships:/g);
    
    if (tableMatches) {
      for (const match of tableMatches) {
        const tableName = match.match(/(\w+):\s*{/)[1];
        
        // Extract column information
        const rowSection = match.match(/Row:\s*{([\s\S]*?)}/);
        const relationshipsSection = match.match(/Relationships:\s*\[([\s\S]*?)\]/);
        
        if (rowSection) {
          const columns = this.extractColumns(rowSection[1]);
          const relationships = this.extractRelationships(relationshipsSection ? relationshipsSection[1] : '');
          
          this.tables.push({
            name: tableName,
            columns,
            relationships
          });
        }
      }
    }
  }

  extractColumns(rowContent) {
    const columns = [];
    const columnMatches = rowContent.match(/(\w+):\s*([^\n]+)/g);
    
    if (columnMatches) {
      for (const match of columnMatches) {
        const [, name, type] = match.match(/(\w+):\s*(.+)/);
        const isNullable = type.includes('| null');
        const dataType = type.replace(/\s*\|\s*null/, '').trim();
        
        columns.push({
          name,
          type: dataType,
          nullable: isNullable
        });
      }
    }
    
    return columns;
  }

  extractRelationships(relationshipsContent) {
    const relationships = [];
    const relationshipMatches = relationshipsContent.match(/{[^}]+}/g);
    
    if (relationshipMatches) {
      for (const match of relationshipMatches) {
        const foreignKeyName = match.match(/foreignKeyName:\s*"([^"]+)"/)?.[1];
        const columns = match.match(/columns:\s*\[([^\]]+)\]/)?.[1]?.replace(/"/g, '').split(',').map(s => s.trim());
        const referencedRelation = match.match(/referencedRelation:\s*"([^"]+)"/)?.[1];
        const referencedColumns = match.match(/referencedColumns:\s*\[([^\]]+)\]/)?.[1]?.replace(/"/g, '').split(',').map(s => s.trim());
        
        if (foreignKeyName && columns && referencedRelation) {
          relationships.push({
            foreignKeyName,
            columns,
            referencedRelation,
            referencedColumns
          });
        }
      }
    }
    
    return relationships;
  }

  analyzeTableStructure() {
    console.log('🔍 Analyzing Table Structure...');
    
    for (const table of this.tables) {
      this.checkTableStructure(table);
      this.checkHealthcarePatterns(table);
      this.checkRelationshipIntegrity(table);
    }
  }

  checkTableStructure(table) {
    // Check for primary key (id column)
    const hasId = table.columns.some(col => col.name === 'id');
    if (!hasId) {
      this.issues.push({
        type: 'MISSING_PRIMARY_KEY',
        table: table.name,
        severity: 'HIGH',
        description: `Table ${table.name} has no 'id' primary key column`,
        fix: `ALTER TABLE ${table.name} ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();`
      });
    }

    // Check for audit timestamps
    const hasCreatedAt = table.columns.some(col => col.name === 'created_at');
    const hasUpdatedAt = table.columns.some(col => col.name === 'updated_at');

    if (!hasCreatedAt) {
      this.suggestions.push({
        type: 'MISSING_AUDIT_TIMESTAMP',
        table: table.name,
        severity: 'MEDIUM',
        description: `Table ${table.name} missing created_at for audit trail`,
        fix: `ALTER TABLE ${table.name} ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`
      });
    }

    if (!hasUpdatedAt) {
      this.suggestions.push({
        type: 'MISSING_AUDIT_TIMESTAMP',
        table: table.name,
        severity: 'MEDIUM',
        description: `Table ${table.name} missing updated_at for audit trail`,
        fix: `ALTER TABLE ${table.name} ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_${table.name}_updated_at 
  BEFORE UPDATE ON ${table.name}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
      });
    }
  }

  checkHealthcarePatterns(table) {
    const columnNames = table.columns.map(c => c.name);

    // Healthcare-specific validations
    switch (table.name) {
      case 'patients':
        this.validatePatientsTable(table, columnNames);
        break;
      case 'appointments':
        this.validateAppointmentsTable(table, columnNames);
        break;
      case 'visits':
        this.validateVisitsTable(table, columnNames);
        break;
      case 'medical_records':
        this.validateMedicalRecordsTable(table, columnNames);
        break;
      case 'prescriptions':
        this.validatePrescriptionsTable(table, columnNames);
        break;
      case 'lab_results':
        this.validateLabResultsTable(table, columnNames);
        break;
      case 'billing_invoices':
        this.validateBillingTable(table, columnNames);
        break;
    }
  }

  validatePatientsTable(table, columnNames) {
    const requiredFields = ['first_name', 'last_name', 'date_of_birth'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Patients table missing critical fields: ${missingFields.join(', ')}`,
        fix: missingFields.map(field => {
          const type = field === 'date_of_birth' ? 'DATE' : 'TEXT NOT NULL';
          return `ALTER TABLE patients ADD COLUMN ${field} ${type};`;
        }).join('\n')
      });
    }

    // Check for unique identifiers
    const hasUniqueId = columnNames.some(name => 
      ['id_number', 'medical_record_number', 'patient_number'].includes(name)
    );
    
    if (!hasUniqueId) {
      this.suggestions.push({
        type: 'MISSING_UNIQUE_PATIENT_IDENTIFIER',
        table: table.name,
        severity: 'HIGH',
        description: 'Patients should have a unique medical identifier beyond the UUID',
        fix: `ALTER TABLE patients ADD COLUMN medical_record_number TEXT UNIQUE;
CREATE INDEX idx_patients_medical_record_number ON patients(medical_record_number);`
      });
    }

    // Check for contact information
    const hasContact = columnNames.some(name => 
      ['phone', 'cell_number', 'email', 'contact_number'].includes(name)
    );
    
    if (!hasContact) {
      this.suggestions.push({
        type: 'MISSING_CONTACT_INFO',
        table: table.name,
        severity: 'MEDIUM',
        description: 'Patients table should have contact information',
        fix: `ALTER TABLE patients ADD COLUMN cell_number TEXT;
ALTER TABLE patients ADD COLUMN email TEXT;`
      });
    }
  }

  validateAppointmentsTable(table, columnNames) {
    const requiredFields = ['patient_id', 'appointment_date', 'status'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Appointments table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing appointment fields`
      });
    }

    // Check for appointment workflow fields
    const workflowFields = ['type', 'duration', 'notes'];
    const missingWorkflow = workflowFields.filter(field => !columnNames.includes(field));
    
    if (missingWorkflow.length > 0) {
      this.suggestions.push({
        type: 'MISSING_WORKFLOW_FIELDS',
        table: table.name,
        severity: 'MEDIUM',
        description: `Consider adding appointment workflow fields: ${missingWorkflow.join(', ')}`,
        fix: missingWorkflow.map(field => {
          const type = field === 'duration' ? 'INTEGER DEFAULT 30' : 'TEXT';
          return `ALTER TABLE appointments ADD COLUMN ${field} ${type};`;
        }).join('\n')
      });
    }
  }

  validateVisitsTable(table, columnNames) {
    const requiredFields = ['patient_id', 'visit_date'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Visits table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing visit fields`
      });
    }

    // Check for clinical fields
    const clinicalFields = ['chief_complaint', 'diagnosis', 'treatment_plan'];
    const missingClinical = clinicalFields.filter(field => !columnNames.includes(field));
    
    if (missingClinical.length > 0) {
      this.suggestions.push({
        type: 'MISSING_CLINICAL_FIELDS',
        table: table.name,
        severity: 'MEDIUM',
        description: `Consider adding clinical documentation fields: ${missingClinical.join(', ')}`,
        fix: missingClinical.map(field => 
          `ALTER TABLE visits ADD COLUMN ${field} TEXT;`
        ).join('\n')
      });
    }
  }

  validateMedicalRecordsTable(table, columnNames) {
    const requiredFields = ['patient_id', 'record_type'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Medical records table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing medical record fields`
      });
    }
  }

  validatePrescriptionsTable(table, columnNames) {
    const requiredFields = ['patient_id', 'medication_name'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Prescriptions table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing prescription fields`
      });
    }
  }

  validateLabResultsTable(table, columnNames) {
    const requiredFields = ['patient_id', 'test_name', 'result_value'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Lab results table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing lab result fields`
      });
    }
  }

  validateBillingTable(table, columnNames) {
    const requiredFields = ['patient_id', 'amount', 'status'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      this.issues.push({
        type: 'MISSING_REQUIRED_HEALTHCARE_FIELDS',
        table: table.name,
        severity: 'HIGH',
        description: `Billing table missing critical fields: ${missingFields.join(', ')}`,
        fix: `-- Add missing billing fields`
      });
    }
  }

  checkRelationshipIntegrity(table) {
    // Check if foreign key columns exist but no relationship is defined
    const foreignKeyColumns = table.columns.filter(col => 
      col.name.endsWith('_id') && col.name !== 'id'
    );

    for (const fkCol of foreignKeyColumns) {
      const hasRelationship = table.relationships.some(rel => 
        rel.columns.includes(fkCol.name)
      );

      if (!hasRelationship) {
        this.issues.push({
          type: 'MISSING_FOREIGN_KEY_CONSTRAINT',
          table: table.name,
          severity: 'HIGH',
          description: `Column ${fkCol.name} in ${table.name} appears to be a foreign key but has no constraint`,
          fix: `-- Add foreign key constraint for ${table.name}.${fkCol.name}
-- First, identify the referenced table and add the constraint:
-- ALTER TABLE ${table.name} ADD CONSTRAINT fk_${table.name}_${fkCol.name} 
--   FOREIGN KEY (${fkCol.name}) REFERENCES referenced_table(id);`
        });
      }
    }

    // Check for broken relationship references
    for (const rel of table.relationships) {
      const referencedTableExists = this.tables.some(t => t.name === rel.referencedRelation);
      
      if (!referencedTableExists) {
        this.issues.push({
          type: 'BROKEN_FOREIGN_KEY_REFERENCE',
          table: table.name,
          severity: 'HIGH',
          description: `Table ${table.name} references non-existent table ${rel.referencedRelation}`,
          fix: `-- Create missing table ${rel.referencedRelation} or fix the reference`
        });
      }
    }
  }

  generateHealthcareIndexes() {
    console.log('📊 Generating Healthcare-Specific Index Recommendations...');
    
    const healthcareIndexes = [
      // Patient lookups
      { table: 'patients', columns: ['last_name', 'first_name'], reason: 'Name-based patient searches' },
      { table: 'patients', columns: ['date_of_birth'], reason: 'Age-based queries and validation' },
      { table: 'patients', columns: ['id_number'], reason: 'ID number lookups', unique: true },
      
      // Appointment management
      { table: 'appointments', columns: ['appointment_date'], reason: 'Daily schedule views' },
      { table: 'appointments', columns: ['patient_id', 'appointment_date'], reason: 'Patient appointment history' },
      { table: 'appointments', columns: ['doctor_id', 'appointment_date'], reason: 'Doctor schedule management' },
      { table: 'appointments', columns: ['status'], reason: 'Appointment status filtering' },
      
      // Clinical workflows
      { table: 'visits', columns: ['patient_id', 'visit_date'], reason: 'Patient visit history' },
      { table: 'visits', columns: ['visit_date'], reason: 'Daily patient load analysis' },
      { table: 'medical_records', columns: ['patient_id'], reason: 'Patient medical history' },
      { table: 'medical_records', columns: ['visit_id'], reason: 'Visit-specific records' },
      
      // Lab and diagnostics
      { table: 'lab_results', columns: ['patient_id', 'test_date'], reason: 'Patient lab history' },
      { table: 'lab_results', columns: ['status'], reason: 'Pending results tracking' },
      
      // Billing and financial
      { table: 'billing_invoices', columns: ['patient_id'], reason: 'Patient billing history' },
      { table: 'billing_invoices', columns: ['status'], reason: 'Payment status tracking' },
      { table: 'billing_invoices', columns: ['created_at'], reason: 'Financial reporting by date' },
      
      // Prescriptions
      { table: 'prescriptions', columns: ['patient_id'], reason: 'Patient medication history' },
      { table: 'prescriptions', columns: ['status'], reason: 'Active prescription tracking' }
    ];

    for (const idx of healthcareIndexes) {
      const table = this.tables.find(t => t.name === idx.table);
      
      if (table) {
        const hasAllColumns = idx.columns.every(col => 
          table.columns.some(c => c.name === col)
        );
        
        if (hasAllColumns) {
          const indexName = `idx_${idx.table}_${idx.columns.join('_')}`;
          const uniqueClause = idx.unique ? 'UNIQUE ' : '';
          
          this.suggestions.push({
            type: 'HEALTHCARE_PERFORMANCE_INDEX',
            table: idx.table,
            severity: 'LOW',
            description: `${idx.reason}: Index on ${idx.columns.join(', ')}`,
            fix: `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${indexName} ON ${idx.table}(${idx.columns.join(', ')});`
          });
        }
      }
    }
  }

  async generateReport() {
    console.log('🏥 Analyzing HPMS Database Structure...');
    
    await this.loadDatabaseTypes();
    this.analyzeTableStructure();
    this.generateHealthcareIndexes();

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_tables: this.tables.length,
        critical_issues: this.issues.filter(i => i.severity === 'HIGH').length,
        medium_issues: this.issues.filter(i => i.severity === 'MEDIUM').length,
        suggestions: this.suggestions.length,
        tables_analyzed: this.tables.map(t => t.name)
      },
      critical_issues: this.issues.filter(i => i.severity === 'HIGH'),
      medium_issues: this.issues.filter(i => i.severity === 'MEDIUM'),
      suggestions: this.suggestions,
      tables: this.tables.map(t => ({
        name: t.name,
        columns: t.columns.length,
        relationships: t.relationships.length,
        has_id: t.columns.some(c => c.name === 'id'),
        has_created_at: t.columns.some(c => c.name === 'created_at'),
        has_updated_at: t.columns.some(c => c.name === 'updated_at')
      }))
    };

    // Generate markdown report
    await this.generateMarkdownReport(report);
    
    // Generate fix script
    await this.generateFixScript();

    console.log('\n🎯 Database Analysis Complete!');
    console.log(`📊 Analyzed ${report.summary.total_tables} tables`);
    console.log(`🚨 Found ${report.summary.critical_issues} critical issues`);
    console.log(`💡 Generated ${report.summary.suggestions} suggestions`);
    
    return report;
  }

  async generateMarkdownReport(report) {
    const markdown = `# 🏥 HPMS Database Health & Structure Report

Generated: ${report.timestamp}

## 📊 Executive Summary

- **Tables Analyzed**: ${report.summary.total_tables}
- **🚨 Critical Issues**: ${report.summary.critical_issues} (require immediate attention)
- **⚠️ Medium Issues**: ${report.summary.medium_issues}
- **💡 Improvement Suggestions**: ${report.suggestions.length}

## 🗂️ Tables Found

${report.tables.map(table => `
### ${table.name}
- **Columns**: ${table.columns}
- **Relationships**: ${table.relationships}
- **Has ID**: ${table.has_id ? '✅' : '❌'}
- **Has created_at**: ${table.has_created_at ? '✅' : '❌'}
- **Has updated_at**: ${table.has_updated_at ? '✅' : '❌'}
`).join('')}

## 🚨 Critical Issues (${report.critical_issues.length})

${report.critical_issues.length === 0 ? '✅ **No critical issues found!** Your database structure is solid.' : ''}

${report.critical_issues.map(issue => `
### ❌ ${issue.type} - \`${issue.table}\`

**Problem**: ${issue.description}

**Fix Required**:
\`\`\`sql
${issue.fix}
\`\`\`

---
`).join('')}

## ⚠️ Medium Priority Issues (${report.medium_issues.length})

${report.medium_issues.length === 0 ? '✅ **No medium priority issues found!**' : ''}

${report.medium_issues.map(issue => `
### ⚠️ ${issue.type} - \`${issue.table}\`

**Issue**: ${issue.description}

**Recommended Fix**:
\`\`\`sql
${issue.fix}
\`\`\`

---
`).join('')}

## 💡 Improvement Suggestions (${report.suggestions.length})

These suggestions will improve performance, maintainability, and healthcare workflow efficiency:

${this.suggestions.map(suggestion => `
### 💡 ${suggestion.type} - \`${suggestion.table || 'General'}\`

**Suggestion**: ${suggestion.description}

**Implementation**:
\`\`\`sql
${suggestion.fix}
\`\`\`

---
`).join('')}

## 🎯 Healthcare-Specific Recommendations

### Data Integrity & Audit Trail
1. **Audit Timestamps**: Ensure all tables have \`created_at\` and \`updated_at\` columns
2. **Update Triggers**: Implement automatic \`updated_at\` triggers for all tables
3. **Soft Deletes**: Consider adding \`deleted_at\` for important healthcare records

### Performance Optimization
1. **Patient Lookups**: Index on name fields and ID numbers
2. **Appointment Scheduling**: Index on date and doctor fields
3. **Medical History**: Index on patient_id and date fields

### Healthcare Compliance
1. **Data Retention**: Plan for long-term storage of medical records
2. **Access Logging**: Track who accesses patient data
3. **Backup Strategy**: Ensure regular backups for critical healthcare data

## 🔧 Implementation Priority

### Priority 1: Critical Issues
- Fix missing primary keys
- Add missing foreign key constraints
- Resolve broken relationships

### Priority 2: Healthcare Essentials
- Add audit timestamps
- Implement update triggers
- Add missing patient identification fields

### Priority 3: Performance & Usability
- Create recommended indexes
- Add workflow enhancement fields
- Optimize query patterns

## 📋 Next Steps

1. **Review & Test**: Examine the generated fix script before applying
2. **Backup First**: Always backup before making schema changes
3. **Apply Fixes**: Run the migration script in development first
4. **Monitor Performance**: Track query performance after index creation
5. **Regular Health Checks**: Schedule monthly database health reviews

---

🏥 **Healthcare Data is Critical** - Always test changes thoroughly and maintain proper backups.

*Report generated by HPMS Database Health Analyzer*
`;

    const outputPath = path.join(process.cwd(), 'docs/DATABASE_HEALTH_REPORT.md');
    await fs.writeFile(outputPath, markdown);
    console.log(`✅ Detailed report saved to docs/DATABASE_HEALTH_REPORT.md`);
  }

  async generateFixScript() {
    const criticalFixes = this.issues.filter(i => i.severity === 'HIGH');
    const mediumFixes = this.issues.filter(i => i.severity === 'MEDIUM');
    const improvements = this.suggestions.filter(s => s.type !== 'HEALTHCARE_PERFORMANCE_INDEX');
    const indexes = this.suggestions.filter(s => s.type === 'HEALTHCARE_PERFORMANCE_INDEX');

    const script = `-- 🏥 HPMS Database Health Fix Script
-- Generated: ${new Date().toISOString()}
-- 
-- ⚠️  IMPORTANT: Review and test in development before applying to production!
-- 📋 Always backup your database before running this script!

-- =============================================================================
-- 🚨 CRITICAL FIXES (Run these first - they fix data integrity issues)
-- =============================================================================

${criticalFixes.length === 0 ? '-- ✅ No critical issues found!' : ''}
${criticalFixes.map(fix => `-- ${fix.type} - ${fix.table}
-- ${fix.description}
${fix.fix}

`).join('')}

-- =============================================================================
-- ⚠️  MEDIUM PRIORITY FIXES (Audit trail and missing fields)
-- =============================================================================

${mediumFixes.length === 0 ? '-- ✅ No medium priority issues found!' : ''}
${mediumFixes.map(fix => `-- ${fix.type} - ${fix.table}
-- ${fix.description}
${fix.fix}

`).join('')}

-- =============================================================================
-- 🔧 GENERAL IMPROVEMENTS (Enhanced functionality)
-- =============================================================================

${improvements.map(suggestion => `-- ${suggestion.type} - ${suggestion.table || 'General'}
-- ${suggestion.description}
${suggestion.fix}

`).join('')}

-- =============================================================================
-- 🔄 UTILITY FUNCTIONS (Triggers and automated updates)
-- =============================================================================

-- Create or update the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- 📊 PERFORMANCE INDEXES (Healthcare-optimized queries)
-- =============================================================================

-- These indexes are optimized for common healthcare workflows:
-- Patient searches, appointment scheduling, medical history, billing

${indexes.map(index => `-- ${index.description}
${index.fix}

`).join('')}

-- =============================================================================
-- ✅ VERIFICATION QUERIES (Run these to verify the fixes)
-- =============================================================================

-- Check for tables without primary keys
SELECT table_name 
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = t.table_name 
      AND c.column_name = 'id'
  );

-- Check for tables without audit timestamps
SELECT table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = t.table_name AND column_name = 'created_at') as has_created_at,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = t.table_name AND column_name = 'updated_at') as has_updated_at
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 🎯 Success! Your HPMS database should now be optimized for healthcare workflows.
`;

    const outputPath = path.join(process.cwd(), 'supabase/migrations/database_health_fixes.sql');
    await fs.writeFile(outputPath, script);
    console.log(`✅ Fix script saved to supabase/migrations/database_health_fixes.sql`);
  }
}

// Run the analysis
async function main() {
  const analyzer = new DatabaseAnalyzer();
  
  try {
    await analyzer.generateReport();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

main();