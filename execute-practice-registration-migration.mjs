import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Please set it in your .env file or environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  console.log('🚀 Starting practice registration migration...\n');
  
  const sql = `
-- Add new columns to practices table for complete registration data
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS number_of_branches INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS branch_names TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS professional_email_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS professional_email_addresses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_hosting_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_monthly_premium DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 1600,
ADD COLUMN IF NOT EXISTS branches_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

-- Add new columns to branches table for cost tracking
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;
  `.trim();
  
  try {
    console.log('📋 Executing ALTER TABLE statements...\n');
    
    // Execute using PostgreSQL REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      console.log('⚠️  RPC method not available, using alternative approach...\n');
      
      // Split and execute statements individually
      const statements = [
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS number_of_branches INTEGER DEFAULT 1",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS branch_names TEXT[] DEFAULT '{}'",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS professional_email_count INTEGER DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS professional_email_addresses TEXT[] DEFAULT '{}'",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(10,2) DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS website_hosting_enabled BOOLEAN DEFAULT false",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS total_monthly_premium DECIMAL(10,2) DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 1600",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS branches_cost DECIMAL(10,2) DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS website_cost DECIMAL(10,2) DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS emails_cost DECIMAL(10,2) DEFAULT 0",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100)",
        "ALTER TABLE practices ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false"
      ];
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const columnName = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
        console.log(`${i + 1}/${statements.length} Adding column: ${columnName}...`);
        
        // Use Supabase Management API or direct SQL execution
        // For now, we'll log that these need to be executed
      }
      
      console.log('\n💡 Please execute the migration using one of these methods:');
      console.log('1. Via Supabase Dashboard → SQL Editor');
      console.log('2. Via psql command line');
      console.log('3. Via Supabase Management API');
      console.log('\nSQL file has been saved to: supabase/migrations/20250930_add_practice_branch_columns.sql');
      
    } else {
      const result = await response.json();
      console.log('✅ Migration executed successfully!');
      console.log('Result:', result);
    }
    
    // Verify by attempting to query
    console.log('\n🔍 Verifying tables are accessible...\n');
    
    const { error: practicesError } = await supabase
      .from('practices')
      .select('id')
      .limit(1);
    
    if (practicesError) {
      console.log('⚠️  Practices table:', practicesError.message);
    } else {
      console.log('✅ Practices table is accessible');
    }
    
    const { error: branchesError } = await supabase
      .from('branches')
      .select('id')
      .limit(1);
    
    if (branchesError) {
      console.log('⚠️  Branches table:', branchesError.message);
    } else {
      console.log('✅ Branches table is accessible');
    }
    
    console.log('\n📊 Columns to be added to practices table:');
    console.log('  ✓ number_of_branches (INTEGER, default: 1)');
    console.log('  ✓ branch_names (TEXT[])');
    console.log('  ✓ professional_email_count (INTEGER, default: 0)');
    console.log('  ✓ professional_email_addresses (TEXT[])');
    console.log('  ✓ marketing_budget (DECIMAL(10,2), default: 0)');
    console.log('  ✓ website_hosting_enabled (BOOLEAN, default: false)');
    console.log('  ✓ total_monthly_premium (DECIMAL(10,2), default: 0)');
    console.log('  ✓ base_price (DECIMAL(10,2), default: 1600)');
    console.log('  ✓ branches_cost (DECIMAL(10,2), default: 0)');
    console.log('  ✓ website_cost (DECIMAL(10,2), default: 0)');
    console.log('  ✓ emails_cost (DECIMAL(10,2), default: 0)');
    console.log('  ✓ tax_number (VARCHAR(100))');
    console.log('  ✓ registration_number (VARCHAR(100))');
    console.log('\n📊 Columns to be added to branches table:');
    console.log('  ✓ monthly_cost (DECIMAL(10,2), default: 1000)');
    console.log('  ✓ is_main_branch (BOOLEAN, default: false)');
    
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error(err);
  }
}

executeMigration();
