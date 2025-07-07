#!/usr/bin/env node

import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkVisitServicesTable() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check if visit_services table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'visit_services'
      );
    `;
    
    const tableResult = await client.query(tableExistsQuery);
    console.log('visit_services table exists:', tableResult.rows[0].exists);
    
    if (tableResult.rows[0].exists) {
      // Get table structure
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'visit_services'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await client.query(structureQuery);
      console.log('\n📋 visit_services table structure:');
      structureResult.rows.forEach(row => {
        console.log(`  • ${row.column_name} (${row.data_type}) - nullable: ${row.is_nullable}`);
      });
      
      // Count records
      const countResult = await client.query('SELECT COUNT(*) FROM visit_services');
      console.log(`\n📊 Records in visit_services: ${countResult.rows[0].count}`);
      
      // Check for any foreign key constraints
      const constraintsQuery = `
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
          AND tc.table_name = 'visit_services';
      `;
      
      const constraintsResult = await client.query(constraintsQuery);
      if (constraintsResult.rows.length > 0) {
        console.log('\n🔗 Foreign key constraints:');
        constraintsResult.rows.forEach(row => {
          console.log(`  • ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });
      }
    }
    
    // Also check other billing tables
    const billingTables = ['invoices_enhanced', 'invoice_items_enhanced', 'medical_aid_coverage', 'payment_records'];
    console.log('\n🔍 Checking other billing tables:');
    
    for (const table of billingTables) {
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table}'
        );
      `;
      
      const result = await client.query(existsQuery);
      console.log(`  • ${table}: ${result.rows[0].exists ? '✅' : '❌'}`);
      
      if (result.rows[0].exists) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`    Records: ${countResult.rows[0].count}`);
      }
    }
    
    // Check recent migrations applied
    console.log('\n📜 Checking migration history:');
    const migrationsQuery = `
      SELECT name, executed_at 
      FROM supabase_migrations.schema_migrations 
      WHERE name LIKE '%billing%' OR name LIKE '%visit_services%'
      ORDER BY executed_at DESC 
      LIMIT 10;
    `;
    
    try {
      const migrationsResult = await client.query(migrationsQuery);
      if (migrationsResult.rows.length > 0) {
        migrationsResult.rows.forEach(row => {
          console.log(`  • ${row.name} - ${row.executed_at}`);
        });
      } else {
        console.log('  No billing-related migrations found');
      }
    } catch (migrationError) {
      console.log('  Could not access migration history:', migrationError.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkVisitServicesTable().catch(console.error);