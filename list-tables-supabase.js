import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Uicm9sZSIsImlhdCI6MTczMjg1NDUwNSwiZXhwIjoyMDQ4NDMwNTA1fQ._6VDZmCog7h7hbeWsyqiXuOrlVyFr5epAqJJ0ztgDjA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  console.log('🚀 Listing HPMS database tables using Supabase client...\n');

  try {
    // Get all tables using raw SQL query
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables_info', {}, {
      head: false,
      count: null
    }).single();

    if (tablesError) {
      // Try a direct query approach
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_type')
        .eq('table_schema', 'public')
        .in('table_type', ['BASE TABLE', 'VIEW'])
        .order('table_name');

      if (error) {
        console.log('Trying alternative approach...');
        
        // List known tables and get their counts
        const knownTables = [
          'patients', 'visits', 'appointments', 'medical_records', 'users',
          'medical_aid_details', 'vitals', 'lab_results', 'lab_requests',
          'media_requests', 'messages', 'patient_documents', 'practices',
          'practice_medical_aids', 'practice_tariffs', 'billing_invoices',
          'billing_line_items', 'payments', 'encounter_templates',
          'encounter_responses', 'consent_forms', 'patient_consents'
        ];

        console.log('📊 Known Tables in HPMS Database:\n');
        console.log('─'.repeat(60));
        
        for (const tableName of knownTables) {
          try {
            const { count, error } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            
            if (!error) {
              console.log(`📁 ${tableName.padEnd(30)} | ${count?.toString().padStart(8) || '0'} rows`);
            } else {
              console.log(`📁 ${tableName.padEnd(30)} | Table might not exist`);
            }
          } catch (err) {
            console.log(`📁 ${tableName.padEnd(30)} | Error accessing table`);
          }
        }
        
        console.log('─'.repeat(60));
        
        // Get detailed info for core tables
        console.log('\n\n📋 Core Table Sample Data:\n');
        
        // Patients table
        const { data: patientsData, count: patientsCount } = await supabase
          .from('patients')
          .select('*', { count: 'exact' })
          .limit(1);
        
        if (patientsData && patientsData.length > 0) {
          console.log('\n🏥 PATIENTS table structure:');
          console.log('─'.repeat(60));
          console.log('Columns:', Object.keys(patientsData[0]).join(', '));
          console.log(`Total records: ${patientsCount}`);
        }
        
        // Visits table
        const { data: visitsData, count: visitsCount } = await supabase
          .from('visits')
          .select('*', { count: 'exact' })
          .limit(1);
        
        if (visitsData && visitsData.length > 0) {
          console.log('\n🏥 VISITS table structure:');
          console.log('─'.repeat(60));
          console.log('Columns:', Object.keys(visitsData[0]).join(', '));
          console.log(`Total records: ${visitsCount}`);
        }
        
        // Appointments table
        const { data: appointmentsData, count: appointmentsCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact' })
          .limit(1);
        
        if (appointmentsData && appointmentsData.length > 0) {
          console.log('\n🏥 APPOINTMENTS table structure:');
          console.log('─'.repeat(60));
          console.log('Columns:', Object.keys(appointmentsData[0]).join(', '));
          console.log(`Total records: ${appointmentsCount}`);
        }
        
        // Users table
        const { data: usersData, count: usersCount } = await supabase
          .from('users')
          .select('*', { count: 'exact' })
          .limit(1);
        
        if (usersData && usersData.length > 0) {
          console.log('\n🏥 USERS table structure:');
          console.log('─'.repeat(60));
          console.log('Columns:', Object.keys(usersData[0]).join(', '));
          console.log(`Total records: ${usersCount}`);
        }
        
      } else {
        console.log('Tables found:', data);
      }
    } else {
      console.log('Tables info:', tables);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listTables().catch(console.error);