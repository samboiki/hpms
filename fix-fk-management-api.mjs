const accessToken = 'sbp_06ebe645acd5e8acbdf6adb17c635f317268ab0f';
const projectRef = 'jjxlfunlbyayxwvlpgwt';

const sql = `
-- Drop old FK constraint pointing to ward_beds
ALTER TABLE bed_allocations DROP CONSTRAINT IF EXISTS bed_allocations_bed_id_fkey CASCADE;

-- Add new FK constraint pointing to beds table
ALTER TABLE bed_allocations 
ADD CONSTRAINT bed_allocations_bed_id_fkey 
FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE;
`;

async function executeSql() {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query: sql })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error:', data);
      throw new Error(JSON.stringify(data));
    }

    console.log('✅ SUCCESS! FK constraint updated!');
    console.log('Response:', data);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

executeSql();
