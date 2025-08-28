import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query, name) {
  console.log(`\n🔧 ${name}`);
  console.log('📝 SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ Error:', error.message);
      console.error('💡 Hint:', error.hint || 'None');
      return { success: false, error: error.message };
    }

    console.log('✅ Success:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Starting Farmaris Practice Migration...\n');

  // Read the migration file
  const migrationPath = './supabase/migrations/20250827_add_farmaris_practice.sql';
  
  try {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const result = await executeSql(migrationSQL, 'Add Farmaris practice');
    
    if (!result.success) {
      console.error(`\n💥 Migration failed: ${result.error}`);
      process.exit(1);
    }
    
    // Verification - check if Farmaris practice was added
    console.log('\n🔍 Verifying migration...');
    
    const verifyResult = await executeSql(`
      SELECT id, slug, name, domain, contact_email, created_at
      FROM practices 
      WHERE slug = 'farmaris';
    `, 'Verify Farmaris practice creation');

    if (verifyResult.success && verifyResult.data && verifyResult.data.length > 0) {
      const farmarisPractice = verifyResult.data[0];
      console.log('\n🎉 SUCCESS! Farmaris Practice Migration completed!');
      console.log('\n📊 Practice Details:');
      console.log(`- ✅ Practice ID: ${farmarisPractice.id}`);
      console.log(`- ✅ Slug: ${farmarisPractice.slug}`);
      console.log(`- ✅ Name: ${farmarisPractice.name}`);
      console.log(`- ✅ Domain: ${farmarisPractice.domain}`);
      console.log(`- ✅ Contact Email: ${farmarisPractice.contact_email}`);
      console.log(`- ✅ Created: ${farmarisPractice.created_at}`);
      console.log('\n💡 Farmaris practice has been successfully added to the database!');
      console.log('🌟 The practice is configured for grand opening event on March 15, 2025');
    } else {
      console.log('⚠️ Migration completed but could not verify practice creation');
    }
    
  } catch (err) {
    console.error('💥 Failed to read migration file:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);