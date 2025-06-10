import pg from 'pg';

async function checkMedicalAidStructure() {
  console.log('=== MEDICAL AID DATA STRUCTURE ANALYSIS ===\n');
  
  // Direct PostgreSQL connection
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // 1. Check medical_aid_details table structure
    console.log('1. MEDICAL_AID_DETAILS TABLE STRUCTURE:');
    console.log('=====================================');
    const detailsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_details' 
      ORDER BY ordinal_position
    `);
    
    if (detailsStructure.rows.length > 0) {
      detailsStructure.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
      });
    } else {
      console.log('Table not found or no columns');
    }
    
    // 2. Sample data from medical_aid_details
    console.log('\n2. SAMPLE MEDICAL_AID_DETAILS DATA:');
    console.log('==================================');
    const sampleDetails = await client.query(`
      SELECT * FROM medical_aid_details 
      LIMIT 5
    `);
    
    if (sampleDetails.rows.length > 0) {
      console.log(`Found ${sampleDetails.rows.length} sample records:`);
      sampleDetails.rows.forEach((row, index) => {
        console.log(`\nRecord ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('No data found in medical_aid_details table');
    }
    
    // 3. Check medical_aid_providers table structure
    console.log('\n3. MEDICAL_AID_PROVIDERS TABLE STRUCTURE:');
    console.log('========================================');
    const providersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      ORDER BY ordinal_position
    `);
    
    if (providersStructure.rows.length > 0) {
      providersStructure.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
      });
    } else {
      console.log('Table not found or no columns');
    }
    
    // 4. Sample data from medical_aid_providers
    console.log('\n4. MEDICAL_AID_PROVIDERS DATA:');
    console.log('=============================');
    const providers = await client.query(`
      SELECT * FROM medical_aid_providers 
      ORDER BY provider_name
    `);
    
    if (providers.rows.length > 0) {
      console.log(`Found ${providers.rows.length} providers:`);
      providers.rows.forEach((row, index) => {
        console.log(`\nProvider ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('No data found in medical_aid_providers table');
    }
    
    // 5. Check for any relationship between tables
    console.log('\n5. RELATIONSHIP ANALYSIS:');
    console.log('========================');
    
    // Check if there's a direct relationship
    const relationshipCheck = await client.query(`
      SELECT 
        mad.provider,
        COUNT(*) as patient_count,
        map.provider_name,
        map.logo_url,
        map.medical_aid_reference
      FROM medical_aid_details mad
      LEFT JOIN medical_aid_providers map ON (
        LOWER(mad.provider) = LOWER(map.provider_name) OR
        LOWER(mad.provider) = LOWER(map.medical_aid_reference)
      )
      GROUP BY mad.provider, map.provider_name, map.logo_url, map.medical_aid_reference
      ORDER BY patient_count DESC
    `);
    
    if (relationshipCheck.rows.length > 0) {
      console.log('Provider matching analysis:');
      relationshipCheck.rows.forEach(row => {
        console.log(`Provider: ${row.provider} (${row.patient_count} patients)`);
        console.log(`  Matched to: ${row.provider_name || 'NO MATCH'}`);
        console.log(`  Logo URL: ${row.logo_url || 'NO LOGO'}`);
        console.log(`  Reference: ${row.medical_aid_reference || 'NO REFERENCE'}`);
        console.log('');
      });
    }
    
    // 6. Check what provider values exist in medical_aid_details
    console.log('\n6. UNIQUE PROVIDERS IN MEDICAL_AID_DETAILS:');
    console.log('==========================================');
    const uniqueProviders = await client.query(`
      SELECT provider, COUNT(*) as count
      FROM medical_aid_details 
      WHERE provider IS NOT NULL
      GROUP BY provider
      ORDER BY count DESC
    `);
    
    if (uniqueProviders.rows.length > 0) {
      console.log('Unique providers found:');
      uniqueProviders.rows.forEach(row => {
        console.log(`  ${row.provider}: ${row.count} patients`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMedicalAidStructure();