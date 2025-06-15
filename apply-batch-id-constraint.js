import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function applyBatchIdConstraint() {
  try {
    console.log('🔍 Checking current state of invoices_enhanced.batch_id constraint...');
    
    // Check if constraint already exists
    const { data: existingConstraints, error: constraintError } = await supabase.rpc('exec', {
      sql: `
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'invoices_enhanced' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name = 'fk_invoices_enhanced_batch_id';
      `
    });
    
    if (constraintError) {
      console.error('Error checking constraints:', constraintError);
      return;
    }
    
    if (existingConstraints && existingConstraints.length > 0) {
      console.log('✅ Foreign key constraint already exists!');
      return;
    }
    
    console.log('🔍 Checking data integrity before adding constraint...');
    
    // Check for invalid batch_id references
    const { data: integrityCheck, error: integrityError } = await supabase.rpc('exec', {
      sql: `
        SELECT COUNT(*) as invalid_count
        FROM invoices_enhanced ie
        WHERE ie.batch_id IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM batch_headers bh 
            WHERE bh.id = ie.batch_id
          );
      `
    });
    
    if (integrityError) {
      console.error('Error checking data integrity:', integrityError);
      return;
    }
    
    const invalidCount = integrityCheck?.[0]?.invalid_count || 0;
    
    if (invalidCount > 0) {
      console.log(`⚠️  Found ${invalidCount} invoices with invalid batch_id references`);
      console.log('🧹 Cleaning up invalid references...');
      
      const { error: cleanupError } = await supabase.rpc('exec', {
        sql: `
          UPDATE invoices_enhanced 
          SET batch_id = NULL 
          WHERE batch_id IS NOT NULL 
            AND NOT EXISTS (
              SELECT 1 FROM batch_headers bh 
              WHERE bh.id = batch_id
            );
        `
      });
      
      if (cleanupError) {
        console.error('Error cleaning up invalid references:', cleanupError);
        return;
      }
      
      console.log(`✅ Cleaned up ${invalidCount} invalid batch_id references`);
    } else {
      console.log('✅ Data integrity check passed - all batch_id references are valid');
    }
    
    console.log('🔗 Adding foreign key constraint...');
    
    // Add the foreign key constraint
    const { error: constraintAddError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE invoices_enhanced 
        ADD CONSTRAINT fk_invoices_enhanced_batch_id 
        FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
      `
    });
    
    if (constraintAddError) {
      console.error('Error adding constraint:', constraintAddError);
      return;
    }
    
    console.log('✅ Foreign key constraint added successfully!');
    
    // Verify the constraint was created
    const { data: verification, error: verifyError } = await supabase.rpc('exec', {
      sql: `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'invoices_enhanced'
          AND kcu.column_name = 'batch_id';
      `
    });
    
    if (verifyError) {
      console.error('Error verifying constraint:', verifyError);
      return;
    }
    
    if (verification && verification.length > 0) {
      const constraint = verification[0];
      console.log('🎯 Constraint verification:');
      console.log(`   Table: ${constraint.table_name}`);
      console.log(`   Column: ${constraint.column_name}`);
      console.log(`   References: ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      console.log(`   Constraint: ${constraint.constraint_name}`);
    }
    
    console.log('\n🎉 Successfully applied foreign key constraint for invoices_enhanced.batch_id!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the constraint application
applyBatchIdConstraint();