import { createClient } from '@supabase/supabase-js';

// Use service role key from environment or fallback
const supabaseUrl = 'https://cejwbpuuqhcyetfvzinl.supabase.co';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ No service role key found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkPatients() {
  try {
    console.log('🔍 Checking patient data in database...');
    
    // Check total patients and gender distribution
    const query = `
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_count,
        COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_count,
        COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_cap_count,
        COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_cap_count,
        COUNT(CASE WHEN gender IS NULL THEN 1 END) as null_gender_count,
        COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as has_birthdate,
        COUNT(CASE WHEN date_of_birth IS NULL THEN 1 END) as no_birthdate
      FROM patients;
    `;
    
    const result = await supabase.rpc('exec_raw_sql', { sql_query: query });
    
    if (result.error) {
      console.error('❌ Query error:', result.error);
      return;
    }
    
    console.log('📊 Patient data analysis result:', result.data);
    
    // Also check actual gender values
    const genderQuery = `
      SELECT gender, COUNT(*) as count 
      FROM patients 
      GROUP BY gender 
      ORDER BY count DESC;
    `;
    
    const genderResult = await supabase.rpc('exec_raw_sql', { sql_query: genderQuery });
    console.log('👥 Gender distribution:', genderResult.data);
    
    // Check age calculation
    const ageQuery = `
      SELECT 
        AVG(EXTRACT(YEAR FROM AGE(date_of_birth))) as avg_age_sql,
        COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as patients_with_birthdate
      FROM patients 
      WHERE date_of_birth IS NOT NULL;
    `;
    
    const ageResult = await supabase.rpc('exec_raw_sql', { sql_query: ageQuery });
    console.log('🎂 Age analysis:', ageResult.data);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPatients();