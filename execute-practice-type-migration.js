import pg from 'pg';

async function executePracticeTypeMigration() {
  console.log('🏗️  Executing proper practice type normalization migration...\n');
  
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Step 1: Get current practice types
    console.log('\n1. Analyzing current structure...');
    const practicesResult = await client.query(`
      SELECT id, name, practice_type 
      FROM practices 
      ORDER BY practice_type
    `);
    
    console.log('   📋 Current practices:');
    practicesResult.rows.forEach(p => {
      console.log(`     - ${p.name}: ${p.practice_type} (${p.id})`);
    });
    
    const practiceTypes = [...new Set(practicesResult.rows.map(p => p.practice_type))];
    console.log(`   🏷️  Practice types found: ${practiceTypes.join(', ')}`);
    
    // Step 2: Create practice_types lookup table
    console.log('\n2. Creating practice_types lookup table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS practice_types (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('   ✅ Created practice_types table');
    
    // Step 3: Insert practice types
    console.log('\n3. Inserting practice types...');
    const typeIds = {};
    
    for (const type of practiceTypes) {
      const description = `${type.charAt(0).toUpperCase() + type.slice(1)} practice type`;
      
      const insertResult = await client.query(`
        INSERT INTO practice_types (name, description) 
        VALUES ($1, $2) 
        ON CONFLICT (name) DO UPDATE SET description = $2 
        RETURNING id
      `, [type, description]);
      
      typeIds[type] = insertResult.rows[0].id;
      console.log(`   ✅ ${type}: ${typeIds[type]}`);
    }
    
    // Step 4: Add practice_type_id to practices table
    console.log('\n4. Adding practice_type_id to practices table...');
    await client.query(`
      ALTER TABLE practices 
      ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id)
    `);
    console.log('   ✅ Added practice_type_id column to practices');
    
    // Step 5: Update practices with correct practice_type_id
    console.log('\n5. Updating practices with practice_type_id...');
    for (const practice of practicesResult.rows) {
      await client.query(`
        UPDATE practices 
        SET practice_type_id = $1 
        WHERE id = $2
      `, [typeIds[practice.practice_type], practice.id]);
      
      console.log(`   ✅ Updated ${practice.name}: ${practice.practice_type} → ${typeIds[practice.practice_type]}`);
    }
    
    // Step 6: Add practice_type_id to practice_tariffs table
    console.log('\n6. Adding practice_type_id to practice_tariffs table...');
    await client.query(`
      ALTER TABLE practice_tariffs 
      ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id)
    `);
    console.log('   ✅ Added practice_type_id column to practice_tariffs');
    
    // Step 7: Update all dental codes to dental practice type
    console.log('\n7. Updating practice_tariffs with dental practice_type_id...');
    const dentalTypeId = typeIds['dental'];
    
    const updateResult = await client.query(`
      UPDATE practice_tariffs 
      SET practice_type_id = $1 
      WHERE practice_type_id IS NULL
    `, [dentalTypeId]);
    
    console.log(`   ✅ Updated ${updateResult.rowCount} tariff records to dental type`);
    
    // Step 8: Create view for easy querying
    console.log('\n8. Creating practice_tariffs_with_types view...');
    await client.query(`
      CREATE OR REPLACE VIEW practice_tariffs_with_types AS
      SELECT 
        pt.*,
        ptype.name as practice_type_name,
        ptype.description as practice_type_description,
        ptype.id as practice_type_id_resolved
      FROM practice_tariffs pt
      JOIN practice_types ptype ON pt.practice_type_id = ptype.id
      WHERE pt.is_active = true AND ptype.is_active = true
      ORDER BY pt.code
    `);
    console.log('   ✅ Created practice_tariffs_with_types view');
    
    // Step 9: Set up RLS policies
    console.log('\n9. Setting up RLS policies...');
    
    // Enable RLS on practice_types
    await client.query(`ALTER TABLE practice_types ENABLE ROW LEVEL SECURITY`);
    
    // Create policies
    await client.query(`
      CREATE POLICY IF NOT EXISTS "practice_types_read_all" 
      ON practice_types FOR SELECT USING (true)
    `);
    
    await client.query(`
      CREATE POLICY IF NOT EXISTS "practice_tariffs_read_all" 
      ON practice_tariffs FOR SELECT USING (true)
    `);
    
    // Grant permissions
    await client.query(`GRANT SELECT ON practice_types TO anon, authenticated`);
    await client.query(`GRANT SELECT ON practice_tariffs TO anon, authenticated`);
    await client.query(`GRANT SELECT ON practice_tariffs_with_types TO anon, authenticated`);
    
    console.log('   ✅ Set up RLS policies and permissions');
    
    // Step 10: Verify the setup
    console.log('\n10. Verifying the setup...');
    
    const verifyResult = await client.query(`
      SELECT 
        practice_type_name,
        COUNT(*) as tariff_count
      FROM practice_tariffs_with_types 
      GROUP BY practice_type_name
    `);
    
    console.log('   📊 Tariffs by practice type:');
    verifyResult.rows.forEach(row => {
      console.log(`     - ${row.practice_type_name}: ${row.tariff_count} codes`);
    });
    
    // Sample data from view
    const sampleResult = await client.query(`
      SELECT code, description, practice_type_name 
      FROM practice_tariffs_with_types 
      LIMIT 5
    `);
    
    console.log('\n   📋 Sample data from view:');
    sampleResult.rows.forEach(row => {
      console.log(`     ${row.code}: ${row.description} (${row.practice_type_name})`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Created practice_types lookup table');
    console.log('   ✅ Added practice_type_id FK to practices table');
    console.log('   ✅ Added practice_type_id FK to practice_tariffs table');
    console.log('   ✅ Created practice_tariffs_with_types view');
    console.log('   ✅ Set up proper RLS policies');
    console.log('\n🎯 Next step: Update EnhancedServiceSelector to use the view');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

executePracticeTypeMigration();