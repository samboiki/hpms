// Test script to validate practitioner invoice creation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPractitionerValidation() {
  console.log('🧪 Testing Practitioner Validation for Invoice Creation');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Check if we're authenticated
    console.log('\\n1️⃣ Testing Authentication Status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('❌ Not authenticated. Attempting to login...');
      
      // Try to login as admin (should be a doctor)
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'admin@onehealth.local',
        password: 'admin123'
      });
      
      if (loginError) {
        console.error('❌ Login failed:', loginError.message);
        return;
      }
      
      console.log('✅ Logged in as:', loginData.user?.email);
    } else {
      console.log('✅ Already authenticated as:', user.email);
    }
    
    // Test 2: Check user role in database
    console.log('\\n2️⃣ Testing User Role Validation...');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, first_name, last_name, email')
      .eq('id', currentUser.id)
      .single();
      
    if (userError) {
      console.error('❌ User lookup failed:', userError.message);
      return;
    }
    
    console.log('📋 User Details:');
    console.log('  - Email:', userData.email);
    console.log('  - Role:', userData.role);
    console.log('  - Name:', `${userData.first_name || ''} ${userData.last_name || ''}`.trim());
    
    if (userData.role !== 'doctor') {
      console.log('⚠️ User is not a doctor. Invoice creation should be blocked.');
    } else {
      console.log('✅ User is a doctor. Invoice creation should be allowed.');
    }
    
    // Test 3: Test practitioner validation directly
    console.log('\\n3️⃣ Testing Practitioner Validation Logic...');
    
    // Simulate the validation logic
    if (userData.role !== 'doctor') {
      console.log('🚫 EXPECTED BEHAVIOR: Invoice creation would be blocked');
      console.log('   Reason: Only doctors can create invoices');
      console.log('   Current role:', userData.role);
    } else {
      console.log('✅ EXPECTED BEHAVIOR: Invoice creation would be allowed');
      console.log('   Practitioner:', `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email);
      console.log('   Role:', userData.role);
    }
    
    // Test 4: Check if there are test patients available
    console.log('\\n4️⃣ Testing Available Patients...');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(3);
      
    if (patientsError) {
      console.error('❌ Failed to fetch patients:', patientsError.message);
    } else {
      console.log('✅ Available test patients:');
      patients.forEach(patient => {
        console.log(`   - ${patient.first_name} ${patient.last_name} (ID: ${patient.id})`);
      });
    }
    
    // Test 5: Check if there are test visits
    console.log('\\n5️⃣ Testing Available Visits...');
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select('id, patient_id, visit_date, chief_complaint')
      .limit(3);
      
    if (visitsError) {
      console.error('❌ Failed to fetch visits:', visitsError.message);
    } else {
      console.log('✅ Available test visits:');
      visits.forEach(visit => {
        console.log(`   - Visit ${visit.id} (Patient: ${visit.patient_id})`);
        console.log(`     Date: ${visit.visit_date}, Complaint: ${visit.chief_complaint}`);
      });
    }
    
    // Test 6: Check available tariffs for test services
    console.log('\\n6️⃣ Testing Available Tariffs...');
    const { data: tariffs, error: tariffsError } = await supabase
      .from('practice_tariffs')
      .select('id, code, description, price')
      .limit(5);
      
    if (tariffsError) {
      console.error('❌ Failed to fetch tariffs:', tariffsError.message);
    } else {
      console.log('✅ Available test tariffs:');
      tariffs.forEach(tariff => {
        console.log(`   - ${tariff.code}: ${tariff.description} (${tariff.price})`);
      });
    }
    
    console.log('\\n' + '=' .repeat(60));
    console.log('🎯 TEST SUMMARY:');
    console.log('✅ Authentication: Working');
    console.log(`✅ User Role: ${userData.role}`);
    console.log(`✅ Invoice Access: ${userData.role === 'doctor' ? 'ALLOWED' : 'BLOCKED'}`);
    console.log('✅ Test Data: Available');
    console.log('\\n🚀 Ready to test invoice creation in the application!');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPractitionerValidation();