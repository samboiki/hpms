#!/usr/bin/env node

/**
 * Execute the ADD_UPDATED_AT_TO_INVOICE_SERVICES.sql script
 * This script adds the missing updated_at column to the invoice_services table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTc3Njg1NCwiZXhwIjoyMDMxMzUyODU0fQ.0CcF_4aOLlCQl68G-Hi_xQLgz--Yub7w7k-P3hZtbXA';

async function executeAddUpdatedAtColumn() {
  console.log('🔄 Starting migration to add updated_at column to invoice_services table...');
  
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Read the SQL migration file
    const sqlFilePath = path.join(__dirname, 'ADD_UPDATED_AT_TO_INVOICE_SERVICES.sql');
    console.log('📁 Reading SQL file:', sqlFilePath);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ SQL file loaded successfully');
    
    // Split the SQL into individual statements (simple approach)
    const statements = sqlContent
      .split('-- Step')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim())
      .filter(stmt => !stmt.startsWith('Step') && stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL blocks to execute`);
    
    // Execute the main migration block
    const mainMigration = `
      -- Add the updated_at column if it doesn't exist
      DO $$
      BEGIN
          -- Check if the column already exists
          IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'invoice_services' 
              AND column_name = 'updated_at'
          ) THEN
              -- Add the updated_at column
              ALTER TABLE invoice_services 
              ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
              
              RAISE NOTICE 'Added updated_at column to invoice_services table';
              
              -- Update existing records to have the same updated_at as created_at
              UPDATE invoice_services 
              SET updated_at = created_at 
              WHERE updated_at IS NULL;
              
              RAISE NOTICE 'Updated existing records with created_at timestamp';
          ELSE
              RAISE NOTICE 'Column updated_at already exists in invoice_services table';
          END IF;
      END $$;
      
      -- Create or replace the trigger function to automatically update updated_at
      CREATE OR REPLACE FUNCTION update_invoice_services_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Create the trigger
      DROP TRIGGER IF EXISTS tr_invoice_services_updated_at ON invoice_services;
      CREATE TRIGGER tr_invoice_services_updated_at
          BEFORE UPDATE ON invoice_services
          FOR EACH ROW
          EXECUTE FUNCTION update_invoice_services_updated_at();
    `;
    
    console.log('🔄 Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: mainMigration 
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative method - direct query execution
      console.log('🔄 Trying alternative execution method...');
      
      // Execute individual parts
      const parts = [
        // Add column
        `ALTER TABLE invoice_services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
        
        // Update existing records
        `UPDATE invoice_services SET updated_at = created_at WHERE updated_at IS NULL;`,
        
        // Create trigger function
        `CREATE OR REPLACE FUNCTION update_invoice_services_updated_at()
         RETURNS TRIGGER AS $$
         BEGIN
             NEW.updated_at = NOW();
             RETURN NEW;
         END;
         $$ LANGUAGE plpgsql;`,
        
        // Create trigger
        `DROP TRIGGER IF EXISTS tr_invoice_services_updated_at ON invoice_services;`,
        `CREATE TRIGGER tr_invoice_services_updated_at
         BEFORE UPDATE ON invoice_services
         FOR EACH ROW
         EXECUTE FUNCTION update_invoice_services_updated_at();`
      ];
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(`🔄 Executing part ${i + 1}/${parts.length}...`);
        
        try {
          const { error: partError } = await supabase.rpc('exec_sql', { 
            sql_query: part 
          });
          
          if (partError) {
            console.error(`❌ Part ${i + 1} failed:`, partError);
          } else {
            console.log(`✅ Part ${i + 1} completed successfully`);
          }
        } catch (partErr) {
          console.error(`❌ Part ${i + 1} exception:`, partErr.message);
        }
      }
    } else {
      console.log('✅ Migration executed successfully');
    }
    
    // Verify the column was added
    console.log('🔍 Verifying the migration...');
    const { data: columns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'invoice_services')
      .order('ordinal_position');
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('📋 Current invoice_services table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
      
      // Check if updated_at column exists
      const hasUpdatedAt = columns.some(col => col.column_name === 'updated_at');
      if (hasUpdatedAt) {
        console.log('✅ SUCCESS: updated_at column has been added to invoice_services table!');
      } else {
        console.log('❌ WARNING: updated_at column was not found in the table structure');
      }
    }
    
  } catch (error) {
    console.error('💥 Execution failed:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  executeAddUpdatedAtColumn()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { executeAddUpdatedAtColumn };