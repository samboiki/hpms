import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMedicalAid() {
  try {
    // Check medical aid data
    const { data: medicalAidData, error: medicalAidError } = await supabase
      .from('medical_aid_details')
      .select('*')
      .eq('patient_id', 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8');
    
    if (medicalAidError) {
      console.error('Error fetching medical aid data:', medicalAidError);
    } else {
      console.log('\n=== Medical Aid Data ===');
      if (medicalAidData && medicalAidData.length > 0) {
        console.log(JSON.stringify(medicalAidData, null, 2));
      } else {
        console.log('No medical aid data found for this patient');
      }
    }

    // Also check patient info
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', 'ed7d2a9a-a4fa-44f6-bf6c-2e618fd60ad8')
      .single();
    
    if (patientError) {
      console.error('Error fetching patient data:', patientError);
    } else {
      console.log('\n=== Patient Info ===');
      console.log(JSON.stringify(patientData, null, 2));
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkMedicalAid();