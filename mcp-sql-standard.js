import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlandicHV1cWhjeWV0ZnZ6aW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTI0NzI3MCwiZXhwIjoyMDQ0ODIzMjcwfQ.yt5dNxe2v-OGq9VXmL9dZrI3dCr4dV6OBtq2kWJZr6g';

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
  console.log('🔍 Checking existing practices and their banking details...\n');

  // First, check existing practices
  const checkPracticesQuery = `
    SELECT id, name, bank_name, account_holder_name, account_number, branch_code, swift_code, account_type 
    FROM practices 
    ORDER BY name;
  `;

  console.log('🏥 Fetching current practices...');
  const practicesResult = await executeSql(checkPracticesQuery);
  
  if (!practicesResult.success) {
    console.log('❌ Failed to fetch practices');
    return;
  }

  console.log('✅ Current practices fetched!');
  console.log('📊 Found practices:', practicesResult.data);

  // Now update each practice with realistic Namibian banking details
  console.log('\n🏦 Updating practices with realistic Namibian banking details...');

  const bankingUpdates = [
    {
      bank_name: 'FNB Namibia',
      branch_code: '282273',
      swift_code: 'FIRNNANX',
      account_type: 'Business Cheque Account',
      account_number: '12345678901'
    },
    {
      bank_name: 'Nedbank Namibia', 
      branch_code: '281610',
      swift_code: 'NEDSNANX',
      account_type: 'Current Account',
      account_number: '98765432109'
    },
    {
      bank_name: 'Standard Bank Namibia',
      branch_code: '083179', 
      swift_code: 'SBNMNANX',
      account_type: 'Business Cheque Account',
      account_number: '55667788990'
    },
    {
      bank_name: 'Bank Windhoek',
      branch_code: '484519',
      swift_code: 'BWIBNANX', 
      account_type: 'Current Account',
      account_number: '44332211009'
    }
  ];

  // Parse the practices data to get the actual results
  let practicesList = [];
  try {
    // The data might be a string that needs parsing
    if (typeof practicesResult.data === 'string' && practicesResult.data.includes('SUCCESS')) {
      console.log('⚠️  Need to query practices differently - executing direct query');
      
      // First, let's get a list of practice IDs to update
      const getPracticesQuery = `
        SELECT id, name FROM practices ORDER BY name;
      `;
      
      const practicesListResult = await executeSql(getPracticesQuery);
      console.log('📋 Practice IDs fetched:', practicesListResult.data);
      
      // Define realistic banking details for each practice
      const bankingDetails = [
        {
          bank_name: 'FNB Namibia',
          branch_code: '282273',
          swift_code: 'FIRNNANX',
          account_type: 'Business Cheque Account',
          account_number: '12345678901'
        },
        {
          bank_name: 'Nedbank Namibia', 
          branch_code: '281610',
          swift_code: 'NEDSNANX',
          account_type: 'Current Account',
          account_number: '98765432109'
        },
        {
          bank_name: 'Standard Bank Namibia',
          branch_code: '083179', 
          swift_code: 'SBNMNANX',
          account_type: 'Business Cheque Account',
          account_number: '55667788990'
        },
        {
          bank_name: 'Bank Windhoek',
          branch_code: '484519',
          swift_code: 'BWIBNANX', 
          account_type: 'Current Account',
          account_number: '44332211009'
        },
        {
          bank_name: 'FNB Namibia',
          branch_code: '282273',
          swift_code: 'FIRNNANX',
          account_type: 'Current Account',
          account_number: '11223344556'
        }
      ];

      // Update all practices at once
      const directQuery = `
        WITH practice_list AS (
          SELECT id, name, ROW_NUMBER() OVER (ORDER BY name) as rn
          FROM practices
        ),
        banking_data AS (
          SELECT 
            id,
            name,
            CASE 
              WHEN rn = 1 THEN 'FNB Namibia'
              WHEN rn = 2 THEN 'Nedbank Namibia'  
              WHEN rn = 3 THEN 'Standard Bank Namibia'
              WHEN rn = 4 THEN 'Bank Windhoek'
              ELSE 'FNB Namibia'
            END as bank_name,
            CASE
              WHEN rn = 1 THEN '282273'
              WHEN rn = 2 THEN '281610'
              WHEN rn = 3 THEN '083179' 
              WHEN rn = 4 THEN '484519'
              ELSE '282273'
            END as branch_code,
            CASE
              WHEN rn = 1 THEN 'FIRNNANX'
              WHEN rn = 2 THEN 'NEDSNANX'
              WHEN rn = 3 THEN 'SBNMNANX'
              WHEN rn = 4 THEN 'BWIBNANX'
              ELSE 'FIRNNANX'
            END as swift_code,
            CASE
              WHEN rn % 2 = 1 THEN 'Business Cheque Account'
              ELSE 'Current Account'
            END as account_type,
            name as account_holder_name,
            CASE
              WHEN rn = 1 THEN '12345678901'
              WHEN rn = 2 THEN '98765432109'
              WHEN rn = 3 THEN '55667788990' 
              WHEN rn = 4 THEN '44332211009'
              ELSE '11223344556'
            END as account_number
          FROM practice_list
        )
        UPDATE practices 
        SET 
          bank_name = banking_data.bank_name,
          branch_code = banking_data.branch_code,
          swift_code = banking_data.swift_code,
          account_type = banking_data.account_type,
          account_holder_name = banking_data.account_holder_name,
          account_number = banking_data.account_number
        FROM banking_data
        WHERE practices.id = banking_data.id;
      `;
      
      const updateResult = await executeSql(directQuery);
      
      if (updateResult.success) {
        console.log('✅ Banking details updated successfully!');
        
        // Verify the updates
        const verifyQuery = `
          SELECT id, name, bank_name, account_holder_name, account_number, branch_code, swift_code, account_type 
          FROM practices 
          ORDER BY name;
        `;
        
        console.log('\n🔍 Verifying updated banking details...');
        const verifyResult = await executeSql(verifyQuery);
        console.log('📊 Updated practices:', verifyResult.data);
        
      } else {
        console.log('❌ Failed to update banking details');
      }
    }
  } catch (error) {
    console.log('⚠️  Error processing practices data:', error);
  }

  console.log('\n🎉 Banking details update process completed!');
}

main().catch(console.error);