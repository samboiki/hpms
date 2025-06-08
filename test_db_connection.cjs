const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Check existing practices
    const practicesResult = await client.query(`
      SELECT id, name, practice_type, city 
      FROM practices 
      ORDER BY name
    `);
    
    console.log('\nExisting practices:');
    console.table(practicesResult.rows);

    // Check practice_tariffs table structure
    const tariffStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nPractice_tariffs table structure:');
    console.table(tariffStructure.rows);

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();