const https = require('https');

const SUPABASE_URL = 'jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Query to get foreign key constraints
const query = `
SELECT
  conname AS constraint_name,
  a.attname AS column_name,
  confrelid::regclass AS foreign_table_name,
  af.attname AS foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE contype = 'f'
  AND conrelid = 'bed_allocations'::regclass
`;

const postData = JSON.stringify({ query_text: query });

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/rpc/execute_raw_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
  }
};

console.log('\n=== Checking BED_ALLOCATIONS Foreign Key Constraints ===\n');

const req = https.request(options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}\n`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (Array.isArray(result) && result.length > 0) {
        console.log('✅ Foreign Key Constraints Found:\n');
        result.forEach((fk, index) => {
          console.log(`${index + 1}. Constraint: ${fk.constraint_name}`);
          console.log(`   Column: ${fk.column_name}`);
          console.log(`   References: ${fk.foreign_table_name}.${fk.foreign_column_name}\n`);
        });
      } else if (result.error || result.message) {
        console.log('❌ Error:', result.code || 'Unknown');
        console.log('Message:', result.message);
        console.log('Details:', result.details);
      } else {
        console.log('Result:', JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', data);
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error);
});

req.write(postData);
req.end();
