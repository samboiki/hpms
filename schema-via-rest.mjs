import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getSchema() {
  console.log('🔍 Getting practice_settings table schema via REST API...\n');

  try {
    // Get some sample data to infer structure
    const { data, error } = await supabase
      .from('practice_settings')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Error querying practice_settings:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  Table exists but has no data\n');
      return;
    }

    console.log('✅ practice_settings table EXISTS\n');
    console.log('═'.repeat(80));
    console.log('\n📋 Columns detected from data:\n');

    // Get column names from first row
    const sampleRow = data[0];
    const columns = Object.keys(sampleRow);

    columns.forEach((colName, idx) => {
      const value = sampleRow[colName];
      const type = typeof value;
      const jsType = value === null ? 'null' :
                     Array.isArray(value) ? 'array' :
                     type === 'object' ? 'object (JSON)' : type;

      console.log(`${idx + 1}. ${colName}`);
      console.log(`   Type (inferred): ${jsType}`);
      console.log(`   Sample value: ${value === null ? 'NULL' :
                    typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : value}`);
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log(`\n📊 Total rows retrieved: ${data.length}\n`);

    // Show full sample data
    console.log('📄 Full sample data:\n');
    data.forEach((row, idx) => {
      console.log(`\n--- Row ${idx + 1} ---`);
      Object.entries(row).forEach(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
        console.log(`${key}: ${displayValue}`);
      });
    });

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

getSchema().catch(console.error);
