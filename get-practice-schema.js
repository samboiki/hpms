import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function getPracticeSchema() {
  try {
    console.log('🔍 Getting practice-related database schema...\n');

    // Get practice tables structure
    const practiceTablesQuery = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND (
          t.table_name LIKE '%practice%' 
          OR t.table_name LIKE '%sms%' 
          OR t.table_name LIKE '%email%'
          OR t.table_name = 'service_plans'
        )
      ORDER BY t.table_name, c.ordinal_position;
    `;

    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: practiceTablesQuery
    });

    if (error) {
      console.error('❌ Error fetching schema:', error);
      return;
    }

    console.log('🏥 PRACTICE-RELATED DATABASE SCHEMA');
    console.log('='.repeat(50));
    console.log('📊 Raw response:', data);

    // Check if data is a string result from the function
    if (typeof data === 'string') {
      console.log('ℹ️  exec_raw_sql returned:', data);
      
      // Try direct query instead
      const { data: directData, error: directError } = await supabase
        .from('information_schema.tables')
        .select(`
          table_name,
          columns:information_schema.columns(
            column_name,
            data_type,
            is_nullable,
            column_default
          )
        `)
        .like('table_name', '%practice%');
        
      if (directError) {
        console.error('❌ Direct query error:', directError);
        return;
      }
      
      console.log('📋 Direct query result:', directData);
      return;
    }

    // Group by table
    const tables = {};
    if (Array.isArray(data)) {
      data.forEach(row => {
        if (!tables[row.table_name]) {
          tables[row.table_name] = [];
        }
        tables[row.table_name].push(row);
      });

      Object.keys(tables).forEach(tableName => {
        console.log(`\n📋 ${tableName.toUpperCase()}`);
        console.log('-'.repeat(40));
        tables[tableName].forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          console.log(`  ${col.column_name.padEnd(25)} ${col.data_type}${maxLen} ${nullable}`);
        });
      });
    }

    // Get current practice data
    console.log('\n\n🏥 CURRENT PRACTICES DATA');
    console.log('='.repeat(50));

    const { data: practices } = await supabase
      .from('practices')
      .select('id, name, slug, contact_email, contact_phone, max_users, max_patients, subscription_tier, status')
      .limit(5);

    if (practices) {
      practices.forEach(practice => {
        console.log(`\n📌 ${practice.name} (${practice.slug})`);
        console.log(`   Email: ${practice.contact_email}`);
        console.log(`   Phone: ${practice.contact_phone}`);
        console.log(`   Limits: ${practice.max_users} users, ${practice.max_patients} patients`);
        console.log(`   Tier: ${practice.subscription_tier}, Status: ${practice.status}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

getPracticeSchema();