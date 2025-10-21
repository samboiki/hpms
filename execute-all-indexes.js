const https = require('https');

const PROJECT_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
  "CREATE INDEX IF NOT EXISTS idx_patients_practice_id ON patients(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name)",
  "CREATE INDEX IF NOT EXISTS idx_patients_first_name ON patients(first_name)",
  "CREATE INDEX IF NOT EXISTS idx_visits_practice_id ON visits(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date)",
  "CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id)",
  "CREATE INDEX IF NOT EXISTS idx_appointments_practice_id ON appointments(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)",
  "CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)",
  "CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(status)",
  "CREATE INDEX IF NOT EXISTS idx_branches_practice_id ON branches(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_practice_settings_practice_id_key ON practice_settings(practice_id, setting_key)",
  "CREATE INDEX IF NOT EXISTS idx_invoices_practice_id ON invoices_enhanced(practice_id)",
  "CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices_enhanced(payment_status)",
  "CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices_enhanced(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_medical_aid_details_patient_id ON medical_aid_details(patient_id)"
];

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_raw_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: body });
        } else {
          reject({ success: false, statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => reject({ success: false, error: error.message }));
    req.write(data);
    req.end();
  });
}

async function createAllIndexes() {
  console.log('🚀 Starting index creation...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < indexes.length; i++) {
    const sql = indexes[i];
    const indexName = sql.match(/idx_\w+/)?.[0] || `index_${i+1}`;

    try {
      process.stdout.write(`[${i+1}/${indexes.length}] Creating ${indexName}... `);
      await executeSQL(sql);
      console.log('✅');
      successCount++;
    } catch (error) {
      console.log(`❌ ${error.statusCode || 'ERROR'}`);
      failCount++;
      if (error.data) {
        console.log(`    Error: ${error.data}`);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount}/${indexes.length}`);
  console.log(`❌ Failed: ${failCount}/${indexes.length}`);
  console.log('='.repeat(50));

  if (successCount > 0) {
    console.log('\n🎉 Database indexes created successfully!');
    console.log('📊 Query performance should now be significantly improved.');
  }
}

createAllIndexes().catch(console.error);
