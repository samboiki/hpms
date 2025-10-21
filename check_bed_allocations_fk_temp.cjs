require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL.replace('https://', '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Query to get foreign key constraints for bed_allocations
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

console.log('\n=== BED_ALLOCATIONS FOREIGN KEY CONSTRAINTS ===\n');

const req = https.request(options, (res) => {
  let data = '';

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
        if (result.details) console.log('Details:', result.details);
        if (result.hint) console.log('Hint:', result.hint);
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
