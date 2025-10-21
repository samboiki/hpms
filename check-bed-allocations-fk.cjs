const https = require('https');

const SUPABASE_URL = 'jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk4MTU1NywiZXhwIjoyMDQ4NTU3NTU3fQ.xDWu9nMnNosnap8wPBxN0Eu8y-XG_-YdXM8Ae51SOpM';

// Query to get foreign key constraints for bed_allocations
const query = `
  SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name,
    af.attname AS foreign_column_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
  WHERE contype = 'f'
    AND conrelid::regclass::text = 'bed_allocations';
`;

const postData = JSON.stringify({ query });

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/rpc/execute_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== BED_ALLOCATIONS FOREIGN KEY CONSTRAINTS ===\n');
    try {
      const result = JSON.parse(data);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();
