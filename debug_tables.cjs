const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function debugTables() {
  try {
    console.log('🔍 Debugging table existence...');

    // List all tables in the database
    const { data: allTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.log('❌ Cannot query information_schema:', tablesError.message);
    } else {
      console.log('\n📋 All tables in public schema:');
      allTables.forEach(table => {
        const isTarget = ['visit_services', 'invoices_enhanced', 'invoice_items_enhanced'].includes(table.table_name);
        console.log(`  ${isTarget ? '🎯' : '  '} ${table.table_name}`);
      });
    }

    // Test specific table access
    console.log('\n🧪 Testing specific table access...');
    
    const testTables = ['visit_services', 'invoices_enhanced', 'invoice_items_enhanced'];
    
    for (const tableName of testTables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`  ${tableName}: ❌ ${error.message}`);
        } else {
          console.log(`  ${tableName}: ✅ ${count} records`);
        }
      } catch (err) {
        console.log(`  ${tableName}: ❌ Exception: ${err.message}`);
      }
    }

    // Check if the tables exist in a different schema or with different names
    console.log('\n🔎 Searching for similar table names...');
    
    if (allTables) {
      const searchTerms = ['visit', 'invoice', 'service', 'billing'];
      const relatedTables = allTables.filter(table => 
        searchTerms.some(term => table.table_name.includes(term))
      );
      
      if (relatedTables.length > 0) {
        console.log('  Found related tables:');
        relatedTables.forEach(table => console.log(`    - ${table.table_name}`));
      } else {
        console.log('  No related tables found');
      }
    }

    // Try to access the exact table names that our earlier test said existed
    console.log('\n🔧 Direct table access attempt...');
    
    try {
      // Use a different approach - try to run a simple query
      const { data, error } = await supabase.rpc('exec', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('visit_services', 'invoices_enhanced', 'invoice_items_enhanced')
        `
      });
      
      if (error) {
        console.log('❌ RPC query failed:', error.message);
      } else {
        console.log('✅ RPC query result:', data);
      }
    } catch (rpcError) {
      console.log('❌ RPC exception:', rpcError.message);
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugTables();