import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testStatusConstraint() {
  console.log('🔍 Testing Practices Status Constraint\n');
  console.log('═'.repeat(80));

  // Test values to check
  const testValues = [
    'active',
    'inactive',
    'pending',
    'suspended',
    'ready',
    'draft',
    'archived',
    'deleted',
    'trial',
    'expired',
    'ACTIVE', // Test case sensitivity
    'Active'  // Test case sensitivity
  ];

  console.log('\n📋 Testing different status values...\n');
  console.log('Format: [STATUS] → Result\n');
  console.log('─'.repeat(80));

  const results = {
    accepted: [],
    rejected: [],
    errors: []
  };

  for (const testValue of testValues) {
    const timestamp = Date.now();
    const testData = {
      slug: `test-constraint-${timestamp}`,
      name: `TEST_CONSTRAINT_${timestamp}`,
      status: testValue,
      domain: `test-${timestamp}.example.com`,
      contact_email: `test_${timestamp}@example.com`,
      contact_phone: '+1234567890',
      primary_color: '#000000',
      secondary_color: '#FFFFFF',
      address: 'Test Address',
      city: 'Test City',
      country: 'Test Country',
      hero_title: 'Test',
      hero_subtitle: 'Test',
      about_text: 'Test',
      practice_type: 'dental',
      practice_type_id: '73a45bcb-b68a-4746-8c96-a6d081fc690f', // Valid practice_type_id from database
      subscription_tier: 'premium', // Changed from 'free' to match database constraint
      max_users: 5,
      max_patients: 100,
      timezone: 'UTC',
      currency: 'USD',
      approval_status: 'pending',
      submitted_at: new Date().toISOString(),
      number_of_branches: 1,
      professional_email_count: 0,
      marketing_budget: 0,
      website_hosting_enabled: false,
      total_monthly_premium: 0,
      base_price: 0,
      branches_cost: 0,
      website_cost: 0,
      emails_cost: 0,
      is_follow_up_automation_enabled: false,
      theme_id: 'default',
      sms_limit: 1000,
      sms_used: 0
    };

    try {
      const { data, error } = await supabase
        .from('practices')
        .insert(testData)
        .select()
        .single();

      if (error) {
        if (error.code === '23514') {
          // Check constraint violation
          console.log(`❌ "${testValue}" → REJECTED by check constraint`);
          const match = error.message.match(/constraint "([^"]+)"/);
          if (match) {
            console.log(`   Constraint: ${match[1]}`);
          }
          console.log(`   Error: ${error.message.split('\n')[0]}`);
          results.rejected.push({ value: testValue, constraint: match ? match[1] : 'unknown', error: error.message });
        } else {
          console.log(`⚠️  "${testValue}" → Error (code: ${error.code})`);
          console.log(`   ${error.message.substring(0, 100)}...`);
          results.errors.push({ value: testValue, error: error.message });
        }
      } else if (data) {
        console.log(`✅ "${testValue}" → ACCEPTED`);
        results.accepted.push(testValue);

        // Clean up test record
        await supabase.from('practices').delete().eq('id', data.id);
      }
    } catch (err) {
      console.log(`⚠️  "${testValue}" → Exception: ${err.message}`);
      results.errors.push({ value: testValue, error: err.message });
    }

    // Small delay to avoid issues
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 SUMMARY\n');
  console.log('─'.repeat(80));

  console.log('\n✅ ACCEPTED VALUES:');
  if (results.accepted.length === 0) {
    console.log('   (none)');
  } else {
    results.accepted.forEach(val => console.log(`   - "${val}"`));
  }

  console.log('\n❌ REJECTED VALUES (by check constraint):');
  if (results.rejected.length === 0) {
    console.log('   (none)');
  } else {
    const uniqueConstraints = [...new Set(results.rejected.map(r => r.constraint))];
    uniqueConstraints.forEach(constraint => {
      console.log(`\n   Constraint: ${constraint}`);
      const values = results.rejected.filter(r => r.constraint === constraint).map(r => r.value);
      console.log(`   Rejected: ${values.join(', ')}`);
    });

    // Try to extract the allowed values from error message
    if (results.rejected.length > 0) {
      const firstError = results.rejected[0].error;
      console.log('\n   Full error message sample:');
      console.log(`   ${firstError.substring(0, 300)}...`);
    }
  }

  console.log('\n⚠️  ERRORS (other reasons):');
  if (results.errors.length === 0) {
    console.log('   (none)');
  } else {
    results.errors.forEach(err => {
      console.log(`   - "${err.value}": ${err.error.substring(0, 80)}...`);
    });
  }

  // Check current values in database
  console.log('\n\n📋 CURRENT DATABASE VALUES:\n');
  console.log('─'.repeat(80));

  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('status');

  if (practicesError) {
    console.error('Error fetching practices:', practicesError.message);
  } else if (practices) {
    const statusCounts = {};
    practices.forEach(p => {
      const status = p.status || 'NULL';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('Status values currently in use:\n');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   "${status}": ${count} practice${count !== 1 ? 's' : ''}`);
      });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Analysis complete!');
}

testStatusConstraint().catch(console.error);