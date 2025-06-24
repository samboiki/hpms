import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function executeSql(query) {
  console.log('🔗 MCP SQL Executor');
  console.log('📝 Executing SQL query');
  console.log('🗂️  SQL:', query.substring(0, 200) + (query.length > 200 ? '...' : ''));
  
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

async function executeSqlFile(filename) {
  try {
    const sqlContent = readFileSync(filename, 'utf8');
    
    // Split by semicolon but be careful with function definitions
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    
    const lines = sqlContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim().toUpperCase();
      
      if (trimmedLine.startsWith('CREATE') && (trimmedLine.includes('FUNCTION') || trimmedLine.includes('PROCEDURE'))) {
        inFunction = true;
      }
      
      currentStatement += line + '\n';
      
      if (trimmedLine.includes('$$ LANGUAGE')) {
        inFunction = false;
      }
      
      // If we hit a semicolon and we're not in a function, it's end of statement
      if (line.trim().endsWith(';') && !inFunction) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Execute each statement
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}:`);
        const result = await executeSql(statement);
        
        if (!result.success) {
          console.error(`❌ Failed at statement ${i + 1}`);
          // Continue with other statements even if one fails
        }
      }
    }
    
    console.log('\n✅ All statements processed!');
  } catch (err) {
    console.error('❌ Error reading SQL file:', err);
  }
}

// Main execution
const filename = process.argv[2] || 'optimize-appointments-query.sql';
console.log(`🚀 Executing SQL from ${filename}\n`);

executeSqlFile(filename);