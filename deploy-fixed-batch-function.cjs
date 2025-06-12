#!/usr/bin/env node

/**
 * Deploy Fixed prepare_batch_for_sending Function
 * 
 * This script deploys the corrected database function using direct PostgreSQL connection
 * to fix the "relation batches does not exist" error in batch email functionality.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Direct PostgreSQL connection (bolt.new style)
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

async function deployFixedBatchFunction() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Force IPv4 to avoid IPv6 connectivity issues
    host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'T@ngisasa200'
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'FIXED_PREPARE_BATCH_FOR_SENDING.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executing fixed batch function SQL...');
    await client.query(sqlContent);
    
    console.log('✅ Fixed prepare_batch_for_sending function deployed successfully!');
    
    // Test the function with a real batch ID
    console.log('🧪 Testing function with sample batch...');
    const testResult = await client.query(`
      SELECT id, medical_aid_reference, total_invoices, total_amount
      FROM batch_headers 
      WHERE total_invoices > 0 
      LIMIT 1
    `);
    
    if (testResult.rows.length > 0) {
      const sampleBatch = testResult.rows[0];
      console.log(`📋 Found sample batch: ${sampleBatch.id} (${sampleBatch.medical_aid_reference})`);
      console.log(`   Invoices: ${sampleBatch.total_invoices}, Amount: ${sampleBatch.total_amount}`);
      
      // Test the fixed function
      try {
        const functionTest = await client.query(`
          SELECT file_content, recipient_email, file_name
          FROM prepare_batch_for_sending($1)
        `, [sampleBatch.id]);
        
        if (functionTest.rows.length > 0) {
          const result = functionTest.rows[0];
          console.log('✅ Function test successful!');
          console.log(`   File name: ${result.file_name}`);
          console.log(`   Recipient: ${result.recipient_email}`);
          console.log(`   Content length: ${result.file_content?.length || 0} characters`);
          
          // Show first few lines of .dat content
          if (result.file_content) {
            const lines = result.file_content.split('\n').slice(0, 3);
            console.log('📄 Sample .dat content:');
            lines.forEach((line, i) => console.log(`   ${i + 1}: ${line.substring(0, 80)}...`));
          }
        } else {
          console.log('⚠️ Function returned no results');
        }
      } catch (functionError) {
        console.error('❌ Function test failed:', functionError.message);
      }
    } else {
      console.log('⚠️ No batch data found for testing');
    }

    // Verify function exists
    const verifyResult = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'prepare_batch_for_sending'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Function verified in database');
    } else {
      console.log('❌ Function not found after deployment');
    }

  } catch (error) {
    console.error('❌ Error deploying fixed batch function:', error.message);
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n💡 Table reference error detected. Checking available tables...');
      
      try {
        const tables = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name LIKE '%batch%'
          ORDER BY table_name
        `);
        
        console.log('📊 Available batch-related tables:');
        tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
      } catch (e) {
        console.log('   Could not fetch table list');
      }
    }
    
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Execute deployment
if (require.main === module) {
  deployFixedBatchFunction()
    .then(() => {
      console.log('\n🎉 Batch function fix deployment completed!');
      console.log('\n📋 Next Steps:');
      console.log('1. Set Resend secrets in Supabase dashboard');
      console.log('2. Update edge function with corrected logic');
      console.log('3. Test batch submission in Financial Overview modal');
      console.log('4. Verify .dat file generation and email delivery');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployFixedBatchFunction };