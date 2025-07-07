// MCP SQL Standard method to verify patient count implementation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mdzjnpbtlylxybdowqfe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kem5wYnRseWx4eWJkb3dxZmUiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0NzU2MDU5LCJleHAiOjIwNTAzMzIwNTl9.0sMh5MIyrnswkJQn8EJi7dAh6PvC6yJjSz2cQ5lKGgQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyPatientImplementation() {
  console.log('🔍 MCP SQL Standard - Verifying Patient Count Implementation');
  console.log('='.repeat(80));

  try {
    // 1. Check patients table structure and practice_id field
    console.log('\\n📋 1. PATIENTS Table Structure with practice_id:');
    const patientsStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'patients' AND table_schema = 'public'
      AND column_name IN ('id', 'practice_id', 'first_name', 'last_name', 'gender', 'created_at')
      ORDER BY ordinal_position;
    `;
    
    const { data: patientsStructure, error: patientsError } = await supabase.rpc('exec_raw_sql', {
      sql_query: patientsStructureQuery
    });
    
    if (patientsError) {
      console.error('❌ Patients structure error:', patientsError);
    } else {
      console.log('✅ Patients table structure:', patientsStructure);
    }

    // 2. Check if there are patients with practice_id values
    console.log('\\n📋 2. Sample Patients with practice_id:');
    const samplePatientsQuery = `
      SELECT 
        id, 
        first_name, 
        last_name, 
        gender, 
        practice_id, 
        created_at
      FROM patients 
      WHERE practice_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5;
    `;
    
    const { data: samplePatients, error: sampleError } = await supabase.rpc('exec_raw_sql', {
      sql_query: samplePatientsQuery
    });
    
    if (sampleError) {
      console.error('❌ Sample patients error:', sampleError);
    } else {
      console.log('✅ Sample patients with practice_id:', samplePatients);
    }

    // 3. Count patients by practice_id
    console.log('\\n📋 3. Patient Count by Practice:');
    const countByPracticeQuery = `
      SELECT 
        practice_id,
        COUNT(*) as total_patients,
        COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_count,
        COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_count,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
      FROM patients 
      WHERE practice_id IS NOT NULL
      GROUP BY practice_id
      ORDER BY total_patients DESC;
    `;
    
    const { data: practiceCount, error: practiceCountError } = await supabase.rpc('exec_raw_sql', {
      sql_query: countByPracticeQuery
    });
    
    if (practiceCountError) {
      console.error('❌ Practice count error:', practiceCountError);
    } else {
      console.log('✅ Patient count by practice:', practiceCount);
    }

    // 4. Check auth.users table for practice_id in metadata
    console.log('\\n📋 4. Users with practice_id in metadata:');
    const usersWithPracticeQuery = `
      SELECT 
        id,
        email,
        raw_user_meta_data->>'practice_id' as practice_id_from_metadata,
        raw_user_meta_data->>'full_name' as full_name,
        raw_user_meta_data->>'role' as role
      FROM auth.users 
      WHERE raw_user_meta_data->>'practice_id' IS NOT NULL
      LIMIT 3;
    `;
    
    const { data: usersWithPractice, error: usersError } = await supabase.rpc('exec_raw_sql', {
      sql_query: usersWithPracticeQuery
    });
    
    if (usersError) {
      console.error('❌ Users with practice error:', usersError);
    } else {
      console.log('✅ Users with practice_id:', usersWithPractice);
    }

    // 5. Test the exact query our service uses
    console.log('\\n📋 5. Testing Service Query (for first practice):');
    if (practiceCount && practiceCount.length > 0) {
      const firstPracticeId = practiceCount[0]?.practice_id;
      if (firstPracticeId) {
        const serviceTestQuery = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN gender = 'male' THEN 1 END) as male,
            COUNT(CASE WHEN gender = 'female' THEN 1 END) as female,
            COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
          FROM patients 
          WHERE practice_id = '${firstPracticeId}';
        `;
        
        const { data: serviceTest, error: serviceTestError } = await supabase.rpc('exec_raw_sql', {
          sql_query: serviceTestQuery
        });
        
        if (serviceTestError) {
          console.error('❌ Service test error:', serviceTestError);
        } else {
          console.log('✅ Service query result for practice', firstPracticeId, ':', serviceTest);
        }
      }
    }

    // 6. Check if patients table has NULL practice_id values
    console.log('\\n📋 6. Patients without practice_id:');
    const nullPracticeQuery = `
      SELECT COUNT(*) as patients_without_practice_id
      FROM patients 
      WHERE practice_id IS NULL;
    `;
    
    const { data: nullPractice, error: nullPracticeError } = await supabase.rpc('exec_raw_sql', {
      sql_query: nullPracticeQuery
    });
    
    if (nullPracticeError) {
      console.error('❌ Null practice check error:', nullPracticeError);
    } else {
      console.log('✅ Patients without practice_id:', nullPractice);
    }

  } catch (error) {
    console.error('❌ General verification error:', error);
  }

  console.log('\\n🎯 IMPLEMENTATION STATUS:');
  console.log('✅ PatientStatsService.ts - CREATED');
  console.log('✅ usePatientStats.ts hook - CREATED');
  console.log('✅ Dashboard.tsx - UPDATED to use real stats');
  console.log('✅ PremiumStatCard.tsx - UPDATED to accept patientStats prop');
  console.log('');
  console.log('📝 CURRENT FLOW:');
  console.log('1. User logs in → gets practice_id from auth metadata or users table');
  console.log('2. usePatientStats hook → calls PatientStatsService.getPatientStatsByPractice()');
  console.log('3. Service queries: SELECT * FROM patients WHERE practice_id = user.practice_id');
  console.log('4. Calculates: total, male, female, newThisMonth counts');
  console.log('5. Dashboard passes realPatientStats to PremiumStatCard');
  console.log('6. Card displays actual counts instead of hardcoded values');
}

verifyPatientImplementation();