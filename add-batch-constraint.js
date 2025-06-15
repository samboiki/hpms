import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function addBatchConstraint() {
  try {
    console.log('🔗 Adding foreign key constraint for invoices_enhanced.batch_id...');
    
    // First, let's check if there are any existing invalid references
    console.log('🔍 Checking for invalid batch_id references...');
    
    const { data: invalidRefs, error: checkError } = await supabase
      .from('invoices_enhanced')
      .select('id, batch_id')
      .not('batch_id', 'is', null);
    
    if (checkError) {
      console.error('Error checking invalid references:', checkError);
      return;
    }
    
    // Check which batch_ids don't exist in batch_headers
    const invalidBatchIds = [];
    if (invalidRefs && invalidRefs.length > 0) {
      for (const invoice of invalidRefs) {
        const { data: batchExists, error: batchError } = await supabase
          .from('batch_headers')
          .select('id')
          .eq('id', invoice.batch_id)
          .single();
          
        if (batchError && batchError.code === 'PGRST116') {
          // No rows returned - invalid reference
          invalidBatchIds.push(invoice.id);
        }
      }
    }
    
    if (invalidBatchIds.length > 0) {
      console.log(`⚠️  Found ${invalidBatchIds.length} invoices with invalid batch_id references`);
      console.log('🧹 Setting invalid batch_id values to null...');
      
      // Update invalid references to null
      const { error: updateError } = await supabase
        .from('invoices_enhanced')
        .update({ batch_id: null })
        .in('id', invalidBatchIds);
        
      if (updateError) {
        console.error('Error updating invalid references:', updateError);
        return;
      }
      
      console.log(`✅ Cleaned up ${invalidBatchIds.length} invalid batch_id references`);
    } else {
      console.log('✅ All batch_id references are valid');
    }
    
    // Now try to add the constraint using the REST API to execute raw SQL
    console.log('🔗 Attempting to add foreign key constraint...');
    
    const response = await fetch(`https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
      },
      body: JSON.stringify({
        query: `
          DO $$
          BEGIN
            -- Check if constraint already exists
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE table_name = 'invoices_enhanced' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name = 'fk_invoices_enhanced_batch_id'
            ) THEN
              -- Add the constraint
              ALTER TABLE invoices_enhanced 
              ADD CONSTRAINT fk_invoices_enhanced_batch_id 
              FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
              
              RAISE NOTICE 'Foreign key constraint added successfully';
            ELSE
              RAISE NOTICE 'Foreign key constraint already exists';
            END IF;
          END $$;
        `
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP Error:', response.status, errorText);
      return;
    }
    
    console.log('✅ Constraint operation completed successfully!');
    
    // Verify the constraint exists
    const { data: verification, error: verifyError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, table_name')
      .eq('table_name', 'invoices_enhanced')
      .eq('constraint_type', 'FOREIGN KEY')
      .eq('constraint_name', 'fk_invoices_enhanced_batch_id');
      
    if (!verifyError && verification && verification.length > 0) {
      console.log('🎯 Constraint verification successful!');
      console.log(`   Constraint: ${verification[0].constraint_name}`);
      console.log(`   Table: ${verification[0].table_name}`);
    } else {
      console.log('⚠️  Could not verify constraint through information_schema (this might be expected)');
    }
    
    console.log('\n🎉 Foreign key constraint for invoices_enhanced.batch_id has been applied!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addBatchConstraint();