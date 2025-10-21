import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Read the SQL migration file
const sqlFilePath = path.join(process.cwd(), 'supabase', 'migrations', '20250930_add_practice_branch_columns.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split the SQL into individual statements (remove comments and split by semicolons)
const sqlStatements = sqlContent
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
  .join('\n')
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0);

console.log('🚀 Executing SQL Migration');
console.log('==========================================\n');
console.log(`📄 Found ${sqlStatements.length} SQL statements to execute\n`);

async function executeSQL(sql) {
  try {
    // Try using rpc endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error, status: response.status };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeMigration() {
  console.log('🔧 Attempting to execute migration...\n');

  for (let i = 0; i < sqlStatements.length; i++) {
    const stmt = sqlStatements[i];
    console.log(`📊 Statement ${i + 1}/${sqlStatements.length}:`);
    console.log(stmt.substring(0, 100) + '...\n');

    const result = await executeSQL(stmt);

    if (result.success) {
      console.log(`✅ Statement ${i + 1} executed successfully\n`);
    } else {
      console.error(`❌ Statement ${i + 1} failed:`);
      console.error(`Status: ${result.status || 'N/A'}`);
      console.error(`Error: ${result.error}\n`);

      // If this is a non-critical error (column already exists), continue
      if (result.error && result.error.includes('already exists')) {
        console.log('⚠️  Column already exists, continuing...\n');
        continue;
      }
    }
  }

  console.log('\n✅ Migration execution completed!');
  console.log('==========================================');
}

executeMigration().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});