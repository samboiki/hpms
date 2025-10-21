import postgres from 'postgres';

const sql = postgres(process.env.SUPABASE_DB_URL || 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:Farma2025!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');

async function fixBedAllocationsForeignKey() {
  try {
    console.log('🔍 Step 1: Checking current constraints on bed_allocations.bed_id...\n');

    const currentConstraints = await sql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='bed_allocations'
        AND kcu.column_name='bed_id'
    `;

    console.log('Current constraints:', currentConstraints);

    console.log('\n🗑️  Step 2: Dropping old foreign key constraint...\n');

    await sql`
      ALTER TABLE bed_allocations
      DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey
    `;

    console.log('✅ Constraint dropped successfully');

    console.log('\n➕ Step 3: Adding new foreign key to beds table...\n');

    await sql`
      ALTER TABLE bed_allocations
      ADD CONSTRAINT bed_allocations_bed_id_fkey
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE
    `;

    console.log('✅ New constraint added successfully');

    console.log('\n✅ Step 4: Verifying the new constraint...\n');

    const verifiedConstraints = await sql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='bed_allocations'
        AND kcu.column_name='bed_id'
    `;

    console.log('Verified constraints:', verifiedConstraints);

    console.log('\n🎉 Foreign key constraint fix completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

fixBedAllocationsForeignKey();
