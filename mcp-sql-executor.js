import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeSQLDirectly() {
  console.log('🔗 MCP SQL Executor - Testing Direct Database Access...');
  
  try {
    // Test basic connectivity
    const { data: testData, error: testError } = await supabase
      .from('batch_headers')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Basic connectivity failed:', testError.message);
      return;
    }
    
    console.log('✅ MCP can connect to Supabase database!');
    console.log(`   Found ${testData?.length || 0} batch headers`);
    
    // Now execute the actual foreign key constraint
    console.log('\n🔗 Executing foreign key constraint directly...');
    
    // Method 1: Use database functions if available
    const { data: functionResult, error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE invoices_enhanced 
        ADD CONSTRAINT fk_invoices_enhanced_batch_id 
        FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
      `
    });
    
    if (functionError) {
      console.log('ℹ️  exec_sql function not available:', functionError.message);
      
      // Method 2: Use schema operations (if possible)
      console.log('🔧 Attempting schema modification through REST API...');
      
      const response = await fetch(`https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
        },
        body: JSON.stringify({
          query: `
            ALTER TABLE invoices_enhanced 
            ADD CONSTRAINT fk_invoices_enhanced_batch_id 
            FOREIGN KEY (batch_id) REFERENCES batch_headers(id);
          `
        })
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response:', responseText);
      
    } else {
      console.log('✅ Successfully executed SQL through database function!');
      console.log('Result:', functionResult);
    }
    
  } catch (error) {
    console.error('❌ MCP SQL execution failed:', error.message);
  }
}

// Execute the SQL
executeSQLDirectly();