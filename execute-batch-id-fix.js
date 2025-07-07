import pg from 'pg';
import { promises as fs } from 'fs';

const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

async function fixBatchIdConstraint() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    
    console.log('📊 Checking current state of invoices_enhanced.batch_id...');
    
    // Check if the constraint already exists
    const checkConstraintQuery = `
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'invoices_enhanced' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_invoices_enhanced_batch_id';
    `;
    
    const constraintResult = await client.query(checkConstraintQuery);
    
    if (constraintResult.rows.length > 0) {
      console.log('✅ Foreign key constraint already exists!');
      return;
    }
    
    console.log('🔍 Checking data integrity before adding constraint...');
    
    // Check for any batch_id values that don't exist in batch_headers
    const dataIntegrityQuery = `
      SELECT COUNT(*) as invalid_count
      FROM invoices_enhanced ie
      WHERE ie.batch_id IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM batch_headers bh 
          WHERE bh.id = ie.batch_id
        );
    `;
    
    const integrityResult = await client.query(dataIntegrityQuery);
    const invalidCount = parseInt(integrityResult.rows[0].invalid_count);
    
    if (invalidCount > 0) {
      console.log(`⚠️  Found ${invalidCount} invoices with invalid batch_id references`);
      console.log('🧹 Cleaning up invalid references...');
      
      // Set invalid batch_id values to NULL
      await client.query(`
        UPDATE invoices_enhanced 
        SET batch_id = NULL 
        WHERE batch_id IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM batch_headers bh 
            WHERE bh.id = batch_id
          );
      `);
      
      console.log(`✅ Cleaned up ${invalidCount} invalid batch_id references`);
    } else {
      console.log('✅ Data integrity check passed - all batch_id references are valid');
    }
    
    console.log('🔗 Adding foreign key constraint...');
    
    // Add the foreign key constraint
    await client.query(`
      ALTER TABLE invoices_enhanced 
      ADD CONSTRAINT fk_invoices_enhanced_batch_id 
      FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
    `);
    
    console.log('✅ Foreign key constraint added successfully!');
    
    // Verify the constraint was created
    const verifyQuery = `
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
    `;
    
    const verifyResult = await client.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      const constraint = verifyResult.rows[0];
      console.log('🎯 Constraint verification:');
      console.log(`   Table: ${constraint.table_name}`);
      console.log(`   Column: ${constraint.column_name}`);
      console.log(`   References: ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      console.log(`   Constraint: ${constraint.constraint_name}`);
    }
    
    console.log('\n🎉 Successfully applied foreign key constraint for invoices_enhanced.batch_id!');
    
  } catch (error) {
    console.error('❌ Error applying constraint:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the fix
fixBatchIdConstraint().catch(console.error);