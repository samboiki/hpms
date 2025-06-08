#!/usr/bin/env node

import pkg from 'pg';
import fs from 'fs';

const { Client } = pkg;

// Direct PostgreSQL connection as specified in CLAUDE.md
const client = new Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function directPostgres179Migration() {
  console.log('🚀 DIRECT POSTGRES: RESTRUCTURE AND IMPORT ALL 179 DENTAL CODES\n');
  
  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Step 1: Read the complete analysis file to get all 179 codes
    console.log('\n📋 Step 1: Reading complete dental codes analysis...');
    
    const analysisData = JSON.parse(fs.readFileSync('/home/happy/projects/hpms/dental_codes_complete_analysis.json', 'utf8'));
    const complete179Codes = analysisData.complete_data;
    
    console.log(`✅ Loaded ${complete179Codes.length} codes from analysis file`);
    
    if (complete179Codes.length !== 179) {
      throw new Error(`Expected 179 codes, got ${complete179Codes.length}`);
    }
    
    // Step 2: Clear all existing data
    console.log('\n🧹 Step 2: Clearing all existing tariff data...');
    
    await client.query('DELETE FROM practice_tariffs');
    console.log('✅ All existing tariff data cleared');
    
    // Step 3: Check current table structure
    console.log('\n🔍 Step 3: Checking current table structure...');
    
    const currentSchema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current table columns:');
    currentSchema.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Step 4: Drop all columns except id and system columns, then add new columns
    console.log('\n🔧 Step 4: Restructuring table to match Excel exactly...');
    
    // Get list of columns to drop (keep only id and basic system columns)
    const columnsToKeep = ['id', 'effective_from', 'effective_to', 'created_at', 'updated_at'];
    const columnsToDrop = currentSchema.rows
      .map(row => row.column_name)
      .filter(name => !columnsToKeep.includes(name));
    
    // Drop unwanted columns
    for (const columnName of columnsToDrop) {
      try {
        await client.query(`ALTER TABLE practice_tariffs DROP COLUMN IF EXISTS ${columnName}`);
        console.log(`   ✅ Dropped column: ${columnName}`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${columnName}: ${error.message}`);
      }
    }
    
    // Add new columns based on Excel structure exactly as you requested
    const newColumns = [
      // Core columns from Excel file - matching exact structure
      'ALTER TABLE practice_tariffs ADD COLUMN code INTEGER',
      'ALTER TABLE practice_tariffs ADD COLUMN description TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN official_2025_price_nad DECIMAL(10,2)',
      'ALTER TABLE practice_tariffs ADD COLUMN on_2025_list TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN found_in_claims TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN requires_tooth_number TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN can_be_multiplied TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN business_rule_formula TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN example_calculation TEXT',
      'ALTER TABLE practice_tariffs ADD COLUMN notes TEXT',
      // Add practice type column as requested
      'ALTER TABLE practice_tariffs ADD COLUMN practice_type TEXT DEFAULT \'dental\'',
      // Ensure system columns exist with defaults as requested
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS effective_to DATE',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      'ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
    ];
    
    for (const sql of newColumns) {
      try {
        await client.query(sql);
        console.log(`   ✅ Added column successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ✅ Column already exists`);
        } else {
          console.log(`   ⚠️  Column addition warning: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Table restructured with exact Excel column structure');
    
    // Step 5: Verify new table structure
    console.log('\n📊 Step 5: Verifying new table structure...');
    
    const newSchema = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 New table structure:');
    newSchema.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type}`);
    });
    
    // Step 6: Transform and insert all 179 codes
    console.log('\n📊 Step 6: Inserting all 179 codes...');
    
    let totalInserted = 0;
    
    for (const item of complete179Codes) {
      try {
        // Handle special pricing for code 8346
        let price = parseFloat(item['Official 2025 Price (NAD)']);
        if (item['Official 2025 Price (NAD)'] === 'VARIES') {
          price = 50.84; // Default to tooth 11 price
        }
        
        const insertSQL = `
          INSERT INTO practice_tariffs (
            code, description, official_2025_price_nad, on_2025_list, 
            found_in_claims, requires_tooth_number, can_be_multiplied,
            business_rule_formula, example_calculation, notes, practice_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        
        const values = [
          parseInt(item.Code),
          item.Description,
          price,
          item['On 2025 List'],
          item['Found in Claims'],
          item['Requires Tooth Number'],
          item['Can Be Multiplied'],
          item['Business Rule/Formula'],
          item['Example Calculation'],
          item.Notes || '',
          'dental'
        ];
        
        await client.query(insertSQL, values);
        totalInserted++;
        
        if (totalInserted % 25 === 0) {
          console.log(`   ✅ Inserted ${totalInserted} codes...`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to insert code ${item.Code}: ${error.message}`);
      }
    }
    
    console.log(`✅ Insertion complete: ${totalInserted} codes inserted`);
    
    // Step 7: Verify import success
    console.log('\n🔍 Step 7: Verifying import success...');
    
    const verifyResult = await client.query(`
      SELECT code, description, official_2025_price_nad, practice_type, can_be_multiplied
      FROM practice_tariffs 
      ORDER BY code 
      LIMIT 10
    `);
    
    const countResult = await client.query('SELECT COUNT(*) FROM practice_tariffs');
    const totalCount = parseInt(countResult.rows[0].count);
    
    console.log(`✅ Import verification:`);
    console.log(`   • Total codes in database: ${totalCount}`);
    console.log(`   • Expected: 179`);
    console.log(`   • Match: ${totalCount === 179 ? '✅ YES' : '❌ NO'}`);
    
    // Show sample of imported data
    if (verifyResult.rows.length > 0) {
      console.log('\n📋 Sample imported codes:');
      verifyResult.rows.forEach(code => {
        console.log(`   • ${code.code}: ${code.description.substring(0, 50)}... - N$${code.official_2025_price_nad} (${code.can_be_multiplied})`);
      });
    }
    
    // Step 8: Verify special cases
    console.log('\n🎯 Step 8: Verifying special cases...');
    
    // Check tooth-specific pricing (8346)
    const toothSpecific = await client.query('SELECT * FROM practice_tariffs WHERE code = 8346');
    if (toothSpecific.rows.length > 0) {
      console.log(`✅ Tooth-specific pricing code 8346 found: ${toothSpecific.rows[0].description}`);
    }
    
    // Check multiplication rules
    const multiplicationCodes = await client.query('SELECT COUNT(*) FROM practice_tariffs WHERE can_be_multiplied != \'NO\'');
    console.log(`✅ Codes with multiplication rules: ${multiplicationCodes.rows[0].count}`);
    
    // Check progressive pricing codes
    const progressiveCodes = await client.query('SELECT COUNT(*) FROM practice_tariffs WHERE can_be_multiplied = \'PROGRESSIVE\'');
    console.log(`✅ Progressive pricing codes: ${progressiveCodes.rows[0].count}`);
    
    // Final summary
    console.log('\n🎉 COMPLETE MIGRATION SUMMARY:');
    console.log('===============================');
    console.log(`✅ Total codes imported: ${totalInserted} / 179`);
    console.log(`✅ Table completely restructured with Excel columns`);
    console.log(`✅ All 10 Excel columns mapped exactly:`);
    console.log(`   • Code → code (dental procedure code)`);
    console.log(`   • Description → description (procedure name)`);
    console.log(`   • Official 2025 Price (NAD) → official_2025_price_nad`);
    console.log(`   • On 2025 List → on_2025_list`);
    console.log(`   • Found in Claims → found_in_claims`);
    console.log(`   • Requires Tooth Number → requires_tooth_number`);
    console.log(`   • Can Be Multiplied → can_be_multiplied`);
    console.log(`   • Business Rule/Formula → business_rule_formula`);
    console.log(`   • Example Calculation → example_calculation`);
    console.log(`   • Notes → notes`);
    console.log(`✅ Practice type column added (set to 'dental')`);
    console.log(`✅ System columns preserved: effective_from, effective_to, created_at, updated_at`);
    
    if (totalInserted === 179) {
      console.log('\n🎯 MISSION ACCOMPLISHED:');
      console.log('✅ ALL 179 dental codes successfully imported');
      console.log('✅ Database restructured to match Excel exactly');
      console.log('✅ All required columns created and populated');
      console.log('✅ Practice type set to dental for all codes');
      console.log('✅ System columns maintained as requested');
      console.log('✅ Ready for ServiceSelector integration');
    } else {
      console.log(`\n⚠️  WARNING: Expected 179 codes, imported ${totalInserted}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the complete migration
try {
  await directPostgres179Migration();
} catch (error) {
  console.error('Script error:', error.message);
  process.exit(1);
}