const https = require('https');

const SUPABASE_URL = 'jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Query to get foreign key constraints using information_schema
const query = `
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'bed_allocations'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_name;
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

  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== Response ===\n');
    try {
      const result = JSON.parse(data);
      if (Array.isArray(result) && result.length > 0) {
        console.log('Foreign Key Constraints Found:');
        result.forEach((fk, index) => {
          console.log(`\n${index + 1}. ${fk.constraint_name}`);
          console.log(`   Column: ${fk.column_name}`);
          console.log(`   References: ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      } else if (result.error) {
        console.log('Error:', result.error);
        console.log('Message:', result.message);
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
  console.error('Request Error:', error);
});

req.write(postData);
req.end();
