import pg from 'pg';
const { Client } = pg;

// Direct PostgreSQL connection (construct from Supabase credentials)
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:Imhappy@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

async function checkConstraint() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Query 1: Get the constraint definition
    console.log('📋 Query 1: Check Constraint Definition');
    console.log('─'.repeat(70));

    const constraintQuery = `
      SELECT
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as constraint_definition,
        con.contype as constraint_type
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'practices'
        AND (con.conname LIKE '%status%' OR con.contype = 'c')
      ORDER BY con.conname;
    `;

    const constraintResult = await client.query(constraintQuery);

    if (constraintResult.rows.length > 0) {
      console.log(`✅ Found ${constraintResult.rows.length} constraint(s):\n`);
      constraintResult.rows.forEach(row => {
        console.log(`Constraint Name: ${row.constraint_name}`);
        console.log(`Type: ${row.constraint_type === 'c' ? 'CHECK' : row.constraint_type}`);
        console.log(`Definition: ${row.constraint_definition}`);
        console.log('─'.repeat(70));
      });
    } else {
      console.log('⚠️  No check constraints found on practices table');
    }

    // Query 2: Get column details for status
    console.log('\n📋 Query 2: Status Column Details');
    console.log('─'.repeat(70));

    const columnQuery = `
      SELECT
        a.attname as column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null,
        pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_value,
        col_description(a.attrelid, a.attnum) as column_comment
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
      WHERE a.attrelid = 'public.practices'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = 'status'
      ORDER BY a.attnum;
    `;

    const columnResult = await client.query(columnQuery);

    if (columnResult.rows.length > 0) {
      console.log('✅ Status column found:\n');
      columnResult.rows.forEach(col => {
        console.log(`Column Name: ${col.column_name}`);
        console.log(`Data Type: ${col.data_type}`);
        console.log(`Not Null: ${col.not_null}`);
        console.log(`Default: ${col.default_value || 'NULL'}`);
        console.log(`Comment: ${col.column_comment || 'None'}`);
      });
    } else {
      console.log('⚠️  Status column not found');
    }

    // Query 3: Get all columns for practices table
    console.log('\n📋 Query 3: All Practices Table Columns');
    console.log('─'.repeat(70));

    const allColumnsQuery = `
      SELECT
        a.attname as column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.practices'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum;
    `;

    const allColumnsResult = await client.query(allColumnsQuery);
    console.log(`✅ Total columns: ${allColumnsResult.rows.length}\n`);
    allColumnsResult.rows.forEach((col, idx) => {
      const nullStr = col.not_null ? 'NOT NULL' : 'NULL';
      console.log(`${idx + 1}. ${col.column_name} (${col.data_type}) ${nullStr}`);
    });

    // Query 4: Sample data
    console.log('\n📋 Query 4: Sample Status Values in Database');
    console.log('─'.repeat(70));

    const sampleQuery = `
      SELECT name, status, created_at
      FROM practices
      ORDER BY created_at DESC
      LIMIT 10;
    `;

    const sampleResult = await client.query(sampleQuery);
    console.log(`✅ Sample practices (${sampleResult.rows.length} shown):\n`);
    sampleResult.rows.forEach(practice => {
      console.log(`${practice.name}: "${practice.status || 'NULL'}"`);
    });

    // Query 5: Get distinct status values with counts
    console.log('\n📋 Query 5: Distinct Status Values');
    console.log('─'.repeat(70));

    const distinctQuery = `
      SELECT status, COUNT(*) as count
      FROM practices
      GROUP BY status
      ORDER BY count DESC;
    `;

    const distinctResult = await client.query(distinctQuery);
    console.log('✅ Status value distribution:\n');
    distinctResult.rows.forEach(row => {
      console.log(`"${row.status || 'NULL'}": ${row.count} practices`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ Connection closed');
  }
}

console.log('🚀 Practices Status Constraint Direct Query\n');
checkConstraint().catch(console.error);