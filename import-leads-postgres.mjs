import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

// Supabase connection details
const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres.jjxlfunlbyayxwvlpgwt:' + process.env.SUPABASE_DB_PASSWORD +
  '@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function importClientLeads() {
  const client = new Client({ connectionString });

  try {
    console.log('📊 Starting client leads import with PostgreSQL direct connection...\n');

    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Step 1: Create table
    console.log('1️⃣ Creating client_leads table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        discipline_code TEXT,
        discipline_name TEXT,
        practice_number TEXT UNIQUE NOT NULL,
        practice_name TEXT,
        town TEXT,
        phone TEXT,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Table created\n');

    // Create indexes
    console.log('2️⃣ Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_leads_practice_number ON client_leads(practice_number);
      CREATE INDEX IF NOT EXISTS idx_client_leads_town ON client_leads(town);
      CREATE INDEX IF NOT EXISTS idx_client_leads_discipline_name ON client_leads(discipline_name);
    `);
    console.log('✅ Indexes created\n');

    // Enable RLS
    console.log('3️⃣ Setting up Row Level Security...');
    await client.query(`ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'client_leads'
          AND policyname = 'Service role has full access to client_leads'
        ) THEN
          CREATE POLICY "Service role has full access to client_leads"
            ON client_leads
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'client_leads'
          AND policyname = 'Authenticated users can read client_leads'
        ) THEN
          CREATE POLICY "Authenticated users can read client_leads"
            ON client_leads
            FOR SELECT
            TO authenticated
            USING (true);
        END IF;
      END $$;
    `);
    console.log('✅ RLS policies created\n');

    // Step 2: Read and parse CSV
    console.log('4️⃣ Reading CSV file...');
    const csvPath = 'C:\\Users\\Happyou2\\Downloads\\CLIENTS.csv';
    const csvContent = readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log(`✅ Read ${lines.length} lines\n`);

    console.log('5️⃣ Parsing CSV data...');
    const dataLines = lines.slice(1); // Skip header
    const records = [];

    for (const line of dataLines) {
      const parts = line.split(',');
      if (parts.length >= 7 && parts[2]?.trim()) {
        records.push({
          discipline_code: parts[0]?.trim() || null,
          discipline_name: parts[1]?.trim() || null,
          practice_number: parts[2]?.trim(),
          practice_name: parts[3]?.trim() || null,
          town: parts[4]?.trim() || null,
          phone: parts[5]?.trim() === '0' ? null : parts[5]?.trim() || null,
          email: parts[6]?.trim() || null
        });
      }
    }

    console.log(`✅ Parsed ${records.length} valid records`);
    console.log(`📋 Sample:`, records[0]);
    console.log('');

    // Step 3: Insert records
    console.log('6️⃣ Inserting records into database...');

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    // Use transactions for better performance
    await client.query('BEGIN');

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        await client.query(`
          INSERT INTO client_leads (
            discipline_code, discipline_name, practice_number,
            practice_name, town, phone, email
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (practice_number) DO UPDATE SET
            discipline_code = EXCLUDED.discipline_code,
            discipline_name = EXCLUDED.discipline_name,
            practice_name = EXCLUDED.practice_name,
            town = EXCLUDED.town,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            updated_at = NOW()
        `, [
          record.discipline_code,
          record.discipline_name,
          record.practice_number,
          record.practice_name,
          record.town,
          record.phone,
          record.email
        ]);

        successCount++;

        // Progress indicator
        if ((i + 1) % 100 === 0) {
          console.log(`   Progress: ${i + 1}/${records.length} records...`);
        }
      } catch (err) {
        if (err.code === '23505') { // Unique violation
          duplicateCount++;
        } else {
          console.error(`   ❌ Error on record ${i + 1}:`, err.message);
          errorCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Insertion complete\n`);

    // Step 4: Verify
    console.log('7️⃣ Verifying import...');
    const countResult = await client.query('SELECT COUNT(*) FROM client_leads');
    const totalCount = parseInt(countResult.rows[0].count);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`📁 CSV records processed: ${records.length}`);
    console.log(`✅ Successfully imported/updated: ${successCount} records`);
    console.log(`⚠️  Duplicates handled: ${duplicateCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log(`📈 Total in database: ${totalCount} records`);
    console.log('='.repeat(70));

    // Sample data
    console.log('\n8️⃣ Sample imported records:');
    const samplesResult = await client.query(`
      SELECT * FROM client_leads
      ORDER BY created_at DESC
      LIMIT 5
    `);

    samplesResult.rows.forEach((s, i) => {
      console.log(`\n${i + 1}. ${s.practice_name}`);
      console.log(`   Practice #: ${s.practice_number}`);
      console.log(`   Discipline: ${s.discipline_name}`);
      console.log(`   Town: ${s.town}`);
      console.log(`   Phone: ${s.phone || 'N/A'}`);
      console.log(`   Email: ${s.email || 'N/A'}`);
    });

    // Statistics by discipline
    console.log('\n9️⃣ Statistics by discipline:');
    const disciplineStats = await client.query(`
      SELECT discipline_name, COUNT(*) as count
      FROM client_leads
      GROUP BY discipline_name
      ORDER BY count DESC
    `);

    disciplineStats.rows.forEach(row => {
      console.log(`   ${row.discipline_name}: ${row.count} practices`);
    });

    // Statistics by town
    console.log('\n🔟 Top 10 towns by practice count:');
    const townStats = await client.query(`
      SELECT town, COUNT(*) as count
      FROM client_leads
      WHERE town IS NOT NULL AND town != ''
      GROUP BY town
      ORDER BY count DESC
      LIMIT 10
    `);

    townStats.rows.forEach(row => {
      console.log(`   ${row.town}: ${row.count} practices`);
    });

    console.log('\n✅ Import process completed successfully!\n');

    return { successCount, errorCount, totalCount };

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the import
importClientLeads()
  .then(result => {
    console.log(`\n🎉 Successfully imported ${result.successCount} records!`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  });
