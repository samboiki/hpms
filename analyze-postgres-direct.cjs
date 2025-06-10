const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function analyzePostgresDirect() {
  console.log('🐘 Analyzing PostgreSQL database directly...\n');
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Get all tables with detailed info
    console.log('\n📊 COMPREHENSIVE TABLE ANALYSIS:');
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;
    
    const { rows: tables } = await client.query(tablesQuery);
    console.log('📋 All Tables:', tables);

    // Get detailed column information for key tables
    console.log('\n🔍 DETAILED COLUMN ANALYSIS:');
    const columnsQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name IN ('patients', 'visits', 'appointments', 'medical_aid_details', 'medical_aid_providers', 'practices', 'visit_services', 'practice_tariffs', 'invoices', 'invoice_items')
      ORDER BY table_name, ordinal_position;
    `;
    
    const { rows: columns } = await client.query(columnsQuery);
    console.log('📝 Key Table Columns:', columns);

    // Get foreign key relationships
    console.log('\n🔗 FOREIGN KEY RELATIONSHIPS:');
    const foreignKeysQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;
    
    const { rows: foreignKeys } = await client.query(foreignKeysQuery);
    console.log('🔗 Foreign Keys:', foreignKeys);

    // Get all functions
    console.log('\n⚙️ DATABASE FUNCTIONS:');
    const functionsQuery = `
      SELECT 
        p.proname as function_name,
        pg_get_function_result(p.oid) as return_type,
        pg_get_function_arguments(p.oid) as arguments,
        p.prosrc as source_code
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      ORDER BY p.proname;
    `;
    
    const { rows: functions } = await client.query(functionsQuery);
    console.log('📝 Custom Functions:', functions.map(f => ({
      name: f.function_name,
      return_type: f.return_type,
      arguments: f.arguments
    })));

    // Get all triggers
    console.log('\n🔔 DATABASE TRIGGERS:');
    const triggersQuery = `
      SELECT 
        t.trigger_name,
        t.event_manipulation,
        t.event_object_table,
        p.prosrc as trigger_function_code
      FROM information_schema.triggers t
      JOIN pg_proc p ON p.proname = replace(t.action_statement, 'EXECUTE FUNCTION ', '')
      WHERE t.trigger_schema = 'public'
      ORDER BY t.event_object_table, t.trigger_name;
    `;
    
    const { rows: triggers } = await client.query(triggersQuery);
    console.log('🔔 Triggers:', triggers);

    // Get indexes
    console.log('\n📊 DATABASE INDEXES:');
    const indexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    
    const { rows: indexes } = await client.query(indexesQuery);
    console.log('📊 Indexes:', indexes);

    // Analyze current billing data structure
    console.log('\n💰 CURRENT BILLING DATA ANALYSIS:');
    
    // Check for existing invoices structure
    try {
      const invoiceQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'invoices' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      const { rows: invoiceColumns } = await client.query(invoiceQuery);
      console.log('💳 Invoice table structure:', invoiceColumns);
    } catch (error) {
      console.log('💳 Invoice table does not exist');
    }

    // Check visit_services structure (current billing items)
    try {
      const visitServicesQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'visit_services' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      const { rows: visitServicesColumns } = await client.query(visitServicesQuery);
      console.log('🔧 Visit Services table structure:', visitServicesColumns);
    } catch (error) {
      console.log('🔧 Visit Services table analysis failed');
    }

    // Sample data from key tables
    console.log('\n📈 SAMPLE DATA ANALYSIS:');
    
    const sampleQueries = [
      { name: 'Medical Aid Providers', query: 'SELECT * FROM medical_aid_providers LIMIT 5' },
      { name: 'Medical Aid Details', query: 'SELECT * FROM medical_aid_details LIMIT 3' },
      { name: 'Practices', query: 'SELECT * FROM practices LIMIT 5' },
      { name: 'Practice Tariffs', query: 'SELECT * FROM practice_tariffs LIMIT 5' },
      { name: 'Visit Services', query: 'SELECT * FROM visit_services LIMIT 5' }
    ];

    const sampleData = {};
    for (const sample of sampleQueries) {
      try {
        const { rows } = await client.query(sample.query);
        sampleData[sample.name] = rows;
        console.log(`✅ ${sample.name}: ${rows.length} sample records`);
      } catch (error) {
        console.log(`❌ ${sample.name}: ${error.message}`);
        sampleData[sample.name] = { error: error.message };
      }
    }

    const postgresAnalysis = {
      timestamp: new Date().toISOString(),
      tables: tables,
      columns: columns,
      foreignKeys: foreignKeys,
      functions: functions.map(f => ({
        name: f.function_name,
        return_type: f.return_type,
        arguments: f.arguments,
        source_preview: f.source_code?.substring(0, 200) + '...'
      })),
      triggers: triggers,
      indexes: indexes,
      sampleData: sampleData
    };

    fs.writeFileSync('postgres-direct-analysis.json', JSON.stringify(postgresAnalysis, null, 2));
    console.log('\n💾 PostgreSQL analysis saved to postgres-direct-analysis.json');

    return postgresAnalysis;

  } catch (error) {
    console.error('❌ PostgreSQL analysis failed:', error);
    return null;
  } finally {
    await client.end();
  }
}

analyzePostgresDirect();