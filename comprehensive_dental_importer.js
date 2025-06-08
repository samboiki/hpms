#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import csv from 'csv-parser';
import XLSX from 'xlsx';

// Database configuration - using direct PostgreSQL connection like bolt.new
const DB_CONFIG = {
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
};

// File paths
const LOCAL_CSV_PATH = './2025_Dental_Pricing_Table.csv';
const REMOTE_EXCEL_PATH = 'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';

/**
 * Read data from CSV file
 */
async function readCSVData(filePath) {
  const dentalCodes = [];
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ CSV file not found at: ${filePath}`);
    return null;
  }
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
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
          notes: row.Notes ? row.Notes.trim() : null,
          selected: row.Selected ? row.Selected.trim() : 'False',
          quantity: parseInt(row.Quantity) || 1,
          total: parseFloat(row.Total) || 0
        });
      })
      .on('end', () => resolve(dentalCodes))
      .on('error', reject);
  });
}

/**
 * Read data from Excel file
 */
function readExcelData(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Excel file not found at: ${filePath}`);
      return null;
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData.map(row => ({
      code: row.Code ? row.Code.toString().trim() : '',
      price: parseFloat(row.Price) || 0,
      name: row.Description ? row.Description.trim() : '',
      category: row.Category ? row.Category.trim() : 'General',
      subcategory: row.Subcategory ? row.Subcategory.trim() : null,
      complexity: row.Complexity ? row.Complexity.trim() : 'Simple',
      notes: row.Notes ? row.Notes.trim() : null,
      selected: row.Selected ? row.Selected.toString().trim() : 'False',
      quantity: parseInt(row.Quantity) || 1,
      total: parseFloat(row.Total) || 0
    })).filter(item => item.code && item.price && item.name);
    
  } catch (error) {
    console.error(`❌ Error reading Excel file: ${error.message}`);
    return null;
  }
}

/**
 * Create or ensure practices exist
 */
async function ensurePracticesExist(client) {
  // Check existing practices
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
  
  // If no practices exist, create sample ones
  if (practicesResult.rows.length === 0) {
    console.log('\n🏥 Creating sample dental practices...');
    
    const samplePractices = [
      {
        name: 'Windhoek Dental Centre',
        slug: 'windhoek-dental-centre',
        city: 'Windhoek',
        email: 'admin@windhoekdental.na',
        phone: '+264-61-234567'
      },
      {
        name: 'Swakopmund Dental Practice',
        slug: 'swakopmund-dental',
        city: 'Swakopmund',
        email: 'info@swakopmunddental.na',
        phone: '+264-64-402345'
      },
      {
        name: 'Oshakati Dental Clinic',
        slug: 'oshakati-dental',
        city: 'Oshakati',
        email: 'reception@oshakatidental.na',
        phone: '+264-65-220987'
      }
    ];
    
    for (const practice of samplePractices) {
      const result = await client.query(`
        INSERT INTO practices (
          name, slug, practice_type, city, contact_email, contact_phone,
          address, description, practice_subtypes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name
      `, [
        practice.name,
        practice.slug,
        'dental',
        practice.city,
        practice.email,
        practice.phone,
        `123 Main Street, ${practice.city}`,
        `Professional dental practice serving ${practice.city} and surrounding areas`,
        ['General Dental Practitioners', 'Cosmetic Dentistry']
      ]);
      
      console.log(`   ✅ Created: ${result.rows[0].name}`);
      practicesResult.rows.push(result.rows[0]);
    }
  }
  
  return practicesResult.rows;
}

/**
 * Import dental codes into database
 */
