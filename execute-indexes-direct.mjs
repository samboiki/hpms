#!/usr/bin/env node

/**
 * Direct PostgreSQL Execution for Performance Indexes
 * Uses pg library to connect directly to Supabase PostgreSQL
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase connection details
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:Davetoo3@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function executeIndexes() {
  console.log('🚀 Starting Performance Index Creation via Direct PostgreSQL Connection...\n');

  const client = new pg.Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251021_add_performance_indexes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} index creation statements\n`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        // Extract index name for better logging
        const indexMatch = statement.match(/idx_[a-z_]+/);
        const indexName = indexMatch ? indexMatch[0] : `statement_${i + 1}`;

        console.log(`⏳ Creating: ${indexName}...`);
        await client.query(statement);
        console.log(`✅ Success: ${indexName}\n`);

        successCount++;
        results.push({
          index: indexName,
          status: 'success',
          statement: statement.substring(0, 100)
        });
      } catch (error) {
        const indexMatch = statement.match(/idx_[a-z_]+/);
        const indexName = indexMatch ? indexMatch[0] : `statement_${i + 1}`;

        // Check if error is because index already exists
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Already exists: ${indexName} (skipping)\n`);
          successCount++;
          results.push({
            index: indexName,
            status: 'already_exists',
            statement: statement.substring(0, 100)
          });
        } else {
          console.log(`❌ Failed: ${indexName}`);
          console.log(`   Error: ${error.message}\n`);
          failureCount++;
          results.push({
            index: indexName,
            status: 'failed',
            error: error.message,
            statement: statement.substring(0, 100)
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
      console.log('\n📋 Created Indexes:');
      results.filter(r => r.status === 'success' || r.status === 'already_exists').forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.index}`);
      });
    } else {
      console.log('\n⚠️  Some indexes could not be created:');
      results.filter(r => r.status === 'failed').forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.index}: ${r.error}`);
      });
    }

    // Verify indexes were created
    console.log('\n🔍 Verifying created indexes...');
    const verifyQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;

    const { rows: indexes } = await client.query(verifyQuery);
    console.log(`✅ Total indexes found: ${indexes.length}`);
    console.log('\n📋 Index Details:');

    const groupedByTable = {};
    indexes.forEach(idx => {
      if (!groupedByTable[idx.tablename]) {
        groupedByTable[idx.tablename] = [];
      }
      groupedByTable[idx.tablename].push(idx.indexname);
    });

    Object.keys(groupedByTable).sort().forEach(table => {
      console.log(`\n   📁 ${table}:`);
      groupedByTable[table].forEach(idx => {
        console.log(`      - ${idx}`);
      });
    });

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed.');
  }
}

// Execute
executeIndexes()
  .then(() => {
    console.log('\n✨ Index creation process completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
