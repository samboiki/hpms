// Execute medical aid fix using service role
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeFix() {
  try {
    console.log('🔧 Executing medical aid fix with service role...');
    
    // Get the existing providers to use their actual IDs
    const { data: providers, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('*')
      .order('name');
      
    if (providersError) {
      console.error('❌ Error fetching providers:', providersError);
      return;
    }
    
    console.log('✅ Found providers:', providers.map(p => `${p.name} (${p.id})`));
    
    // Step 1: Add foreign key column
    console.log('\n🔧 Adding medical_aid_provider_id column...');
    const { error: addColumnError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE public.medical_aid_details
        ADD COLUMN IF NOT EXISTS medical_aid_provider_id UUID;
      `
    });
    
    if (addColumnError) {
      console.log('Column add result:', addColumnError.message);
    } else {
      console.log('✅ Column added successfully');
    }
    
    // Step 2: Add foreign key constraint
    console.log('\n🔧 Adding foreign key constraint...');
    const { error: constraintError } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE public.medical_aid_details
        ADD CONSTRAINT IF NOT EXISTS medical_aid_details_provider_id_fkey
        FOREIGN KEY (medical_aid_provider_id) REFERENCES public.medical_aid_providers(id);
      `
    });
    
    if (constraintError) {
      console.log('Constraint add result:', constraintError.message);
    } else {
      console.log('✅ Foreign key constraint added');
    }
    
    // Step 3: Create the function
    console.log('\n🔧 Creating get_medical_aid_providers function...');
    const { error: functionError } = await supabase.rpc('sql', {
      query: `
        CREATE OR REPLACE FUNCTION get_medical_aid_providers()
        RETURNS TABLE(
          id UUID,
          name TEXT,
          short_name TEXT,
          logo_url TEXT,
          medical_aid_reference TEXT
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            map.id,
            map.name,
            map.short_name,
            map.logo_url,
            map.medical_aid_reference
          FROM medical_aid_providers map
          ORDER BY map.name;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        
        GRANT EXECUTE ON FUNCTION get_medical_aid_providers() TO authenticated;
      `
    });
    
    if (functionError) {
      console.log('Function creation result:', functionError.message);
    } else {
      console.log('✅ Function created successfully');
    }
    
    // Step 4: Test the function
    console.log('\n🧪 Testing the function...');
    const { data: functionTest, error: testError } = await supabase
      .rpc('get_medical_aid_providers');
      
    if (testError) {
      console.error('❌ Function test failed:', testError);
    } else {
      console.log('✅ Function works! Returned', functionTest?.length || 0, 'providers');
    }
    
    console.log('\n✅ Medical aid fix completed successfully!');
    console.log('Next: Test patient registration with medical aid selection');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

executeFix();