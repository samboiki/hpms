import pg from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseHealthChecker {
  constructor() {
    this.client = new Client({
      connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
      ssl: { rejectUnauthorized: false }
    });
    this.issues = [];
    this.suggestions = [];
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect:', error.message);
      throw error;
    }
  }

  async disconnect() {
    await this.client.end();
  }

  // Analyze table structure and relationships
  async analyzeTables() {
    console.log('\n🔍 Analyzing Tables...');
    
    const query = `
      SELECT 
        t.table_name,
        t.table_type,
        array_agg(
          json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default,
            'character_maximum_length', c.character_maximum_length,
            'is_primary', EXISTS (
              SELECT 1 FROM information_schema.key_column_usage k
              JOIN information_schema.table_constraints tc 
                ON k.constraint_name = tc.constraint_name
              WHERE k.table_name = t.table_name 
                AND k.column_name = c.column_name
                AND tc.constraint_type = 'PRIMARY KEY'
            ),
            'has_foreign_key', EXISTS (
              SELECT 1 FROM information_schema.key_column_usage k
              JOIN information_schema.table_constraints tc 
                ON k.constraint_name = tc.constraint_name
              WHERE k.table_name = t.table_name 
                AND k.column_name = c.column_name
                AND tc.constraint_type = 'FOREIGN KEY'
            )
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name, t.table_type
      ORDER BY t.table_name;
    `;

    const { rows } = await this.client.query(query);
    
    // Check for common issues
    for (const table of rows) {
      this.checkTableIssues(table);
    }
    
    return rows;
  }

  checkTableIssues(table) {
    const tableName = table.table_name;
    const columns = table.columns;
    
    // Check for missing primary key
    const hasPrimaryKey = columns.some(col => col.is_primary);
    if (!hasPrimaryKey) {
      this.issues.push({
        type: 'MISSING_PRIMARY_KEY',
        table: tableName,
        severity: 'HIGH',
        description: `Table ${tableName} has no primary key`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();`
      });
    }

    // Check for missing created_at/updated_at
    const hasCreatedAt = columns.some(col => col.column_name === 'created_at');
    const hasUpdatedAt = columns.some(col => col.column_name === 'updated_at');
    
    if (!hasCreatedAt) {
      this.suggestions.push({
        type: 'MISSING_TIMESTAMP',
        table: tableName,
        severity: 'MEDIUM',
        description: `Table ${tableName} missing created_at timestamp`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`
      });
    }
    
    if (!hasUpdatedAt) {
      this.suggestions.push({
        type: 'MISSING_TIMESTAMP',
        table: tableName,
        severity: 'MEDIUM',
        description: `Table ${tableName} missing updated_at timestamp`,
        fix: `ALTER TABLE ${tableName} ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();`
      });
    }

    // Check for nullable foreign keys that should probably be NOT NULL
    const foreignKeys = columns.filter(col => col.has_foreign_key && col.is_nullable === 'YES');
    for (const fk of foreignKeys) {
      if (!['doctor_id', 'nurse_id', 'optional_'].some(pattern => fk.column_name.includes(pattern))) {
        this.suggestions.push({
          type: 'NULLABLE_FOREIGN_KEY',
          table: tableName,
          column: fk.column_name,
          severity: 'LOW',
          description: `Foreign key ${fk.column_name} in ${tableName} is nullable - consider if this is intentional`,
          fix: `-- Review if ${fk.column_name} should be NOT NULL`
        });
      }
    }
  }

  // Analyze foreign key relationships
  async analyzeForeignKeys() {
    console.log('\n🔗 Analyzing Foreign Key Relationships...');
    
    const query = `
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;

    const { rows } = await this.client.query(query);
    
    // Check for broken references
    for (const fk of rows) {
      await this.checkForeignKeyIntegrity(fk);
    }
    
    return rows;
  }

  async checkForeignKeyIntegrity(fk) {
    // Check if there are orphaned records
    const orphanQuery = `
      SELECT COUNT(*) as orphaned_count
      FROM ${fk.source_table} s
      LEFT JOIN ${fk.target_table} t ON s.${fk.source_column} = t.${fk.target_column}
      WHERE s.${fk.source_column} IS NOT NULL 
        AND t.${fk.target_column} IS NULL;
    `;

    try {
      const { rows } = await this.client.query(orphanQuery);
      const orphanedCount = parseInt(rows[0].orphaned_count);
      
      if (orphanedCount > 0) {
        this.issues.push({
          type: 'ORPHANED_RECORDS',
          severity: 'HIGH',
          description: `${orphanedCount} orphaned records in ${fk.source_table}.${fk.source_column} referencing ${fk.target_table}.${fk.target_column}`,
          fix: `-- Clean up orphaned records:\nDELETE FROM ${fk.source_table} WHERE ${fk.source_column} NOT IN (SELECT ${fk.target_column} FROM ${fk.target_table} WHERE ${fk.target_column} IS NOT NULL);`
        });
      }
    } catch (error) {
      this.issues.push({
        type: 'FK_CHECK_ERROR',
        severity: 'HIGH',
        description: `Cannot verify foreign key integrity for ${fk.source_table}.${fk.source_column} -> ${fk.target_table}.${fk.target_column}: ${error.message}`
      });
    }
  }

  // Analyze indexes
  async analyzeIndexes() {
    console.log('\n📊 Analyzing Indexes...');
    
    const query = `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef,
        CASE WHEN indexdef LIKE '%UNIQUE%' THEN true ELSE false END as is_unique
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;

    const { rows } = await this.client.query(query);
    
    // Check for missing indexes on foreign keys
    const fkQuery = `
      SELECT 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `;

    const { rows: foreignKeys } = await this.client.query(fkQuery);
    
    for (const fk of foreignKeys) {
      const hasIndex = rows.some(idx => 
        idx.tablename === fk.table_name && 
        idx.indexdef.includes(fk.column_name)
      );
      
      if (!hasIndex) {
        this.suggestions.push({
          type: 'MISSING_FK_INDEX',
          table: fk.table_name,
          column: fk.column_name,
          severity: 'MEDIUM',
          description: `Foreign key ${fk.table_name}.${fk.column_name} lacks an index`,
          fix: `CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON ${fk.table_name}(${fk.column_name});`
        });
      }
    }
    
    return rows;
  }

  // Analyze functions and triggers
  async analyzeFunctionsAndTriggers() {
    console.log('\n⚙️  Analyzing Functions and Triggers...');
    
    // Functions
    const funcQuery = `
      SELECT
        p.proname as function_name,
        pg_get_function_result(p.oid) as return_type,
        pg_get_function_arguments(p.oid) as arguments,
        l.lanname as language,
        p.prosrc as source_code
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname;
    `;

    const { rows: functions } = await this.client.query(funcQuery);

    // Triggers
    const triggerQuery = `
      SELECT
        t.trigger_name,
        t.event_manipulation,
        t.event_object_table,
        t.action_timing,
        t.action_statement
      FROM information_schema.triggers t
      WHERE t.trigger_schema = 'public'
      ORDER BY t.event_object_table, t.trigger_name;
    `;

    const { rows: triggers } = await this.client.query(triggerQuery);

    // Check for missing updated_at triggers
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
    `;

    const { rows: tables } = await this.client.query(tablesQuery);
    
    for (const table of tables) {
      const tableName = table.table_name;
      
      // Check if table has updated_at column
      const hasUpdatedAt = await this.client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = 'updated_at'
      `, [tableName]);

      if (hasUpdatedAt.rows.length > 0) {
        // Check if there's an updated_at trigger
        const hasTrigger = triggers.some(trigger => 
          trigger.event_object_table === tableName &&
          trigger.action_statement.includes('updated_at')
        );

        if (!hasTrigger) {
          this.suggestions.push({
            type: 'MISSING_UPDATE_TRIGGER',
            table: tableName,
            severity: 'HIGH',
            description: `Table ${tableName} has updated_at column but no trigger to update it`,
            fix: `
-- Create trigger for ${tableName}
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_${tableName}_updated_at 
  BEFORE UPDATE ON ${tableName}
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();`
          });
        }
      }
    }

    return { functions, triggers };
  }

  // Check Row Level Security
  async analyzeRLS() {
    console.log('\n🔒 Analyzing Row Level Security...');
    
    const query = `
      SELECT
        tablename,
        rowsecurity,
        hasrlspolicy
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    const { rows } = await this.client.query(query);
    
    for (const table of rows) {
      if (!table.rowsecurity) {
        this.suggestions.push({
          type: 'RLS_DISABLED',
          table: table.tablename,
          severity: 'MEDIUM',
          description: `Table ${table.tablename} has RLS disabled`,
          fix: `ALTER TABLE ${table.tablename} ENABLE ROW LEVEL SECURITY;`
        });
      } else if (!table.hasrlspolicy) {
        this.issues.push({
          type: 'NO_RLS_POLICIES',
          table: table.tablename,
          severity: 'HIGH',
          description: `Table ${table.tablename} has RLS enabled but no policies defined`,
          fix: `-- Add appropriate RLS policies for ${table.tablename}`
        });
      }
    }
    
    return rows;
  }

  // Generate comprehensive report
  async generateReport() {
    console.log('\n📋 Generating Database Health Report...');
    
    const tables = await this.analyzeTables();
    const foreignKeys = await this.analyzeForeignKeys();
    const indexes = await this.analyzeIndexes();
    const { functions, triggers } = await this.analyzeFunctionsAndTriggers();
    const rlsInfo = await this.analyzeRLS();

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_tables: tables.length,
        total_functions: functions.length,
        total_triggers: triggers.length,
        total_foreign_keys: foreignKeys.length,
        total_indexes: indexes.length,
        critical_issues: this.issues.filter(i => i.severity === 'HIGH').length,
        suggestions: this.suggestions.length
      },
      critical_issues: this.issues.filter(i => i.severity === 'HIGH'),
      medium_issues: this.issues.filter(i => i.severity === 'MEDIUM'),
      suggestions: this.suggestions,
      tables,
      foreign_keys: foreignKeys,
      indexes,
      functions,
      triggers,
      rls_status: rlsInfo
    };

    // Save to file
    const outputPath = path.join(process.cwd(), 'docs/database-health-report.json');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    await this.generateMarkdownReport(report);
    
    return report;
  }

  async generateMarkdownReport(report) {
    const markdown = `# Database Health Report
Generated: ${report.timestamp}

## 📊 Summary
- **Tables**: ${report.summary.total_tables}
- **Functions**: ${report.summary.total_functions}
- **Triggers**: ${report.summary.total_triggers}
- **Foreign Keys**: ${report.summary.total_foreign_keys}
- **Indexes**: ${report.summary.total_indexes}
- **Critical Issues**: ${report.summary.critical_issues}
- **Suggestions**: ${report.summary.suggestions}

## 🚨 Critical Issues (${report.critical_issues.length})

${report.critical_issues.map(issue => `
### ${issue.type} - ${issue.table || 'Global'}
**Severity**: ${issue.severity}
**Description**: ${issue.description}

**Fix**:
\`\`\`sql
${issue.fix || 'Manual review required'}
\`\`\`
`).join('')}

## ⚠️ Medium Priority Issues (${report.medium_issues.length})

${report.medium_issues.map(issue => `
### ${issue.type} - ${issue.table || 'Global'}
**Description**: ${issue.description}

**Fix**:
\`\`\`sql
${issue.fix || 'Manual review required'}
\`\`\`
`).join('')}

## 💡 Suggestions for Improvement (${report.suggestions.length})

${report.suggestions.map(suggestion => `
### ${suggestion.type} - ${suggestion.table || 'Global'}
**Description**: ${suggestion.description}

**Fix**:
\`\`\`sql
${suggestion.fix || 'Manual review required'}
\`\`\`
`).join('')}

## 📋 Database Structure

### Tables (${report.tables.length})
${report.tables.map(table => `
- **${table.table_name}** (${table.columns.length} columns)
  - Primary Key: ${table.columns.find(c => c.is_primary)?.column_name || 'MISSING'}
  - Foreign Keys: ${table.columns.filter(c => c.has_foreign_key).length}
`).join('')}

### Functions (${report.functions.length})
${report.functions.map(func => `- ${func.function_name}(${func.arguments})`).join('\n')}

### Triggers (${report.triggers.length})
${report.triggers.map(trigger => `- ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.action_timing} ${trigger.event_manipulation})`).join('\n')}
`;

    const outputPath = path.join(process.cwd(), 'docs/DATABASE_HEALTH_REPORT.md');
    await fs.writeFile(outputPath, markdown);
    console.log(`✅ Report saved to ${outputPath}`);
  }
}

// Run the health check
async function main() {
  const checker = new DatabaseHealthChecker();
  
  try {
    await checker.connect();
    const report = await checker.generateReport();
    
    console.log('\n🎯 Database Health Check Complete!');
    console.log(`📊 Found ${report.summary.critical_issues} critical issues`);
    console.log(`💡 Found ${report.summary.suggestions} suggestions`);
    console.log('📄 Full report saved to docs/DATABASE_HEALTH_REPORT.md');
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  } finally {
    await checker.disconnect();
  }
}

main();