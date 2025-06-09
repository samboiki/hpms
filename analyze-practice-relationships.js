import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function analyzePracticeRelationships() {
  console.log('🏥 Analyzing practice relationships...\n');
  
  try {
    // Check practices table
    console.log('1. Checking practices table:');
    const { data: practices, error: practicesError } = await serviceClient
      .from('practices')
      .select('id, name, practice_type')
      .order('practice_type');
    
    if (practicesError) {
      console.log('   ❌ Error:', practicesError.message);
      return;
    }
    
    if (practices && practices.length > 0) {
      console.log(`   ✅ Found ${practices.length} practices:`);
      const practiceTypes = [...new Set(practices.map(p => p.practice_type))];
      console.log(`   📋 Practice types: ${practiceTypes.join(', ')}`);
      
      practices.forEach(practice => {
        console.log(`     - ${practice.name}: ${practice.practice_type} (ID: ${practice.id})`);
      });
    }
    
    // Check current practice_tariffs structure
    console.log('\n2. Current practice_tariffs structure:');
    const { data: tariffSample, error: tariffError } = await serviceClient
      .from('practice_tariffs')
      .select('*')
      .limit(1);
    
    if (tariffError) {
      console.log('   ❌ Error:', tariffError.message);
    } else if (tariffSample && tariffSample.length > 0) {
      const columns = Object.keys(tariffSample[0]);
      console.log(`   📋 Current columns: ${columns.join(', ')}`);
      
      const missingCols = ['practice_type', 'practice_id'].filter(col => !columns.includes(col));
      if (missingCols.length > 0) {
        console.log(`   ⚠️  Missing columns: ${missingCols.join(', ')}`);
      }
    }
    
    console.log('\n3. Creating solution...');
    
    if (practices && practices.length > 0) {
      const practiceTypes = [...new Set(practices.map(p => p.practice_type))];
      
      // Let's add the practice_type column and update the dental codes
      console.log('   🔧 Adding practice_type column to practice_tariffs...');
      
      try {
        // Add the column
        const { error: alterError } = await serviceClient.rpc('exec_sql', {
          sql: `ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type TEXT`
        });
        
        if (alterError) {
          console.log('   ❌ Error adding column:', alterError.message);
        } else {
          console.log('   ✅ Successfully added practice_type column');
          
          // Update all existing records to be 'dental' type
          console.log('   🔧 Updating all 179 dental codes to practice_type = "dental"...');
          
          const { error: updateError, count } = await serviceClient
            .from('practice_tariffs')
            .update({ practice_type: 'dental' })
            .is('practice_type', null);
          
          if (updateError) {
            console.log('   ❌ Error updating records:', updateError.message);
          } else {
            console.log(`   ✅ Successfully updated records`);
            
            // Verify the update
            const { count: dentalCount } = await serviceClient
              .from('practice_tariffs')
              .select('*', { count: 'exact', head: true })
              .eq('practice_type', 'dental');
            
            console.log(`   📊 Dental tariffs count: ${dentalCount}`);
          }
        }
        
      } catch (sqlError) {
        console.log('   ❌ SQL Error:', sqlError.message);
      }
    }
    
  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
}

analyzePracticeRelationships();