async function importDentalCodes(client, dentalCodes, practices) {
  console.log('\n🧹 Clearing existing dental tariffs...');
  const deleteResult = await client.query(`
    DELETE FROM practice_tariffs 
    WHERE practice_type = 'dental'
  `);
  console.log(`✅ Removed ${deleteResult.rowCount} existing tariff records`);
  
  let totalInserted = 0;
  
  for (const practice of practices) {
    console.log(`\n📝 Importing ${dentalCodes.length} tariffs for: ${practice.name}...`);
    
    // Batch insert for better performance
    const insertPromises = dentalCodes.map(async (code) => {
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
          `${code.name}${code.complexity ? ' - Complexity: ' + code.complexity : ''}${code.notes ? '. Notes: ' + code.notes : ''}`,
          'per visit',
          true,
          new Date().toISOString().split('T')[0],
          new Date().toISOString(),
          new Date().toISOString()
        ]);
        
        return true;
      } catch (error) {
        console.error(`   ❌ Failed to insert code ${code.code}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.all(insertPromises);
    const successCount = results.filter(r => r).length;
    totalInserted += successCount;
    
    console.log(`   ✅ Imported ${successCount}/${dentalCodes.length} codes`);
  }
  
  return totalInserted;
}

/**
 * Generate and display summary statistics
 */
async function displaySummary(client) {
  // Basic statistics
  const statsResult = await client.query(`
    SELECT 
      COUNT(*) as total_codes,
      COUNT(DISTINCT practice_id) as total_practices,
      COUNT(DISTINCT category) as category_count,
      ROUND(AVG(price), 2) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM practice_tariffs 
    WHERE practice_type = 'dental'
  `);
  
  const stats = statsResult.rows[0];
  
  console.log('\n🎉 Import completed successfully!');
  console.log(`   • Total codes imported: ${stats.total_codes}`);
  console.log(`   • Practices updated: ${stats.total_practices}`);
  console.log(`   • Categories created: ${stats.category_count}`);
  console.log(`   • Average price: N$${stats.avg_price}`);
  console.log(`   • Price range: N$${stats.min_price} - N$${stats.max_price}`);
  
  // Category breakdown
  const categoryResult = await client.query(`
    SELECT 
      category,
      COUNT(*) as code_count,
      MIN(price) as min_price,
      MAX(price) as max_price,
      ROUND(AVG(price), 2) as avg_price
    FROM practice_tariffs 
    WHERE practice_type = 'dental'
    GROUP BY category
    ORDER BY category
  `);
  
  console.log('\n📊 Summary by Category:');
  console.table(categoryResult.rows);
  
  // Most expensive procedures
  const expensiveResult = await client.query(`
    SELECT 
      code,
      namaf_prace_2025 as name,
      category,
      price
    FROM practice_tariffs 
    WHERE practice_type = 'dental'
    ORDER BY price DESC
    LIMIT 10
  `);
  
  console.log('\n💰 Top 10 Most Expensive Procedures:');
  console.table(expensiveResult.rows);
}

/**
 * Main import function
 */
async function main() {
  console.log('🦷 COMPREHENSIVE DENTAL TARIFFS IMPORTER');
  console.log('========================================\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database\n');
    
    // Try to read data from multiple sources
    let dentalCodes = null;
    
    // First try local CSV
    console.log('📖 Attempting to read local CSV file...');
    dentalCodes = await readCSVData(LOCAL_CSV_PATH);
    
    // If local CSV fails, try Excel file
    if (!dentalCodes && fs.existsSync(REMOTE_EXCEL_PATH)) {
      console.log('📖 Attempting to read Excel file...');
      dentalCodes = readExcelData(REMOTE_EXCEL_PATH);
    }
    
    // If both fail, use sample data
    if (!dentalCodes || dentalCodes.length === 0) {
      console.log('⚠️  No data files found, using built-in sample data...');
      dentalCodes = getSampleDentalCodes();
    }
    
    console.log(`✅ Loaded ${dentalCodes.length} dental codes\n`);
    
    // Show sample of data
    console.log('📋 Sample codes to be imported:');
    dentalCodes.slice(0, 5).forEach(code => {
      console.log(`   • ${code.code}: ${code.name} - N$${code.price} (${code.category})`);
    });
    console.log();
    
    // Ensure practices exist
    const practices = await ensurePracticesExist(client);
    
    // Import the data
    const totalInserted = await importDentalCodes(client, dentalCodes, practices);
    
    // Display summary
    await displaySummary(client);
    
    console.log('\n✅ Dental tariffs import completed successfully!');
    console.log('🔧 Next steps:');
    console.log('   1. Verify data in the OneHealth admin dashboard');
    console.log('   2. Customize prices for individual practices if needed');
    console.log('   3. Test appointment booking with new tariffs');
    console.log('   4. Configure SMS notifications for appointments');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify database connection');
    console.log('   2. Ensure data files exist and are readable');
    console.log('   3. Check practice_tariffs table structure');
  } finally {
    await client.end();
  }
}

/**
 * Sample dental codes if no external file is available
 */
function getSampleDentalCodes() {
  return [
    { code: '001', price: 95.00, name: 'Initial comprehensive oral examination', category: 'Consultation & Examination', subcategory: 'Initial Consultation', complexity: 'Simple', notes: '' },
    { code: '002', price: 65.00, name: 'Periodic oral examination', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple', notes: '' },
    { code: '003', price: 55.00, name: 'Limited oral examination - problem focused', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple', notes: '' },
    { code: '004', price: 135.00, name: 'Emergency oral examination', category: 'Consultation & Examination', subcategory: 'Emergency', complexity: 'Simple', notes: '' },
    { code: '211', price: 185.00, name: 'Amalgam filling - 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple', notes: '' },
    { code: '221', price: 225.00, name: 'Composite filling - anterior 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple', notes: '' },
    { code: '271', price: 1885.00, name: 'Porcelain fused to metal crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex', notes: '' },
    { code: '331', price: 1285.00, name: 'Root canal - anterior tooth', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex', notes: '' },
    { code: '411', price: 285.00, name: 'Routine prophylaxis', category: 'Periodontics', subcategory: 'Cleaning', complexity: 'Simple', notes: '' },
    { code: '501', price: 285.00, name: 'Simple extraction', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Simple', notes: '' },
    { code: '601', price: 3485.00, name: 'Complete upper denture', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex', notes: '' },
    { code: '711', price: 18500.00, name: 'Metal braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex', notes: '' },
    { code: '801', price: 185.00, name: 'Child prophylaxis', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple', notes: '' },
    { code: '901', price: 785.00, name: 'Professional in-office whitening', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Moderate', notes: '' },
    { code: '911', price: 1685.00, name: 'Porcelain veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Moderate', notes: '' }
  ];
}

// Run the import
main().catch(console.error);