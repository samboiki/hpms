#!/usr/bin/env node

const { Client } = require('pg');

const client = new Client({
  host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'T@ngisasa200',
  ssl: { rejectUnauthorized: false }
});

async function checkBatchDetailsDataTypes() {
  try {
    await client.connect();
    console.log('🔍 Analyzing batch_details data types and values...\n');

    // Check for problematic INTEGER fields
    console.log('=== INTEGER FIELD ANALYSIS ===');
    
    // Check transaction_number_in_batch
    console.log('\n1. transaction_number_in_batch field:');
    const transactionNumberResult = await client.query(`
      SELECT 
        transaction_number_in_batch,
        COUNT(*) as count,
        CASE 
          WHEN transaction_number_in_batch ~ '^[0-9]+$' THEN 'Valid Integer'
          WHEN transaction_number_in_batch IS NULL THEN 'NULL'
          WHEN transaction_number_in_batch = '' THEN 'Empty String'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY transaction_number_in_batch, status
      ORDER BY count DESC
      LIMIT 20
    `);
    console.table(transactionNumberResult.rows);

    // Check system_transaction_number
    console.log('\n2. system_transaction_number field:');
    const systemTransactionResult = await client.query(`
      SELECT 
        system_transaction_number,
        COUNT(*) as count,
        CASE 
          WHEN system_transaction_number IS NULL THEN 'NULL'
          WHEN system_transaction_number::TEXT = '' THEN 'Empty String'
          WHEN system_transaction_number::TEXT ~ '^[0-9]+$' THEN 'Valid Integer'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY system_transaction_number, status
      ORDER BY count DESC
      LIMIT 20
    `);
    console.table(systemTransactionResult.rows);

    // Check service_fee
    console.log('\n3. service_fee field:');
    const serviceFeeResult = await client.query(`
      SELECT 
        service_fee,
        COUNT(*) as count,
        CASE 
          WHEN service_fee IS NULL THEN 'NULL'
          WHEN service_fee::TEXT = '' THEN 'Empty String'
          WHEN service_fee::TEXT ~ '^[0-9]+$' THEN 'Valid Integer'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY service_fee, status
      ORDER BY count DESC
      LIMIT 20
    `);
    console.table(serviceFeeResult.rows);

    // Check DECIMAL fields
    console.log('\n=== DECIMAL FIELD ANALYSIS ===');
    
    console.log('\n4. service_amount field:');
    const serviceAmountResult = await client.query(`
      SELECT 
        service_amount,
        COUNT(*) as count,
        CASE 
          WHEN service_amount IS NULL THEN 'NULL'
          WHEN service_amount::TEXT ~ '^[0-9]+\\.?[0-9]*$' THEN 'Valid Decimal'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY service_amount, status
      ORDER BY count DESC
      LIMIT 10
    `);
    console.table(serviceAmountResult.rows);

    // Check DATE fields
    console.log('\n=== DATE FIELD ANALYSIS ===');
    
    console.log('\n5. patient_date_of_birth field:');
    const dobResult = await client.query(`
      SELECT 
        patient_date_of_birth,
        COUNT(*) as count,
        CASE 
          WHEN patient_date_of_birth IS NULL THEN 'NULL'
          WHEN patient_date_of_birth::TEXT ~ '^[0-9]{8}$' THEN 'Valid YYYYMMDD'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY patient_date_of_birth, status
      ORDER BY count DESC
      LIMIT 10
    `);
    console.table(dobResult.rows);

    console.log('\n6. service_date field:');
    const serviceDateResult = await client.query(`
      SELECT 
        service_date,
        COUNT(*) as count,
        CASE 
          WHEN service_date IS NULL THEN 'NULL'
          WHEN service_date::TEXT ~ '^[0-9]{8}$' THEN 'Valid YYYYMMDD'
          ELSE 'Invalid Format'
        END as status
      FROM batch_details 
      GROUP BY service_date, status
      ORDER BY count DESC
      LIMIT 10
    `);
    console.table(serviceDateResult.rows);

    // Check for specific problem records
    console.log('\n=== PROBLEM RECORD DETECTION ===');
    
    const problemRecords = await client.query(`
      SELECT 
        id,
        transaction_number_in_batch,
        system_transaction_number,
        service_fee,
        service_amount,
        patient_date_of_birth,
        service_date
      FROM batch_details 
      WHERE 
        (transaction_number_in_batch IS NOT NULL AND NOT transaction_number_in_batch ~ '^[0-9]+$')
        OR (system_transaction_number IS NOT NULL AND NOT system_transaction_number::TEXT ~ '^[0-9]+$')
        OR (service_fee IS NOT NULL AND NOT service_fee::TEXT ~ '^[0-9]+$')
      LIMIT 5
    `);
    
    if (problemRecords.rows.length > 0) {
      console.log('\n❌ Found problem records:');
      console.table(problemRecords.rows);
    } else {
      console.log('\n✅ No obvious problem records found in INTEGER fields');
    }

    // Test ORDER BY that's causing the issue
    console.log('\n=== ORDER BY TEST ===');
    
    try {
      const orderByTest = await client.query(`
        SELECT 
          transaction_number_in_batch,
          CASE 
            WHEN transaction_number_in_batch IS NULL OR transaction_number_in_batch = '' THEN 1
            ELSE transaction_number_in_batch::INTEGER
          END as order_value
        FROM batch_details 
        ORDER BY 
          CASE 
            WHEN transaction_number_in_batch IS NULL OR transaction_number_in_batch = '' THEN 1
            ELSE transaction_number_in_batch::INTEGER
          END
        LIMIT 5
      `);
      console.log('✅ ORDER BY test passed');
      console.table(orderByTest.rows);
    } catch (error) {
      console.log('❌ ORDER BY test failed:');
      console.log(error.message);
    }

    // Test safer ORDER BY
    console.log('\n=== SAFER ORDER BY TEST ===');
    
    try {
      const saferOrderByTest = await client.query(`
        SELECT 
          transaction_number_in_batch,
          COALESCE(NULLIF(transaction_number_in_batch, '')::INTEGER, 1) as order_value
        FROM batch_details 
        ORDER BY COALESCE(NULLIF(transaction_number_in_batch, '')::INTEGER, 1)
        LIMIT 5
      `);
      console.log('✅ Safer ORDER BY test passed');
      console.table(saferOrderByTest.rows);
    } catch (error) {
      console.log('❌ Safer ORDER BY test failed:');
      console.log(error.message);
    }

    // Test regex-based ORDER BY
    console.log('\n=== REGEX-BASED ORDER BY TEST ===');
    
    try {
      const regexOrderByTest = await client.query(`
        SELECT 
          transaction_number_in_batch,
          CASE 
            WHEN transaction_number_in_batch ~ '^[0-9]+$' THEN transaction_number_in_batch::INTEGER
            ELSE 1
          END as order_value
        FROM batch_details 
        ORDER BY 
          CASE 
            WHEN transaction_number_in_batch ~ '^[0-9]+$' THEN transaction_number_in_batch::INTEGER
            ELSE 1
          END
        LIMIT 5
      `);
      console.log('✅ Regex-based ORDER BY test passed');
      console.table(regexOrderByTest.rows);
    } catch (error) {
      console.log('❌ Regex-based ORDER BY test failed:');
      console.log(error.message);
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  } finally {
    await client.end();
  }
}

checkBatchDetailsDataTypes();