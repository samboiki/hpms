#!/usr/bin/env node

/**
 * Fix Financial Overview Batch Management Issues
 * 
 * This script addresses:
 * 1. Users table column mismatch (first_name/last_name vs full_name)
 * 2. Batch management view not being accessible by practice_id
 * 3. Missing helper functions for batch data retrieval
 */

import pg from 'pg';

const DB_CONFIG = {
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
};

class FinancialOverviewFixer {
  constructor() {
    this.client = new pg.Client(DB_CONFIG);
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Connected to database');
  }

  async disconnect() {
    await this.client.end();
    console.log('👋 Disconnected from database');
  }

  async createUsersWithNamesView() {
    console.log('👤 Creating users_with_names view...');
    
    const createViewSQL = `
      CREATE OR REPLACE VIEW users_with_names AS
      SELECT 
        id,
        email,
        full_name,
        -- Split full_name into first_name and last_name for backward compatibility
        CASE 
          WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
          THEN substring(full_name from 1 for position(' ' in full_name) - 1)
          ELSE full_name
        END as first_name,
        CASE 
          WHEN full_name IS NOT NULL AND position(' ' in full_name) > 0 
          THEN substring(full_name from position(' ' in full_name) + 1)
          ELSE ''
        END as last_name,
        role,
        created_at,
        last_login,
        avatar,
        practice_id,
        is_super_admin,
        can_manage_practices,
        permissions,
        last_active_at,
        hpcsa_number
      FROM users;
    `;
    
    await this.client.query(createViewSQL);
    console.log('✅ Created users_with_names view');
  }

  async ensurePracticeNumberColumn() {
    console.log('🏥 Checking practices table for practice_number column...');
    
    const checkColumnSQL = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'practices' 
        AND table_schema = 'public' 
        AND column_name = 'practice_number';
    `;
    
    const result = await this.client.query(checkColumnSQL);
    
    if (result.rows.length === 0) {
      console.log('➕ Adding practice_number column to practices table...');
      
      const addColumnSQL = `
        ALTER TABLE practices 
        ADD COLUMN IF NOT EXISTS practice_number VARCHAR(15);
      `;
      
      await this.client.query(addColumnSQL);
      
      // Update existing practices with generated practice numbers
      const updatePracticesSQL = `
        UPDATE practices 
        SET practice_number = COALESCE(practice_number, '54000113324' || ROW_NUMBER() OVER (ORDER BY created_at))
        WHERE practice_number IS NULL;
      `;
      
      await this.client.query(updatePracticesSQL);
      console.log('✅ Added practice_number column and updated existing practices');
    } else {
      console.log('✅ practice_number column already exists');
    }
  }

  async createGetPracticeBatchesFunction() {
    console.log('📊 Creating get_practice_batches function...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_practice_batches(p_practice_id UUID)
      RETURNS TABLE (
        batch_id UUID,
        practice_number VARCHAR(15),
        batch_number INTEGER,
        batch_date DATE,
        medical_aid_reference VARCHAR(10),
        status TEXT,
        total_invoices INTEGER,
        total_amount NUMERIC(10,2),
        created_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        confirmed_at TIMESTAMP WITH TIME ZONE,
        medical_aid_name TEXT,
        medical_aid_short_name TEXT,
        medical_aid_email TEXT,
        medical_aid_logo_url TEXT,
        medical_aid_theme_color TEXT,
        practice_name TEXT,
        practice_email TEXT,
        detail_transactions INTEGER,
        total_detail_transactions INTEGER,
        total_amount_detail_transactions NUMERIC(10,2),
        dat_filename TEXT
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        practice_num VARCHAR(15);
      BEGIN
        -- Get the practice number for this practice ID
        SELECT p.practice_number INTO practice_num
        FROM practices p
        WHERE p.id = p_practice_id;
        
        -- If no practice number found, return empty result
        IF practice_num IS NULL THEN
          RETURN;
        END IF;
        
        -- Return batches for this practice number
        RETURN QUERY
        SELECT 
          bmv.batch_id,
          bmv.practice_number,
          bmv.batch_number,
          bmv.batch_date,
          bmv.medical_aid_reference,
          bmv.status,
          bmv.total_invoices,
          bmv.total_amount,
          bmv.created_at,
          bmv.sent_at,
          bmv.confirmed_at,
          bmv.medical_aid_name,
          bmv.medical_aid_short_name,
          bmv.medical_aid_email,
          bmv.medical_aid_logo_url,
          bmv.medical_aid_theme_color,
          bmv.practice_name,
          bmv.practice_email,
          bmv.detail_transactions,
          bmv.total_detail_transactions,
          bmv.total_amount_detail_transactions,
          bmv.dat_filename
        FROM batch_management_view bmv
        WHERE bmv.practice_number = practice_num
        ORDER BY bmv.created_at DESC;
      END;
      $$;
    `;
    
    await this.client.query(createFunctionSQL);
    console.log('✅ Created get_practice_batches function');
  }

