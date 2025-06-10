const pg = require('pg');
const fs = require('fs');

// Database connection
const client = new pg.Client({
  host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'T@ngisasa200',
  ssl: { rejectUnauthorized: false }
});

async function analyzeDatabase() {
  try {
    await client.connect();
    console.log('Connected to database');

    const results = {};

    // 1. Get all tables
    console.log('\n1. FETCHING ALL TABLES...');
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `;
    const tablesResult = await client.query(tablesQuery);
    results.allTables = tablesResult.rows;
    console.log(`Found ${tablesResult.rows.length} tables`);

    // 2. Get billing-related tables
    console.log('\n2. CHECKING BILLING-RELATED TABLES...');
    const billingTablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (tablename LIKE '%invoice%' OR tablename LIKE '%billing%' OR tablename LIKE '%payment%' 
           OR tablename LIKE '%claim%' OR tablename LIKE '%tariff%' OR tablename LIKE '%receipt%'
           OR tablename LIKE '%visit_service%' OR tablename LIKE '%medical_aid%')
      ORDER BY tablename;
    `;
    const billingTables = await client.query(billingTablesQuery);
    results.billingTables = billingTables.rows;

    // 3. Check for batch/queue tables
    console.log('\n3. CHECKING BATCH/QUEUE TABLES...');
    const batchTablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (tablename LIKE '%batch%' OR tablename LIKE '%queue%' OR tablename LIKE '%job%')
      ORDER BY tablename;
    `;
    const batchTables = await client.query(batchTablesQuery);
    results.batchTables = batchTables.rows;

    // 4. Get structure of key tables
    const keyTables = ['invoices', 'visits', 'patients', 'medical_aid_providers', 'practices', 
                       'visit_services', 'practice_tariffs', 'medical_aid_details'];
    
    results.tableStructures = {};
    
    for (const tableName of keyTables) {
      console.log(`\n4. ANALYZING ${tableName.toUpperCase()} STRUCTURE...`);
      const structureQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `;
      
      try {
        const structure = await client.query(structureQuery, [tableName]);
        results.tableStructures[tableName] = structure.rows;
        console.log(`  Found ${structure.rows.length} columns`);
      } catch (err) {
        console.log(`  Table ${tableName} not found or error: ${err.message}`);
      }
    }

    // 5. Get foreign key relationships
    console.log('\n5. ANALYZING FOREIGN KEY RELATIONSHIPS...');
    const fkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
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
    const fkResult = await client.query(fkQuery);
    results.foreignKeys = fkResult.rows;

    // 6. Get sample data from medical_aid_providers
    console.log('\n6. FETCHING MEDICAL AID PROVIDERS SAMPLE...');
    const medicalAidQuery = `
      SELECT * FROM medical_aid_providers
      ORDER BY name
      LIMIT 10;
    `;
    try {
      const medicalAidResult = await client.query(medicalAidQuery);
      results.medicalAidSample = medicalAidResult.rows;
    } catch (err) {
      console.log(`  Error fetching medical aid providers: ${err.message}`);
    }

    // 7. Check for any financial batch tables
    console.log('\n7. CHECKING FINANCIAL BATCH TABLES...');
    const financialBatchQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (tablename LIKE '%financial%' OR tablename LIKE '%batch%' OR tablename LIKE '%claim%'
           OR tablename LIKE '%submission%' OR tablename LIKE '%remittance%')
      ORDER BY tablename;
    `;
    const financialBatch = await client.query(financialBatchQuery);
    results.financialBatchTables = financialBatch.rows;

    // Display comprehensive summary
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE ANALYSIS SUMMARY');
    console.log('='.repeat(80));

    console.log('\n1. ALL TABLES:');
    console.log('-'.repeat(40));
    results.allTables.forEach(table => {
      console.log(`  ${table.schemaname}.${table.tablename}`);
    });

    console.log('\n2. BILLING/FINANCIAL TABLES:');
    console.log('-'.repeat(40));
    results.billingTables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });

    console.log('\n3. BATCH/QUEUE TABLES:');
    console.log('-'.repeat(40));
    if (results.batchTables.length > 0) {
      results.batchTables.forEach(table => {
        console.log(`  - ${table.tablename}`);
      });
    } else {
      console.log('  No batch/queue tables found');
    }

    console.log('\n4. KEY TABLE STRUCTURES:');
    console.log('-'.repeat(40));
    Object.entries(results.tableStructures).forEach(([tableName, columns]) => {
      if (columns && columns.length > 0) {
        console.log(`\n  ${tableName.toUpperCase()}:`);
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`    ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
        });
      }
    });

    console.log('\n5. KEY RELATIONSHIPS:');
    console.log('-'.repeat(40));
    const billingRelated = results.foreignKeys.filter(fk => 
      ['invoices', 'visits', 'patients', 'medical_aid_providers', 'practices', 'visit_services'].includes(fk.table_name) ||
      ['invoices', 'visits', 'patients', 'medical_aid_providers', 'practices', 'visit_services'].includes(fk.foreign_table_name)
    );
    billingRelated.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    console.log('\n6. MEDICAL AID PROVIDERS SAMPLE:');
    console.log('-'.repeat(40));
    if (results.medicalAidSample && results.medicalAidSample.length > 0) {
      results.medicalAidSample.slice(0, 3).forEach((provider, idx) => {
        console.log(`  Provider ${idx + 1}:`);
        Object.entries(provider).forEach(([key, value]) => {
          if (value !== null) {
            console.log(`    ${key}: ${value}`);
          }
        });
        console.log();
      });
    }

    // Save detailed results
    fs.writeFileSync('database-analysis.json', JSON.stringify(results, null, 2));
    console.log('\nDetailed results saved to database-analysis.json');

    // Generate comprehensive summary
    const summary = {
      totalTables: results.allTables.length,
      billingTables: results.billingTables.map(t => t.tablename),
      batchTables: results.batchTables.map(t => t.tablename),
      hasInvoicesTable: results.tableStructures.invoices ? true : false,
      hasVisitServicesTable: results.tableStructures.visit_services ? true : false,
      hasPracticeTariffsTable: results.tableStructures.practice_tariffs ? true : false,
      medicalAidProvidersCount: results.medicalAidSample ? results.medicalAidSample.length : 0,
      keyRelationships: billingRelated.length
    };

    console.log('\n7. SYSTEM SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`  Total Tables: ${summary.totalTables}`);
    console.log(`  Billing-Related Tables: ${summary.billingTables.length}`);
    console.log(`  Batch Processing Tables: ${summary.batchTables.length}`);
    console.log(`  Has Invoices Table: ${summary.hasInvoicesTable}`);
    console.log(`  Has Visit Services Table: ${summary.hasVisitServicesTable}`);
    console.log(`  Has Practice Tariffs Table: ${summary.hasPracticeTariffsTable}`);
    console.log(`  Medical Aid Providers: ${summary.medicalAidProvidersCount}+`);
    console.log(`  Key Relationships: ${summary.keyRelationships}`);

  } catch (err) {
    console.error('Error analyzing database:', err);
  } finally {
    await client.end();
  }
}

analyzeDatabase();