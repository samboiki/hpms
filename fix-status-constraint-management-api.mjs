// Fix practices status constraint using Supabase Management API
const PROJECT_ID = 'jjxlfunlbyayxwvlpgwt';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';

async function fixStatusConstraint() {
  console.log('🚀 Fixing practices status constraint via Management API');
  console.log('================================================\n');

  const sql = `
-- Drop the old constraint
ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;

-- Add new constraint with all Kanban statuses
ALTER TABLE practices ADD CONSTRAINT practices_status_check
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive', 'pending', 'suspended'));
  `;

  try {
    // Try primary endpoint
    console.log('📡 Attempting primary endpoint: /database/query...');
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Primary endpoint failed (${response.status}):`, errorText);

      // Try alternative endpoint
      console.log('\n🔧 Trying alternative endpoint: /sql...');
      const altResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql })
      });

      if (altResponse.ok) {
        const result = await altResponse.json();
        console.log('✅ SQL executed successfully via Management API!');
        console.log('Result:', JSON.stringify(result, null, 2));
        console.log('\n✅ Practices status constraint updated successfully!');
        console.log('Allowed statuses: lead, contacted, qualified, onboarding, active, inactive, pending, suspended');
        return;
      } else {
        const altError = await altResponse.text();
        console.log(`❌ Alternative endpoint failed (${altResponse.status}):`, altError);
        throw new Error('Both API endpoints failed');
      }
    } else {
      const result = await response.json();
      console.log('✅ SQL executed successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log('\n✅ Practices status constraint updated successfully!');
      console.log('Allowed statuses: lead, contacted, qualified, onboarding, active, inactive, pending, suspended');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 MANUAL EXECUTION REQUIRED:');
    console.log('Please execute the following SQL in Supabase Dashboard → SQL Editor:\n');
    console.log(sql);
    process.exit(1);
  }
}

fixStatusConstraint();