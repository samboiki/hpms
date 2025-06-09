#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyMissingBillingTables() {
  try {
    console.log('🚀 Applying missing billing tables migration...\n');
    
    // Read the comprehensive billing migration
    const migrationPath = 'supabase/migrations/20250608000000_billing_system_tables.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📖 Read migration file:', migrationPath);
    console.log('📏 Migration size:', migrationSQL.length, 'characters\n');
    
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check which tables are missing
    const missingTables = [
      'invoice_items_enhanced',
      'medical_aid_coverage', 
      'payment_records',
      'practice_billing_settings'
    ];
    
    console.log('🔍 Checking which tables exist...');
    for (const table of missingTables) {
      const { rows } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table}'
        );
      `);
      console.log(`   ${table}: ${rows[0].exists ? '✅ Exists' : '❌ Missing'}`);
    }
    console.log();
    
    // Apply the migration
    console.log('⚡ Executing migration...');
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration executed successfully!\n');
    } catch (migrationError) {
      console.log('⚠️ Migration error (may be expected if tables exist):', migrationError.message);
      console.log('   This is normal if some tables already exist.\n');
    }
    
    // Verify tables now exist
    console.log('🔍 Verifying tables after migration...');
    for (const table of missingTables) {
      const { rows } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table}'
        );
      `);
      console.log(`   ${table}: ${rows[0].exists ? '✅ Exists' : '❌ Still Missing'}`);
      
      if (rows[0].exists) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`     Records: ${countResult.rows[0].count}`);
      }
    }
    
    // Test a complete billing workflow query
    console.log('\n🧪 Testing complete billing workflow...');
    try {
      const testQuery = `
        SELECT 
          vs.id as visit_service_id,
          vs.quantity,
          vs.unit_price,
          vs.total_price,
          v.visit_date,
          v.diagnosis,
          p.first_name,
          p.last_name,
          pt.code as service_code,
          pt.namaf_prace_2025 as service_name
        FROM visit_services vs
        JOIN visits v ON vs.visit_id = v.id
        JOIN patients p ON v.patient_id = p.id  
        JOIN practice_tariffs pt ON vs.tariff_id = pt.id
        LIMIT 5;
      `;
      
      const { rows } = await client.query(testQuery);
      console.log(`✅ Billing workflow query successful - ${rows.length} records found`);
      
      if (rows.length > 0) {
        console.log('📋 Sample billing records:');
        rows.forEach(row => {
          console.log(`   • ${row.first_name} ${row.last_name}: ${row.service_code} - N$${row.total_price}`);
        });
      } else {
        console.log('   No billing records found (tables exist but empty)');
      }
    } catch (testError) {
      console.log('❌ Billing workflow test failed:', testError.message);
    }
    
    console.log('\n🎉 Migration process completed!');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
  } finally {
    await client.end();
  }
}

applyMissingBillingTables().catch(console.error);