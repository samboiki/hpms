import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

async function executeDocumentsMigration() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read the SQL file
    const sql = fs.readFileSync('./create_documents_table.sql', 'utf8');
    
    // Execute the migration
    console.log('Executing documents table migration...');
    await client.query(sql);
    
    console.log('✅ Patient documents table created successfully');
    
    // Verify the table was created
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'patient_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('Table structure:');
    rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
  } catch (error) {
    console.error('Error executing migration:', error);
  } finally {
    await client.end();
  }
}

executeDocumentsMigration();