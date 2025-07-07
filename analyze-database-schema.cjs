const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function analyzeDatabase() {
  console.log('🔍 Starting comprehensive database analysis...\n');
  
  try {
    // Get all tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names');
    
    if (tablesError) {
      console.log('Using alternative method to get tables...');
      const { data: schemaInfo } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      console.log('Tables found:', schemaInfo?.map(t => t.table_name) || 'Could not retrieve');
    } else {
      console.log('📊 TABLES FOUND:', tables);
    }

    // Get table structures and relationships
    const tableAnalysis = {};
    
    // Key tables to analyze
    const keyTables = [
      'patients', 'appointments', 'visits', 'medical_records', 'vitals',
      'medical_aid_details', 'medical_aid_providers', 'practices', 
      'visit_services', 'practice_tariffs', 'users', 'invoices', 
      'invoice_items', 'billing_transactions'
    ];

    for (const tableName of keyTables) {
      try {
        // Get table structure
        const { data: columns } = await supabase
          .rpc('get_table_columns', { table_name: tableName });
        
        // Get sample data (first 3 rows)
        const { data: sampleData, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(3);

        tableAnalysis[tableName] = {
          columns: columns || 'Could not retrieve',
          sampleData: sampleData || [],
          totalRows: count || 0
        };

        console.log(`✅ Analyzed ${tableName}: ${count || 0} rows`);
      } catch (error) {
        console.log(`⚠️  Could not analyze ${tableName}:`, error.message);
        tableAnalysis[tableName] = { error: error.message };
      }
    }

    // Get foreign key relationships
    console.log('\n🔗 ANALYZING RELATIONSHIPS...');
    try {
      const { data: relationships } = await supabase
        .from('information_schema.key_column_usage')
        .select(`
          table_name,
          column_name,
          referenced_table_name,
          referenced_column_name
        `)
        .not('referenced_table_name', 'is', null);
      
      console.log('🔗 FOREIGN KEY RELATIONSHIPS:', relationships);
    } catch (error) {
      console.log('Could not retrieve relationships:', error.message);
    }

    // Get functions and triggers
    console.log('\n⚙️ ANALYZING FUNCTIONS AND TRIGGERS...');
    try {
      const { data: functions } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type')
        .eq('routine_schema', 'public');
      
      console.log('📝 FUNCTIONS:', functions);
    } catch (error) {
      console.log('Could not retrieve functions:', error.message);
    }

    // Save analysis to file
    const analysis = {
      timestamp: new Date().toISOString(),
      tableAnalysis,
      summary: {
        totalTablesAnalyzed: Object.keys(tableAnalysis).length,
        tablesWithData: Object.values(tableAnalysis).filter(t => t.totalRows > 0).length
      }
    };

    fs.writeFileSync('database-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n💾 Analysis saved to database-analysis.json');

    return analysis;

  } catch (error) {
    console.error('❌ Database analysis failed:', error);
    return null;
  }
}

analyzeDatabase();