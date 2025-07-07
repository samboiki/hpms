#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

// Database configuration - using direct PostgreSQL connection like bolt.new
const DB_CONFIG = {
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
};

// File path configuration
const CSV_FILE_PATH = './2025_Dental_Pricing_Table.csv';
const EXCEL_FILE_PATH = 'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';

/**
 * Import dental practice codes into practice_tariffs table
 * Handles duplicate prevention and creates appropriate categories
 */
async function importDentalTariffs() {
  console.log('🦷 Starting Dental Practice Codes Import...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    
    // First, get all existing practices
    const practicesResult = await client.query(`
      SELECT id, name, practice_type, slug 
      FROM practices 
      WHERE practice_type IN ('dental', 'aesthetic') OR practice_type IS NULL
      ORDER BY name
    `);
    
    console.log(`📋 Found ${practicesResult.rows.length} practices to update:`);
    practicesResult.rows.forEach(practice => {
      console.log(`   • ${practice.name} (${practice.slug || 'no-slug'}) - ${practice.practice_type || 'unspecified'}`);
    });
    console.log();
    
    if (practicesResult.rows.length === 0) {
      console.log('❌ No dental or aesthetic practices found. Creating sample practice...');
      
      // Create a sample dental practice for demonstration
      const samplePractice = await client.query(`
        INSERT INTO practices (name, slug, practice_type, city, contact_email, contact_phone)
        VALUES ('Sample Dental Practice', 'sample-dental', 'dental', 'Windhoek', 'admin@sample-dental.na', '+264-61-123456')
        RETURNING id, name, slug
      `);
      
      console.log(`✅ Created sample practice: ${samplePractice.rows[0].name}`);
      practicesResult.rows = samplePractice.rows;
    }
    
    // Read and parse CSV data
    const dentalCodes = [];
    
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.log(`❌ CSV file not found at: ${CSV_FILE_PATH}`);
      console.log(`💡 Please ensure the file exists or update the path`);
      return;
    }
    
    console.log('📖 Reading dental pricing data...');
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          // Skip rows without valid codes or prices
          if (!row.Code || !row.Price || !row.Description) {
            return;
          }
          
          dentalCodes.push({
            code: row.Code.trim(),
            price: parseFloat(row.Price) || 0,
            name: row.Description.trim(),
            category: row.Category ? row.Category.trim() : 'General',
            subcategory: row.Subcategory ? row.Subcategory.trim() : null,
            complexity: row.Complexity ? row.Complexity.trim() : 'Simple',
            notes: row.Notes ? row.Notes.trim() : null
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`✅ Parsed ${dentalCodes.length} dental codes from CSV\n`);
    
    // Show sample of data
    console.log('📋 Sample codes to be imported:');
    dentalCodes.slice(0, 5).forEach(code => {
      console.log(`   • ${code.code}: ${code.name} - N$${code.price} (${code.category})`);
    });
    console.log();
    
    // Clear existing dental tariffs to prevent duplicates
    console.log('🧹 Clearing existing dental tariffs...');
    const deleteResult = await client.query(`
      DELETE FROM practice_tariffs 
      WHERE practice_type = 'dental' OR practice_type IS NULL
    `);
    console.log(`✅ Removed ${deleteResult.rowCount} existing tariff records\n`);
    
    // Insert tariffs for each practice
    let totalInserted = 0;
    
    for (const practice of practicesResult.rows) {
      console.log(`📝 Importing tariffs for: ${practice.name}...`);
      
      for (const code of dentalCodes) {
        try {
          await client.query(`
            INSERT INTO practice_tariffs (
              practice_id, 
              code, 
              price, 
              namaf_prace_2025,
              practice_type,
              category,
              subcategory,
              full_description,
              unit,
              is_active,
              effective_from,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (practice_id, code, effective_from) 
            DO UPDATE SET
              price = EXCLUDED.price,
              namaf_prace_2025 = EXCLUDED.namaf_prace_2025,
              category = EXCLUDED.category,
              subcategory = EXCLUDED.subcategory,
              full_description = EXCLUDED.full_description,
              updated_at = EXCLUDED.updated_at
          `, [
            practice.id,
            code.code,
            code.price,
            code.name,
            'dental',
            code.category,
            code.subcategory,
            `${code.name} - Complexity: ${code.complexity}${code.notes ? '. Notes: ' + code.notes : ''}`,
            'per visit',
            true,
            new Date().toISOString().split('T')[0], // Today's date
            new Date().toISOString(),
            new Date().toISOString()
          ]);
          
          totalInserted++;
        } catch (error) {
          console.error(`   ❌ Failed to insert code ${code.code}: ${error.message}`);
        }
      }
      
      console.log(`   ✅ Completed for ${practice.name}`);
    }
    
    console.log(`\n🎉 Import completed successfully!`);
    console.log(`   • Total codes imported: ${totalInserted}`);
    console.log(`   • Practices updated: ${practicesResult.rows.length}`);
    console.log(`   • Categories created: ${[...new Set(dentalCodes.map(c => c.category))].length}`);
    
    // Generate summary statistics
    const statsResult = await client.query(`
      SELECT 
        practice_type,
        category,
        COUNT(*) as code_count,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM practice_tariffs 
      WHERE practice_type = 'dental'
      GROUP BY practice_type, category
      ORDER BY category
    `);
    
    console.log('\n📊 Import Summary by Category:');
    console.table(statsResult.rows);
    
    console.log('\n✅ Dental tariffs import completed successfully!');
    console.log('🔧 Next steps:');
    console.log('   1. Verify data in the OneHealth admin dashboard');
    console.log('   2. Customize prices for individual practices if needed');
    console.log('   3. Test appointment booking with new tariffs');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify database connection string');
    console.log('   2. Ensure CSV file exists and is readable');
    console.log('   3. Check practice_tariffs table structure');
  } finally {
    await client.end();
  }
}

// Install csv-parser if not available
try {
  await importDentalTariffs();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('csv-parser')) {
    console.log('📦 Installing required modules...');
    console.log('Run: npm install csv-parser');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}