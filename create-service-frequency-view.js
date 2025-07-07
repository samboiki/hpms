import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: query
    });

    if (error) {
      console.error('❌ SQL execution failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, data };
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Creating service usage frequency view...\n');

  // Create the service frequency view
  const createViewQuery = `
    -- Create a view to analyze service frequency for dental practices
    CREATE OR REPLACE VIEW service_usage_frequency AS
    SELECT 
        inv_svc.code,
        inv_svc.description,
        COUNT(*) as usage_count,
        MAX(inv_svc.created_at) as last_used,
        MIN(inv_svc.created_at) as first_used,
        -- Calculate frequency rank (1 = most used)
        DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) as frequency_rank
    FROM invoice_services inv_svc
    INNER JOIN invoices_enhanced i ON i.id = inv_svc.invoice_id
    INNER JOIN practices p ON p.id = i.practice_id
    WHERE p.practice_type = 'dental'
    GROUP BY inv_svc.code, inv_svc.description
    ORDER BY usage_count DESC;
  `;

  const viewResult = await executeSql(createViewQuery);
  
  if (!viewResult.success) {
    console.log('❌ Failed to create view');
    return;
  }

  console.log('\n✅ Service frequency view created successfully!');

  // Grant permissions
  const grantQuery = `
    GRANT SELECT ON service_usage_frequency TO authenticated;
  `;

  const grantResult = await executeSql(grantQuery);
  
  if (!grantResult.success) {
    console.log('❌ Failed to grant permissions');
    return;
  }

  console.log('✅ Permissions granted successfully!');

  // Test the view
  const testQuery = `
    SELECT code, description, usage_count, frequency_rank 
    FROM service_usage_frequency 
    LIMIT 10;
  `;

  console.log('\n🔍 Testing the view with top 10 most used codes:');
  const testResult = await executeSql(testQuery);
  
  if (testResult.success) {
    console.log('✅ View is working correctly!');
  }

  console.log('\n🎉 SUCCESS! Service usage frequency view is ready for the billing system!');
}

main().catch(console.error);