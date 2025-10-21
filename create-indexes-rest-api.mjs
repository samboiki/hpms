#!/usr/bin/env node

/**
 * Performance Index Creation via Supabase REST API
 * Uses PostgREST to execute SQL via stored procedure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Read the SQL statements
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251021_add_performance_indexes.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

// Split into individual CREATE INDEX statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.includes('CREATE INDEX'));

console.log('🚀 Creating Performance Indexes via Supabase REST API\n');
console.log(`📊 Found ${statements.length} index creation statements\n`);

async function executeSQL(query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response;
}

async function createIndexes() {
  let successCount = 0;
  let failureCount = 0;
  const results = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const indexMatch = statement.match(/idx_[a-z_]+/);
    const indexName = indexMatch ? indexMatch[0] : `statement_${i + 1}`;

    try {
      console.log(`⏳ Creating: ${indexName}...`);
      await executeSQL(statement);
      console.log(`✅ Success: ${indexName}\n`);

      successCount++;
      results.push({
        index: indexName,
        status: 'success'
      });
    } catch (error) {
      // Check if error is because index already exists or function doesn't exist
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Already exists: ${indexName} (skipping)\n`);
        successCount++;
        results.push({
          index: indexName,
          status: 'already_exists'
        });
      } else if (error.message.includes('Could not find')) {
        // exec function doesn't exist, need to create it or use different method
        console.log(`⚠️  REST API exec function not available\n`);
        failureCount++;
        break;
      } else {
        console.log(`❌ Failed: ${indexName}`);
        console.log(`   Error: ${error.message}\n`);
        failureCount++;
        results.push({
          index: indexName,
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 EXECUTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successful: ${successCount} indexes`);
  console.log(`❌ Failed: ${failureCount} indexes`);
  console.log('='.repeat(70));

  if (failureCount === 0) {
    console.log('\n🎉 All indexes created successfully!');
    console.log('⚡ Query performance should be significantly improved.');
  } else {
    console.log('\n⚠️  Some indexes could not be created.');
    console.log('💡 Alternative: Use Supabase dashboard SQL editor to execute the migration file.');
  }

  console.log('\n📄 Migration file location:');
  console.log(`   ${migrationPath}`);
}

createIndexes()
  .then(() => {
    console.log('\n✨ Process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