  async createDirectBatchQuery() {
    console.log('🔍 Creating get_practice_batches_direct function...');
    
    const createDirectFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_practice_batches_direct(p_practice_id UUID)
      RETURNS TABLE (
        batch_id UUID,
        practice_number VARCHAR(15),
        batch_number INTEGER,
        batch_date DATE,
        medical_aid_reference VARCHAR(10),
        status TEXT,
        total_invoices INTEGER,
        total_amount NUMERIC(10,2),
        created_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        confirmed_at TIMESTAMP WITH TIME ZONE,
        medical_aid_name TEXT,
        medical_aid_short_name TEXT,
        medical_aid_email TEXT,
        medical_aid_logo_url TEXT,
        medical_aid_theme_color TEXT,
        practice_name TEXT,
        practice_email TEXT,
        detail_transactions INTEGER,
        total_detail_transactions INTEGER,
        total_amount_detail_transactions NUMERIC(10,2),
        dat_filename TEXT
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Direct query of batch_headers with joins
        RETURN QUERY
        SELECT 
          bh.id as batch_id,
          bh.practice_number,
          bh.batch_number,
          bh.batch_date,
          bh.medical_aid_reference,
          bh.status,
          bh.total_invoices,
          bh.total_amount,
          bh.created_at,
          bh.sent_at,
          bh.confirmed_at,
          COALESCE(map.name, 'Unknown Medical Aid') as medical_aid_name,
          COALESCE(map.short_name, 'UNK') as medical_aid_short_name,
          COALESCE(map.email, 'unknown@example.com') as medical_aid_email,
          map.logo_url as medical_aid_logo_url,
          map.theme_color as medical_aid_theme_color,
          COALESCE(p.name, 'Unknown Practice') as practice_name,
          COALESCE(p.contact_email, 'unknown@example.com') as practice_email,
          COALESCE((
            SELECT COUNT(*)::INTEGER 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
          ), 0) as detail_transactions,
          COALESCE((
            SELECT COUNT(*)::INTEGER 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
          ), 0) as total_detail_transactions,
          COALESCE((
            SELECT SUM(bd.service_amount)::NUMERIC(10,2) 
            FROM batch_details bd 
            WHERE bd.batch_header_id = bh.id
          ), 0.00) as total_amount_detail_transactions,
          (bh.practice_number || '_' || bh.batch_number || '_' || bh.medical_aid_reference) as dat_filename
        FROM batch_headers bh
        LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bh.medical_aid_reference
        LEFT JOIN practices p ON p.id = bh.practice_id
        WHERE bh.practice_id = p_practice_id
        ORDER BY bh.created_at DESC;
      END;
      $$;
    `;
    
    await this.client.query(createDirectFunctionSQL);
    console.log('✅ Created get_practice_batches_direct function');
  }

  async runDiagnostics() {
    console.log('🔍 Running diagnostics...');
    
    // Check users table
    const usersResult = await this.client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as users_with_names
      FROM users;
    `);
    console.log('👥 Users:', usersResult.rows[0]);
    
    // Check practices table
    const practicesResult = await this.client.query(`
      SELECT 
        COUNT(*) as total_practices,
        COUNT(CASE WHEN practice_number IS NOT NULL THEN 1 END) as practices_with_numbers
      FROM practices;
    `);
    console.log('🏥 Practices:', practicesResult.rows[0]);
    
    // Check batch headers
    const batchesResult = await this.client.query(`
      SELECT 
        COUNT(*) as total_batches,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_batches,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_batches
      FROM batch_headers;
    `);
    console.log('📊 Batches:', batchesResult.rows[0]);
    
    // Check batch management view
    const viewResult = await this.client.query(`
      SELECT COUNT(*) as view_records 
      FROM batch_management_view;
    `);
    console.log('📋 Batch Management View Records:', viewResult.rows[0]);
    
    // Test the new function with a sample practice ID
    const practiceTest = await this.client.query(`
      SELECT id, name, practice_number 
      FROM practices 
      LIMIT 1;
    `);
    
    if (practiceTest.rows.length > 0) {
      const testPractice = practiceTest.rows[0];
      console.log('🧪 Testing with practice:', testPractice);
      
      const functionTest = await this.client.query(`
        SELECT COUNT(*) as function_result_count
        FROM get_practice_batches($1);
      `, [testPractice.id]);
      
      console.log('🔬 Function test result:', functionTest.rows[0]);
    }
  }

  async fixAll() {
    try {
      await this.connect();
      
      console.log('🚀 Starting Financial Overview batch fixes...\n');
      
      await this.createUsersWithNamesView();
      await this.ensurePracticeNumberColumn();
      await this.createGetPracticeBatchesFunction();
      await this.createDirectBatchQuery();
      
      console.log('\n🔍 Running diagnostics...');
      await this.runDiagnostics();
      
      console.log('\n✅ All fixes completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Test the Financial Overview modal');
      console.log('2. Navigate to Batch Management tab');
      console.log('3. Toggle the Active filter to see active batches');
      console.log('4. If no batches appear, check that your practice has a practice_number assigned');
      
    } catch (error) {
      console.error('❌ Error during fixes:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run the fixer
const fixer = new FinancialOverviewFixer();
fixer.fixAll().catch(console.error);

export default FinancialOverviewFixer;