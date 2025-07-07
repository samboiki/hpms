import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function examinePracticeTariffs() {
  try {
    console.log('Examining practice_tariffs table...');

    // Get table structure using a query
    const { data: tableStructure, error: structureError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'practice_tariffs' 
        ORDER BY ordinal_position;
      `
    });

    if (structureError) {
      console.error('Error getting table structure:', structureError);
      
      // Try direct query instead
      const { data: directData, error: directError } = await supabase
        .from('practice_tariffs')
        .select('*')
        .limit(1);
        
      if (directError) {
        console.error('Direct query error:', directError);
      } else {
        console.log('\n=== SAMPLE DATA (first record) ===');
        console.log(directData[0] || 'No data found');
        
        if (directData[0]) {
          console.log('\n=== TABLE COLUMNS (from sample) ===');
          Object.keys(directData[0]).forEach(key => console.log(`- ${key}`));
        }
      }
    } else {
      console.log('\n=== PRACTICE_TARIFFS TABLE STRUCTURE ===');
      console.table(tableStructure);
    }

    // Check existing data count
    const { count, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting records:', countError);
    } else {
      console.log(`\nCurrent records in practice_tariffs: ${count}`);
    }

    // Get sample data - first try to insert a dummy record to see what fields are expected
    console.log('\n=== TESTING INSERT TO GET FIELD INFO ===');
    const { data: insertTest, error: insertTestError } = await supabase
      .from('practice_tariffs')
      .insert({})
      .select()
      .single();
      
    if (insertTestError) {
      console.error('Insert test error (this helps us see expected fields):', insertTestError);
    }

    // Get sample data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('Error getting sample data:', sampleError);
    } else {
      console.log('\n=== SAMPLE DATA ===');
      console.table(sampleData);
    }

  } catch (error) {
    console.error('Error examining table:', error);
  }
}

examinePracticeTariffs();