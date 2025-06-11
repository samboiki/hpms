#!/usr/bin/env node

/**
 * Debug script to check batch submission issues
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTc3Njg1NCwiZXhwIjoyMDMxMzUyODU0fQ.0CcF_4aOLlCQl68G-Hi_xQLgz--Yub7w7k-P3hZtbXA';

async function debugBatchSubmission() {
  console.log('🔍 Starting batch submission debug...');
  
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const batchId = '782752c0-cb09-4c11-b43a-0365c2a0d152';
    console.log(`🎯 Checking batch: ${batchId}`);
    
    // Step 1: Check if the batch exists
    console.log('\n📋 Step 1: Checking if batch exists...');
    const { data: batchExists, error: batchError } = await supabase
      .from('batch_headers')
      .select('id, batch_number, status, practice_number')
      .eq('id', batchId)
      .single();
    
    if (batchError) {
      console.error('❌ Batch not found:', batchError);
      return;
    }
    
    console.log('✅ Batch found:', batchExists);
    
    // Step 2: Check if the database function exists
    console.log('\n🔧 Step 2: Checking if prepare_batch_for_sending function exists...');
    const { data: functionExists, error: functionError } = await supabase
      .rpc('prepare_batch_for_sending', { p_batch_id: batchId });
    
    if (functionError) {
      console.error('❌ Function error:', functionError);
      console.log('\n🛠️  The prepare_batch_for_sending function may not exist or has errors.');
      console.log('Please run the database setup SQL in your Supabase SQL Editor.');
      return;
    }
    
    console.log('✅ Function executed successfully:', functionExists);
    
    // Step 3: Check medical aid provider email
    if (functionExists && functionExists.length > 0) {
      const result = functionExists[0];
      console.log('\n📧 Step 3: Checking email and file details...');
      console.log('📄 File name:', result.file_name);
      console.log('📧 Recipient email:', result.recipient_email);
      console.log('📝 File content length:', result.file_content ? result.file_content.length : 0);
      
      if (!result.recipient_email) {
        console.log('\n❌ No recipient email found!');
        console.log('🔧 Check medical_aid_providers table for email mapping.');
      }
    }
    
    // Step 4: Check medical aid providers table
    console.log('\n🏥 Step 4: Checking medical_aid_providers table...');
    const { data: providers, error: providersError } = await supabase
      .from('medical_aid_providers')
      .select('medical_aid_reference, email')
      .limit(5);
    
    if (providersError) {
      console.error('❌ Medical aid providers error:', providersError);
    } else {
      console.log('✅ Sample medical aid providers:', providers);
    }
    
    // Step 5: Check batch management view
    console.log('\n📊 Step 5: Checking batch in management view...');
    const { data: viewData, error: viewError } = await supabase
      .from('batch_management_view')
      .select('*')
      .eq('batch_id', batchId)
      .single();
    
    if (viewError) {
      console.error('❌ Batch management view error:', viewError);
    } else {
      console.log('✅ Batch management view data:', viewData);
    }
    
    console.log('\n🎉 Debug completed! Check the results above to identify any issues.');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  debugBatchSubmission()
    .then(() => {
      console.log('\n✅ Debug completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugBatchSubmission };