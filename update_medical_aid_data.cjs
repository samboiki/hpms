const { createClient } = require('@supabase/supabase-js');

// Skip dotenv loading for now

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

// Namibian Medical Aid Providers and their schemes
const medicalAidProviders = [
  {
    provider: 'Namibia Medical Care',
    schemes: ['Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze'],
    planTypes: ['Comprehensive', 'Standard', 'Essential']
  },
  {
    provider: 'Namibia Health Plan',
    schemes: ['Comprehensive', 'Executive', 'Standard', 'Essential'],
    planTypes: ['Comprehensive', 'Standard', 'Essential']
  },
  {
    provider: 'Discovery Health',
    schemes: ['Executive Plan', 'Comprehensive', 'Essential', 'Smart Plan'],
    planTypes: ['Comprehensive', 'Premium', 'Standard']
  },
  {
    provider: 'Bonitas Medical Fund',
    schemes: ['BonComprehensive', 'BonEssential', 'BonCap', 'BonStart'],
    planTypes: ['Comprehensive', 'Standard', 'Essential']
  },
  {
    provider: 'Nammed Medical Aid Fund',
    schemes: ['Comprehensive', 'Standard', 'Essential'],
    planTypes: ['Comprehensive', 'Standard', 'Essential']
  },
  {
    provider: 'Gemhealth Medical Aid',
    schemes: ['Premium', 'Standard', 'Basic'],
    planTypes: ['Premium', 'Standard', 'Basic']
  },
  {
    provider: 'Old Mutual Health',
    schemes: ['Executive', 'Comprehensive', 'Essential'],
    planTypes: ['Comprehensive', 'Standard', 'Essential']
  }
];

// Namibian common names for main members
const namibianNames = [
  'Johannes Hendrik', 'Maria Elizabeth', 'Petrus Johannes', 'Anna Maria',
  'David Nghidipaya', 'Helena Nghilifa', 'Andreas Mukeve', 'Selma Nghipondoka',
  'Michael Uutoni', 'Susanna Amunyela', 'Samuel Nujoma', 'Libertina Amathila',
  'Hifikepunye Pohamba', 'Monica Geingos', 'Theo-Ben Gurirab', 'Pendukeni Iivula-Ithana',
  'Ben Amathila', 'Nangolo Mbumba', 'Nickey Iyambo', 'Saara Kuugongelwa',
  'Frans Kapofi', 'Nelumbu Ndeitunga', 'Tommy Nembwaya', 'Katrina Hanse-Himarwa'
];

// Relationship types
const relationships = ['Self', 'Spouse', 'Child', 'Parent'];

// Generate random medical aid data
function generateMedicalAidData(patientFirstName, patientLastName, patientId) {
  const provider = medicalAidProviders[Math.floor(Math.random() * medicalAidProviders.length)];
  const scheme = provider.schemes[Math.floor(Math.random() * provider.schemes.length)];
  const planType = provider.planTypes[Math.floor(Math.random() * provider.planTypes.length)];
  const relationship = relationships[Math.floor(Math.random() * relationships.length)];
  
  // Generate membership number (typically 8-12 digits for Namibian medical aids)
  const membershipNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
  
  // Generate main member details
  let mainMemberName, mainMemberIdNumber;
  if (relationship === 'Self') {
    mainMemberName = `${patientFirstName} ${patientLastName}`;
    // Generate Namibian ID number format (11 digits)
    mainMemberIdNumber = `${Math.floor(80000000000 + Math.random() * 19999999999)}`;
  } else {
    const randomName = namibianNames[Math.floor(Math.random() * namibianNames.length)];
    mainMemberName = randomName;
    mainMemberIdNumber = `${Math.floor(80000000000 + Math.random() * 19999999999)}`;
  }
  
  return {
    patient_id: patientId,
    provider: provider.provider,
    scheme: scheme,
    membership_number: membershipNumber,
    plan_type: planType,
    main_member_name: mainMemberName,
    main_member_id_number: mainMemberIdNumber,
    relationship_to_main: relationship
  };
}

async function updateMedicalAidData() {
  try {
    console.log('🏥 Starting medical aid data update...');
    
    // Get all patients
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name');
      
    if (patientsError) {
      throw new Error(`Failed to fetch patients: ${patientsError.message}`);
    }
    
    console.log(`📊 Found ${patients.length} patients in database`);
    
    // Calculate 80% of patients
    const patientsToUpdate = Math.floor(patients.length * 0.8);
    console.log(`🎯 Will update ${patientsToUpdate} patients (80%) with medical aid data`);
    
    // Shuffle patients array and take 80%
    const shuffledPatients = patients.sort(() => Math.random() - 0.5);
    const selectedPatients = shuffledPatients.slice(0, patientsToUpdate);
    
    // Check for existing medical aid data
    const { data: existingMedicalAid, error: existingError } = await supabase
      .from('medical_aid_details')
      .select('patient_id');
      
    if (existingError) {
      console.warn('Warning: Could not check existing medical aid data:', existingError.message);
    }
    
    const existingPatientIds = new Set(existingMedicalAid?.map(aid => aid.patient_id) || []);
    
    // Filter out patients who already have medical aid
    const patientsNeedingMedicalAid = selectedPatients.filter(patient => 
      !existingPatientIds.has(patient.id)
    );
    
    console.log(`👥 ${patientsNeedingMedicalAid.length} patients need medical aid data`);
    console.log(`✅ ${existingPatientIds.size} patients already have medical aid data`);
    
    if (patientsNeedingMedicalAid.length === 0) {
      console.log('🎉 All selected patients already have medical aid data!');
      return;
    }
    
    // Generate medical aid data for patients
    const medicalAidRecords = patientsNeedingMedicalAid.map(patient => 
      generateMedicalAidData(patient.first_name, patient.last_name, patient.id)
    );
    
    // Insert medical aid data in batches
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < medicalAidRecords.length; i += batchSize) {
      const batch = medicalAidRecords.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('medical_aid_details')
        .insert(batch);
        
      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      }
    }
    
    console.log('\n📈 Medical Aid Data Update Summary:');
    console.log(`✅ Successfully added: ${successCount} medical aid records`);
    console.log(`❌ Failed to add: ${errorCount} records`);
    console.log(`📊 Total patients with medical aid: ${existingPatientIds.size + successCount}`);
    
    // Show sample of added data
    if (successCount > 0) {
      console.log('\n🏥 Sample Medical Aid Records Added:');
      medicalAidRecords.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.provider} - ${record.scheme} (${record.membership_number})`);
      });
    }
    
    console.log('\n🎉 Medical aid data update completed!');
    
  } catch (error) {
    console.error('💥 Error updating medical aid data:', error.message);
    process.exit(1);
  }
}

// Run the update
updateMedicalAidData();