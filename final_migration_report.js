import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Database credentials
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return { exists: false, count: 0, error: error.message };
    } else {
      return { exists: true, count: count || 0, error: null };
    }
  } catch (err) {
    return { exists: false, count: 0, error: err.message };
  }
}

async function checkColumn(tableName, columnName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(1);
    
    if (error && (error.message.includes(columnName) || error.code === '42703')) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function generateReport() {
  log('=' .repeat(80), 'bright');
  log('🔍 DATABASE MIGRATION VERIFICATION REPORT', 'bright');
  log('=' .repeat(80), 'bright');
  log(`🕒 Generated: ${new Date().toISOString()}`, 'cyan');
  log(`🔗 Database: ${SUPABASE_URL}`, 'cyan');
  log('');

  // Check all tables
  const tables = ['practices', 'users', 'patients', 'appointments', 'visits', 'medical_records'];
  const tableStatus = {};
  
  log('📋 TABLE STATUS REPORT', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  for (const table of tables) {
    const status = await checkTable(table);
    tableStatus[table] = status;
    
    if (status.exists) {
      log(`✓ ${table.padEnd(20)} ${status.count.toString().padStart(6)} rows`, 'green');
    } else {
      log(`✗ ${table.padEnd(20)} ERROR: ${status.error}`, 'red');
    }
  }
  
  log('');
  log('🔍 COLUMN ANALYSIS', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  const columnChecks = [
    { table: 'users', column: 'practice_id', required: true },
    { table: 'patients', column: 'practice_id', required: true },
    { table: 'appointments', column: 'practice_id', required: true },
    { table: 'appointments', column: 'ready_status', required: false, migration: true }
  ];
  
  const missingColumns = [];
  
  for (const check of columnChecks) {
    if (tableStatus[check.table]?.exists) {
      const hasColumn = await checkColumn(check.table, check.column);
      const status = hasColumn ? '✓' : '✗';
      const color = hasColumn ? 'green' : (check.migration ? 'yellow' : 'red');
      log(`${status} ${check.table}.${check.column}`, color);
      
      if (!hasColumn && check.migration) {
        missingColumns.push(check);
      }
    }
  }
  
  // Check practices data
  log('');
  log('🏥 PRACTICES OVERVIEW', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  if (tableStatus.practices?.exists && tableStatus.practices.count > 0) {
    try {
      const { data: practices, error } = await supabase
        .from('practices')
        .select('id, name, slug')
        .order('name');
      
      if (!error && practices) {
        practices.forEach(practice => {
          log(`• ${practice.name} (${practice.slug})`, 'cyan');
          log(`  ID: ${practice.id}`, 'blue');
        });
      }
    } catch (err) {
      log('Unable to fetch practice details', 'red');
    }
  } else {
    log('No practices found', 'red');
  }
  
  // Data distribution
  log('');
  log('📊 DATA DISTRIBUTION', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  try {
    // Check patients by practice
    const { data: patientsByPractice, error: patientsError } = await supabase
      .from('patients')
      .select('practice_id')
      .not('practice_id', 'is', null);
    
    if (!patientsError && patientsByPractice) {
      const practiceGroups = patientsByPractice.reduce((acc, p) => {
        acc[p.practice_id] = (acc[p.practice_id] || 0) + 1;
        return acc;
      }, {});
      
      log('Patients by practice:', 'cyan');
      Object.entries(practiceGroups).forEach(([practiceId, count]) => {
        log(`  ${practiceId}: ${count} patients`, 'blue');
      });
    }
    
    // Check orphaned data
    const { count: orphanPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .is('practice_id', null);
    
    if (orphanPatients > 0) {
      log(`⚠️ ${orphanPatients} patients without practice_id`, 'yellow');
    } else {
      log('✓ All patients have practice_id assigned', 'green');
    }
    
  } catch (err) {
    log('Unable to analyze data distribution', 'red');
  }
  
  // Migration recommendations
  log('');
  log('🔧 MIGRATION RECOMMENDATIONS', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  if (missingColumns.length === 0) {
    log('✅ No migrations needed! Database is up to date.', 'green');
  } else {
    log('📋 Required migrations:', 'cyan');
    
    if (missingColumns.some(c => c.table === 'appointments' && c.column === 'ready_status')) {
      log('');
      log('1. Add ready_status column to appointments', 'yellow');
      log('   File: 20250602_add_ready_status.sql', 'blue');
      log('   Purpose: Add appointment readiness tracking', 'blue');
      log('   Impact: Low - adds new column with default value', 'green');
    }
  }
  
  // Instructions
  log('');
  log('📖 EXECUTION INSTRUCTIONS', 'yellow');
  log('-' .repeat(50), 'yellow');
  
  if (missingColumns.length > 0) {
    log('To apply migrations:', 'cyan');
    log('1. 🌐 Open Supabase SQL Editor:', 'blue');
    log(`   ${SUPABASE_URL.replace('https://', 'https://app.')}/sql`, 'blue');
    log('');
    log('2. 📂 Copy migration SQL from:', 'blue');
    log('   /home/happy/projects/hpms/supabase/migrations/20250602_add_ready_status.sql', 'blue');
    log('');
    log('3. ▶️ Paste and execute the SQL', 'blue');
    log('');
    log('4. ✅ Verify by running this tool again', 'blue');
    log('   node final_migration_report.js', 'blue');
  }
  
  // Create migration instructions file
  const instructionsFile = '/home/happy/projects/hpms/MIGRATION_INSTRUCTIONS.md';
  const instructions = `# Database Migration Instructions

## Current State (${new Date().toISOString()})

### Tables Status
${tables.map(table => {
  const status = tableStatus[table];
  return `- ${status.exists ? '✅' : '❌'} **${table}**: ${status.exists ? `${status.count} rows` : `Error: ${status.error}`}`;
}).join('\n')}

### Missing Columns
${missingColumns.length === 0 ? '✅ All required columns present' : missingColumns.map(col => `- ⚠️ **${col.table}.${col.column}**`).join('\n')}

## Required Actions

${missingColumns.length === 0 ? 
  '✅ **No migrations needed!** Database is up to date.' :
  `### Apply Migration: 20250602_add_ready_status.sql

1. **Open Supabase SQL Editor**
   - URL: ${SUPABASE_URL.replace('https://', 'https://app.')}/sql

2. **Copy Migration SQL**
   - File: \`/home/happy/projects/hpms/supabase/migrations/20250602_add_ready_status.sql\`

3. **Execute the SQL**
   - Paste the migration content
   - Click "Run" to execute

4. **Verify Changes**
   - Run verification tool: \`node final_migration_report.js\`

### Migration Content Preview
The migration will:
- Add \`ready_status\` column to appointments table
- Set default value to 'not_ready'
- Create ENUM type for status values
- Update existing appointments (if any) with default value`
}

## Rollback Instructions

If you need to rollback the changes:

\`\`\`sql
-- Remove ready_status column
ALTER TABLE appointments DROP COLUMN IF EXISTS ready_status;

-- Drop the enum type
DROP TYPE IF EXISTS appointment_ready_status;
\`\`\`

## Next Steps

1. Apply the migration(s) as instructed above
2. Test your application functionality
3. Run the verification tool again to confirm success
4. Update your application code to use the new features

---
*Generated by HPMS Migration Tool on ${new Date().toISOString()}*
`;
  
  fs.writeFileSync(instructionsFile, instructions);
  
  log('');
  log('📄 MIGRATION INSTRUCTIONS SAVED', 'yellow');
  log('-' .repeat(50), 'yellow');
  log(`Instructions saved to: ${instructionsFile}`, 'green');
  
  log('');
  log('=' .repeat(80), 'bright');
  log('🎯 SUMMARY', 'bright');
  log('=' .repeat(80), 'bright');
  
  if (missingColumns.length === 0) {
    log('✅ Database is ready - no migrations needed!', 'green');
  } else {
    log(`⚠️ ${missingColumns.length} migration(s) required`, 'yellow');
    log('📖 Follow the instructions above or in MIGRATION_INSTRUCTIONS.md', 'cyan');
  }
  
  log('🔧 Tools available:', 'blue');
  log('  - node final_migration_report.js (this tool)', 'blue');
  log('  - MIGRATION_INSTRUCTIONS.md (detailed guide)', 'blue');
  log('');
}

// Run the report generator
generateReport().catch((error) => {
  console.error('\n❌ Error generating report:', error);
  process.exit(1);
});