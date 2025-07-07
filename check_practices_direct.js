import pg from 'pg';

async function checkPractices() {
  const client = new pg.Client({
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database successfully');

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
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkPractices();