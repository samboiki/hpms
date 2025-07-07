// This script will help debug what's happening in the live dashboard
// Copy and paste this into the browser console while logged into the dashboard

console.log('=== LIVE DASHBOARD DEBUG ===');

// Get the Supabase client from the window (if available)
const supabaseClient = window.supabase || window.__supabase;

if (!supabaseClient) {
  console.log('❌ Supabase client not found in window');
  console.log('Try running this in the browser console:');
  console.log(`
// Test the exact query manually
fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/rest/v1/appointments?practice_id=eq.b64632c2-3a56-44cf-a2c9-0e42be03a2d3&select=*,patient:patients(id,first_name,last_name,cell_number,date_of_birth,gender),doctor:users!doctor_id(id,full_name,practice_id)', {
  headers: {
    'apikey': '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}',
    'Authorization': 'Bearer ' + localStorage.getItem('supabase.auth.token'),
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(data => console.log('Direct API result:', data));
  `);
} else {
  console.log('✅ Supabase client found, testing...');
  
  // Test the exact query
  supabaseClient
    .from('appointments')
    .select(\`
      *,
      patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
      doctor:users!doctor_id(id, full_name, practice_id)
    \`)
    .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
    .then(result => {
      console.log('Live dashboard query result:', result);
      
      if (result.error) {
        console.log('❌ Query error:', result.error);
      } else {
        console.log(\`✅ Found \${result.data?.length || 0} appointments\`);
        if (result.data && result.data.length > 0) {
          console.log('First appointment:', result.data[0]);
        }
      }
    });
}

// Also check auth state
console.log('Current auth state:');
console.log('- localStorage auth:', localStorage.getItem('supabase.auth.token'));
console.log('- sessionStorage auth:', sessionStorage.getItem('supabase.auth.token'));

// Check if user is authenticated
if (supabaseClient) {
  supabaseClient.auth.getUser().then(result => {
    console.log('Current user:', result);
  });
}