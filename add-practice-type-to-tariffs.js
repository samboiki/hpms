import pg from 'pg';

async function addPracticeTypeToTariffs() {
  console.log('🔧 Adding practice_type column to practice_tariffs table...\n');
  
  const client = new pg.Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.jjxlfunlbyayxwvlpgwt',
    password: 'T@ngisasa200',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Step 1: Check current table structure
    console.log('\n1. Checking current table structure...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      ORDER BY ordinal_position
    `);
    
    console.log('   Current columns:');
    columnsResult.rows.forEach(row => {
      console.log(`     - ${row.column_name}: ${row.data_type}`);
    });
    
    const haspracticeType = columnsResult.rows.some(row => row.column_name === 'practice_type');
    
    if (!haspracticeType) {
      // Step 2: Add practice_type column
      console.log('\n2. Adding practice_type column...');
      await client.query(`
        ALTER TABLE practice_tariffs 
        ADD COLUMN practice_type TEXT
      `);
      console.log('   ✅ Successfully added practice_type column');
    } else {
      console.log('\n2. practice_type column already exists');
    }
    
    // Step 3: Update all existing dental codes to practice_type = 'dental'
    console.log('\n3. Updating all dental codes to practice_type = "dental"...');
    const updateResult = await client.query(`
      UPDATE practice_tariffs 
      SET practice_type = 'dental' 
      WHERE practice_type IS NULL OR practice_type = ''
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount} records to practice_type = 'dental'`);
    
    // Step 4: Verify the update
    console.log('\n4. Verifying the update...');
    const countResult = await client.query(`
      SELECT practice_type, COUNT(*) as count
      FROM practice_tariffs 
      GROUP BY practice_type
    `);
    
    console.log('   📊 Practice tariffs by type:');
    countResult.rows.forEach(row => {
      console.log(`     - ${row.practice_type}: ${row.count} codes`);
    });
    
    // Step 5: Create index for better performance
    console.log('\n5. Creating index on practice_type...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_type 
        ON practice_tariffs(practice_type)
      `);
      console.log('   ✅ Successfully created index');
    } catch (indexError) {
      console.log('   ⚠️  Index may already exist:', indexError.message);
    }
    
    // Step 6: Show sample data
    console.log('\n6. Sample updated records:');
    const sampleResult = await client.query(`
      SELECT code, description, practice_type 
      FROM practice_tariffs 
      LIMIT 5
    `);
    
    sampleResult.rows.forEach(row => {
      console.log(`     ${row.code}: ${row.description} (${row.practice_type})`);
    });
    
    console.log('\n🎉 Schema update completed successfully!');
    console.log('\nNow you can query dental codes using:');
    console.log('  - Filter by practice_type = "dental" for dental practices');
    console.log('  - Filter by practice_type = "medical" for medical practices');
    console.log('  - Filter by practice_type = "aesthetic" for aesthetic practices');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

addPracticeTypeToTariffs();