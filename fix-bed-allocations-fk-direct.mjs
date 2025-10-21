import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
});

async function fixFK() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Check current constraint
    const checkQuery = `
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'bed_allocations' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%bed_id%';
    `;
    const checkResult = await client.query(checkQuery);
    console.log('Current constraints:', checkResult.rows);

    // Step 2: Drop old constraint
    console.log('\n🔧 Dropping old FK constraint...');
    await client.query('ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey CASCADE;');
    console.log('✅ Old constraint dropped');

    // Step 3: Add new constraint pointing to beds table
    console.log('\n🔧 Adding new FK constraint to beds table...');
    await client.query(`
      ALTER TABLE bed_allocations 
      ADD CONSTRAINT bed_allocations_bed_id_fkey 
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;
    `);
    console.log('✅ New constraint added pointing to beds table!');

    // Step 4: Verify
    const verifyResult = await client.query(checkQuery);
    console.log('\n✅ VERIFICATION - Current constraints:', verifyResult.rows);

    console.log('\n🎉 SUCCESS! bed_allocations now points to beds table!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixFK();
