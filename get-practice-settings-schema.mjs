import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// PostgreSQL direct connection
const connectionString = `postgresql://postgres.jjxlfunlbyayxwvlpgwt:${process.env.DB_PASSWORD || 'Samosh2025!'}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const { Client } = pg;

async function getSchema() {
  console.log('🔍 Getting practice_settings table schema...\n');

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'practice_settings'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length === 0) {
      console.log('❌ No columns found - table may not exist\n');
      return;
    }

    console.log('✅ practice_settings table structure:\n');
    console.log('═'.repeat(80));

    result.rows.forEach((col, idx) => {
      console.log(`\n${idx + 1}. ${col.column_name}`);
      console.log(`   Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`   Default: ${col.column_default}`);
      }
    });

    console.log('\n' + '═'.repeat(80));

    // Get row count
    const countResult = await client.query('SELECT COUNT(*) FROM practice_settings');
    console.log(`\n📊 Total rows: ${countResult.rows[0].count}\n`);

    // Get sample data
    const sampleResult = await client.query('SELECT * FROM practice_settings LIMIT 2');
    if (sampleResult.rows.length > 0) {
      console.log('📄 Sample data:\n');
      sampleResult.rows.forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
          console.log(`  ${key}: ${displayValue}`);
        });
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

getSchema().catch(console.error);
