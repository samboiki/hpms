const { Client } = require('pg');

async function checkMedicalAidTable() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'medical_aid_providers'
      );
    `;
    const tableExists = await client.query(tableExistsQuery);
    console.log('Table exists:', tableExists.rows[0].exists);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Table medical_aid_providers does not exist');
      return;
    }

    // Check table structure
    console.log('\n📋 TABLE STRUCTURE:');
    const structureQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await client.query(structureQuery);
    console.table(structureResult.rows);

    // Check existing data
    console.log('\n📊 SAMPLE DATA:');
    const dataQuery = 'SELECT * FROM medical_aid_providers LIMIT 5;';
    const dataResult = await client.query(dataQuery);
    
    if (dataResult.rows.length > 0) {
      console.table(dataResult.rows);
    } else {
      console.log('No data found in table');
    }

    // Check total count
    const countQuery = 'SELECT COUNT(*) as total_records FROM medical_aid_providers;';
    const countResult = await client.query(countQuery);
    console.log(`\n📈 Total records: ${countResult.rows[0].total_records}`);

    // Check for any existing logo-related columns
    console.log('\n🔍 CHECKING FOR LOGO-RELATED COLUMNS:');
    const logoColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'medical_aid_providers' 
      AND (column_name ILIKE '%logo%' OR column_name ILIKE '%image%' OR column_name ILIKE '%reference%');
    `;
    const logoColumns = await client.query(logoColumnsQuery);
    
    if (logoColumns.rows.length > 0) {
      console.log('Found logo-related columns:');
      logoColumns.rows.forEach(row => console.log(`- ${row.column_name}`));
    } else {
      console.log('No logo-related columns found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error details:', error);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

checkMedicalAidTable().catch(console.error);