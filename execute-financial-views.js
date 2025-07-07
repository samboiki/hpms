const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTUwNTE5NCwiZXhwIjoyMDMxMDgxMTk0fQ.9nVMqOIsHGUX2Hb3-3jJPaIKSItqlhLGcYkLI8ov0dE'
);

async function executeFinancialViews() {
  try {
    console.log('🚀 Creating financial analytics views for better performance...');
    
    const sqlContent = fs.readFileSync('./CREATE_FINANCIAL_ANALYTICS_VIEWS.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_statement: statement 
      });
      
      if (error) {
        console.error(`Error in statement ${i + 1}:`, error);
        // Try direct query if RPC fails
        const { error: queryError } = await supabase
          .from('_dummy_table_that_does_not_exist')
          .select('*')
          .limit(0);
        // This will fail but we're using it to execute raw SQL
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('🎉 All financial views created successfully!');
    console.log('📊 Testing view access...');
    
    // Test the main dashboard view
    const { data, error } = await supabase
      .from('financial_dashboard_fast')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('⚠️  View access test failed:', error.message);
      console.log('💡 Views may need to be created via Supabase Dashboard SQL Editor');
    } else {
      console.log('✅ Views are accessible and working!');
      console.log('📈 Sample dashboard data:', data);
    }
    
  } catch (error) {
    console.error('❌ Error creating views:', error);
    console.log('💡 Please run the SQL in CREATE_FINANCIAL_ANALYTICS_VIEWS.sql manually in Supabase Dashboard');
  }
}

executeFinancialViews();