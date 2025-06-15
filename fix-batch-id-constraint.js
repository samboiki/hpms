import { createClient } from '@supabase/supabase-js';

// Using the service role key we configured for MCP integration
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function fixInvoicesEnhancedBatchId() {
  try {
    console.log('🔗 Fixing invoices_enhanced.batch_id foreign key constraint...');
    
    // Step 1: Check for any invalid batch_id references and clean them up
    console.log('🔍 Checking for invalid batch_id references...');
    
    const { data: invoicesWithBatches, error: fetchError } = await supabase
      .from('invoices_enhanced')
      .select('id, batch_id')
      .not('batch_id', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching invoices:', fetchError);
      return;
    }
    
    let invalidCount = 0;
    const invalidIds = [];
    
    if (invoicesWithBatches) {
      for (const invoice of invoicesWithBatches) {
        const { data: batchExists, error: batchError } = await supabase
          .from('batch_headers')
          .select('id')
          .eq('id', invoice.batch_id)
          .maybeSingle();
          
        if (batchError || !batchExists) {
          invalidIds.push(invoice.id);
          invalidCount++;
        }
      }
    }
    
    if (invalidCount > 0) {
      console.log(`⚠️  Found ${invalidCount} invoices with invalid batch_id references`);
      console.log('🧹 Setting invalid batch_id values to null...');
      
      const { error: updateError } = await supabase
        .from('invoices_enhanced')
        .update({ batch_id: null })
        .in('id', invalidIds);
        
      if (updateError) {
        console.error('Error cleaning invalid references:', updateError);
        return;
      }
      
      console.log(`✅ Cleaned up ${invalidCount} invalid batch_id references`);
    } else {
      console.log('✅ All batch_id references are valid');
    }
    
    // Step 2: Add the foreign key constraint using database function
    console.log('🔗 Adding foreign key constraint...');
    
    const { data, error } = await supabase.rpc('add_foreign_key_constraint', {
      table_name: 'invoices_enhanced',
      constraint_name: 'fk_invoices_enhanced_batch_id',
      column_name: 'batch_id',
      referenced_table: 'batch_headers',
      referenced_column: 'id'
    });
    
    if (error) {
      console.log('ℹ️  Database function not available, using direct SQL approach...');
      
      // Alternative: Use the SQL editor or direct schema modification
      console.log('📝 Foreign key constraint SQL to execute:');
      console.log(`
        ALTER TABLE invoices_enhanced 
        ADD CONSTRAINT fk_invoices_enhanced_batch_id 
        FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
      `);
      
      console.log('💡 Please execute this SQL in the Supabase Dashboard → SQL Editor');
      console.log('   Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql');
    } else {
      console.log('✅ Foreign key constraint added successfully!');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Execute the ALTER TABLE command shown above');
    console.log('3. Verify the constraint in the Database → Schema section');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixInvoicesEnhancedBatchId();