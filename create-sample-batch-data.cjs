const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function createSampleBatchData() {
  console.log('🏗️ Creating sample batch data for testing...\n');
  
  try {
    // Get NewCharm Dental practice
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, practice_number')
      .eq('slug', 'newcharm-dental')
      .single();

    if (practicesError || !practices) {
      console.log('❌ NewCharm practice not found, updating...');
      
      // Update practice number for newcharm
      const { error: updateError } = await supabase
        .from('practices')
        .update({ practice_number: '540001133241' })
        .eq('slug', 'newcharm-dental');

      if (updateError) {
        console.log('❌ Error updating practice:', updateError);
        return;
      }

      console.log('✅ Updated NewCharm practice number');
      
      // Fetch again
      const { data: updatedPractice } = await supabase
        .from('practices')
        .select('id, name, practice_number')
        .eq('slug', 'newcharm-dental')
        .single();
      
      if (!updatedPractice) {
        console.log('❌ Still could not find practice');
        return;
      }
      
      practices.id = updatedPractice.id;
      practices.practice_number = updatedPractice.practice_number;
    }

    console.log('✅ Found practice:', practices.name);

    // Get medical aid providers
    const { data: medicalAids, error: medicalAidsError } = await supabase
      .from('medical_aid_providers')
      .select('id, name, medical_aid_reference');

    if (medicalAidsError) {
      console.log('❌ Error fetching medical aids:', medicalAidsError);
      return;
    }

    console.log(`✅ Found ${medicalAids.length} medical aid providers`);

    // Create batch headers for each medical aid
    for (const medicalAid of medicalAids) {
      console.log(`\n📋 Creating batch for ${medicalAid.name}...`);
      
      // Create batch header
      const { data: batchHeader, error: batchError } = await supabase
        .from('batch_headers')
        .insert({
          practice_id: practices.id,
          practice_number: practices.practice_number,
          batch_number: 1,
          batch_date: new Date().toISOString().split('T')[0],
          medical_aid_reference: medicalAid.medical_aid_reference,
          status: 'active'
        })
        .select()
        .single();

      if (batchError) {
        console.log(`❌ Error creating batch for ${medicalAid.name}:`, batchError);
        continue;
      }

      console.log(`✅ Created batch header for ${medicalAid.name}`);

      // Get some patients with this medical aid
      const { data: patients } = await supabase
        .from('patients')
        .select(`
          id, first_name, last_name, id_number, date_of_birth, gender,
          medical_aid_details!inner(
            membership_number, main_member_name, provider
          )
        `)
        .limit(3);

      if (!patients || patients.length === 0) {
        console.log(`⚠️ No patients found for ${medicalAid.name}`);
        continue;
      }

      // Create sample batch details for each patient
      let transactionNumber = 1;
      for (const patient of patients) {
        const sampleServices = [
          { code: '8101', amount: 242.40, description: 'Full mouth examination and charting' },
          { code: '8159', amount: 390.50, description: 'Scaling and polishing' },
          { code: '8110', amount: 73.10, description: 'Provision of sterilised instruments' }
        ];

        for (const service of sampleServices) {
          const { error: detailError } = await supabase
            .from('batch_details')
            .insert({
              batch_header_id: batchHeader.id,
              transaction_number_in_batch: transactionNumber++,
              system_patient_reference_number: patient.id.toString().slice(-7),
              medical_aid_reference: medicalAid.medical_aid_reference,
              medical_aid_membership_number: patient.medical_aid_details?.[0]?.membership_number || `MEM${Math.floor(Math.random() * 1000000)}`,
              member_surname: patient.last_name.toUpperCase(),
              member_initials: patient.first_name.charAt(0).toUpperCase(),
              patient_name: `${patient.first_name} ${patient.last_name}`.toUpperCase(),
              patient_date_of_birth: patient.date_of_birth,
              bhf_tariff_code: service.code,
              service_amount: service.amount,
              diagnosis: service.description.toUpperCase(),
              service_date: new Date(),
              invoice_number: `INV${Date.now().toString().slice(-6)}${transactionNumber}`,
              practice_number: practices.practice_number,
              treating_doctor_hpcsa_number: 'DEN00417',
              gender: patient.gender?.charAt(0)?.toUpperCase() || 'M',
              patient_id_number: patient.id_number || `ID${Math.floor(Math.random() * 10000000000)}`,
              patient_id: patient.id
            });

          if (detailError) {
            console.log(`❌ Error creating detail for ${patient.first_name}:`, detailError);
          }
        }
      }

      console.log(`✅ Created ${sampleServices.length * patients.length} batch details for ${medicalAid.name}`);

      // Create batch trailer
      const { error: trailerError } = await supabase
        .from('batch_trailer')
        .insert({
          batch_header_id: batchHeader.id,
          total_detail_transactions: sampleServices.length * patients.length,
          total_amount_detail_transactions: sampleServices.reduce((sum, s) => sum + s.amount, 0) * patients.length
        });

      if (trailerError) {
        console.log(`❌ Error creating trailer for ${medicalAid.name}:`, trailerError);
      } else {
        console.log(`✅ Created batch trailer for ${medicalAid.name}`);
      }
    }

    console.log('\n🎉 Sample batch data creation completed!');
    
    // Show summary
    const { data: batchSummary } = await supabase
      .from('batch_headers')
      .select(`
        medical_aid_reference,
        total_invoices,
        total_amount,
        status,
        medical_aid_providers:medical_aid_reference(name)
      `);

    console.log('\n📊 BATCH SUMMARY:');
    batchSummary?.forEach(batch => {
      console.log(`${batch.medical_aid_providers?.name}: ${batch.total_invoices} invoices, N$${batch.total_amount} (${batch.status})`);
    });

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

createSampleBatchData();