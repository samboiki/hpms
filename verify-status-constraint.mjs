// Verify practices status constraint
const PROJECT_ID = 'jjxlfunlbyayxwvlpgwt';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';

async function verifyConstraint() {
  console.log('🔍 Verifying practices status constraint...\n');

  const sql = `
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conname = 'practices_status_check'
  AND n.nspname = 'public';
  `;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Constraint details retrieved:\n');
      console.log(JSON.stringify(result, null, 2));

      if (result.length > 0) {
        console.log('\n📋 Constraint Definition:');
        console.log(result[0].constraint_definition);
      }
    } else {
      const error = await response.text();
      console.log('❌ Failed to retrieve constraint:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyConstraint();