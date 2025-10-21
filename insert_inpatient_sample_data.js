#!/usr/bin/env node

/**
 * Insert comprehensive sample data into inpatient tables
 * Creates wards, beds, and sample data for immediate testing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🏥 INPATIENT SAMPLE DATA INSERTION STARTING...\n');

async function insertBeds(insertedWards, practiceId, supabase) {
  console.log('🛏️ Step 3: Inserting sample beds for each ward...');

  // Check if beds already exist
  const { data: existingBeds, error: existingBedsError } = await supabase
    .from('ward_beds')
    .select('id, bed_number, ward_id')
    .in('ward_id', insertedWards.map(w => w.id));

  if (existingBedsError) {
    console.log('⚠️ Could not check existing beds:', existingBedsError.message);
  } else if (existingBeds && existingBeds.length > 0) {
    console.log(`✅ Found ${existingBeds.length} existing beds`);
    console.log('   Skipping bed insertion...\n');

    // Continue with user assignment and verification
    await assignUsers(insertedWards, practiceId, supabase);
    return;
  }

  // Generate beds for each ward
  const allBeds = [];

  for (const ward of insertedWards) {
    console.log(`   Creating beds for ${ward.ward_name}...`);

    for (let i = 1; i <= ward.total_beds; i++) {
      const bedNumber = `${ward.ward_code}${i.toString().padStart(2, '0')}`;

      // Determine bed status - make some occupied or in maintenance for realism
      let bedStatus = 'available';
      let patientId = null;

      if (i <= ward.occupied_beds) {
        bedStatus = 'occupied';
        // In a real scenario, you'd have actual patient IDs
      } else if (i === ward.total_beds && ward.ward_type !== 'emergency') {
        bedStatus = 'maintenance';
      }

      // Determine bed type based on ward type (using valid constraint values)
      let bedType = 'standard';
      if (ward.ward_type === 'icu') {
        bedType = 'icu';
      } else if (ward.ward_type === 'pediatric') {
        bedType = 'pediatric';
      } else if (ward.ward_type === 'maternity') {
        bedType = 'standard'; // Maternity uses standard beds with special features
      } else if (ward.ward_type === 'emergency') {
        bedType = 'emergency';
      }

      // Determine bed features based on type
      let bedFeatures = ['call_button', 'side_rails'];
      if (bedType === 'icu') {
        bedFeatures = ['oxygen', 'cardiac_monitor', 'ventilator', 'call_button', 'side_rails'];
      } else if (bedType === 'pediatric') {
        bedFeatures = ['oxygen', 'call_button', 'side_rails', 'child_safety'];
      } else if (bedType === 'emergency') {
        bedFeatures = ['oxygen', 'cardiac_monitor', 'call_button'];
      } else if (ward.ward_type === 'maternity') {
        bedFeatures = ['oxygen', 'call_button', 'electric_adjustable', 'side_rails'];
      } else {
        bedFeatures = ['oxygen', 'call_button', 'electric_adjustable', 'side_rails'];
      }

      // Determine room type
      let roomType = 'double'; // Default
      if (ward.ward_type === 'icu') {
        roomType = 'single';
      } else if (ward.ward_type === 'maternity') {
        roomType = 'single';
      } else if (ward.ward_type === 'emergency') {
        roomType = 'ward';
      }

      const bed = {
        ward_id: ward.id,
        bed_number: bedNumber,
        bed_code: `${ward.ward_code}-${Math.ceil(i / 2)}-${i % 2 === 1 ? 'A' : 'B'}`,
        bed_type: bedType,
        room_number: `${ward.ward_code}-${Math.ceil(i / 2)}`,
        room_type: roomType,
        status: bedStatus,
        features: bedFeatures,
        daily_rate: bedType === 'icu' ? 500.00 : ward.ward_type === 'maternity' ? 350.00 : bedType === 'pediatric' ? 300.00 : 250.00,
        last_cleaned_at: bedStatus !== 'maintenance' ? new Date().toISOString() : null,
        next_maintenance_date: bedStatus === 'maintenance' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
        notes: bedStatus === 'maintenance' ? 'Scheduled equipment maintenance' : null,
        is_active: true
      };

      allBeds.push(bed);
    }
  }

  console.log(`   Inserting ${allBeds.length} beds total...`);

  // Insert all beds in batches to avoid timeout
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < allBeds.length; i += batchSize) {
    batches.push(allBeds.slice(i, i + batchSize));
  }

  let totalInsertedBeds = 0;
  for (const batch of batches) {
    const { data: insertedBeds, error: bedsError } = await supabase
      .from('ward_beds')
      .insert(batch)
      .select();

    if (bedsError) {
      console.error('❌ Error inserting beds batch:', bedsError);
      continue;
    }

    totalInsertedBeds += insertedBeds.length;
  }

  console.log(`✅ Successfully inserted ${totalInsertedBeds} beds\n`);

  // Continue with user assignment
  await assignUsers(insertedWards, practiceId, supabase);
}

async function assignUsers(insertedWards, practiceId, supabase) {
  console.log('👩‍⚕️ Step 4: Checking for qualified users for head nurse assignments...');

  // Get users with doctor or nurse roles
  const { data: qualifiedUsers, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('role', ['doctor', 'nurse', 'head_nurse'])
    .eq('practice_id', practiceId)
    .limit(10);

  if (usersError) {
    console.log('⚠️ Could not fetch users for head nurse assignment:', usersError.message);
  } else if (qualifiedUsers && qualifiedUsers.length > 0) {
    console.log(`✅ Found ${qualifiedUsers.length} qualified users:`);
    qualifiedUsers.forEach(user => {
      console.log(`   • ${user.full_name} (${user.role})`);
    });

    // Assign head nurses to wards (optional)
    if (qualifiedUsers.length >= insertedWards.length) {
      console.log('   Assigning head nurses to wards...');

      for (let i = 0; i < insertedWards.length && i < qualifiedUsers.length; i++) {
        const { error: updateError } = await supabase
          .from('hospital_wards')
          .update({ head_nurse_id: qualifiedUsers[i].id })
          .eq('id', insertedWards[i].id);

        if (!updateError) {
          console.log(`   ✅ Assigned ${qualifiedUsers[i].full_name} to ${insertedWards[i].ward_name}`);
        }
      }
    }
  } else {
    console.log('⚠️ No qualified users found for head nurse assignments');
  }
  console.log();

  // Continue with verification
  await verifyData(practiceId, supabase);
}

async function verifyData(practiceId, supabase) {
  console.log('✅ Step 5: Verification and Summary Report...');

  // Verify the insertions
  const { data: finalWards, error: verifyWardsError } = await supabase
    .from('hospital_wards')
    .select(`
      *,
      head_nurse:users(full_name, role)
    `)
    .eq('practice_id', practiceId);

  const { data: finalBeds, error: verifyBedsError } = await supabase
    .from('ward_beds')
    .select('ward_id, status')
    .in('ward_id', finalWards?.map(w => w.id) || []);

  if (verifyWardsError || verifyBedsError) {
    console.log('⚠️ Could not verify all insertions');
  } else {
    console.log('\n📊 FINAL SUMMARY REPORT:');
    console.log('========================');
    console.log(`Total Wards Available: ${finalWards.length}`);
    console.log(`Total Beds Available: ${finalBeds.length}`);
    console.log();

    console.log('WARD BREAKDOWN:');
    finalWards.forEach(ward => {
      const wardBeds = finalBeds.filter(bed => bed.ward_id === ward.id);
      const availableBeds = wardBeds.filter(bed => bed.status === 'available').length;
      const occupiedBeds = wardBeds.filter(bed => bed.status === 'occupied').length;
      const maintenanceBeds = wardBeds.filter(bed => bed.status === 'maintenance').length;

      console.log(`• ${ward.ward_name} (${ward.ward_code})`);
      console.log(`  Type: ${ward.ward_type}`);
      console.log(`  Total Beds: ${wardBeds.length}`);
      console.log(`  Available: ${availableBeds} | Occupied: ${occupiedBeds} | Maintenance: ${maintenanceBeds}`);
      if (ward.head_nurse) {
        console.log(`  Head Nurse: ${ward.head_nurse.full_name}`);
      }
      console.log();
    });

    console.log('BED STATUS SUMMARY:');
    const statusCounts = finalBeds.reduce((acc, bed) => {
      acc[bed.status] = (acc[bed.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`• ${status}: ${count} beds`);
    });
  }

  console.log('\n🎉 INPATIENT SAMPLE DATA INSERTION COMPLETED SUCCESSFULLY!');
  console.log('\nYou can now:');
  console.log('• Test inpatient admission workflows');
  console.log('• Practice bed management');
  console.log('• Simulate ward operations');
  console.log('• Test bed status changes');
  console.log('• Practice patient transfers between wards');
}

async function main() {
  try {
    console.log('📊 Step 1: Getting practice ID from practices table...');

    // Get the first practice to use for sample data
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(1);

    if (practicesError) {
      console.error('❌ Error fetching practices:', practicesError);
      return;
    }

    if (!practices || practices.length === 0) {
      console.error('❌ No practices found in database');
      return;
    }

    const practiceId = practices[0].id;
    const practiceName = practices[0].name;
    console.log(`✅ Found practice: ${practiceName} (${practiceId})\n`);

    console.log('🏥 Step 2: Checking existing wards and inserting sample wards...');

    // Check if wards already exist
    const { data: existingWards, error: existingError } = await supabase
      .from('hospital_wards')
      .select('id, ward_name, ward_code, ward_type, total_beds, occupied_beds')
      .eq('practice_id', practiceId);

    if (existingError) {
      console.error('❌ Error checking existing wards:', existingError);
      return;
    }

    if (existingWards && existingWards.length > 0) {
      console.log(`✅ Found ${existingWards.length} existing wards:`);
      existingWards.forEach(ward => {
        console.log(`   • ${ward.ward_name} (${ward.ward_code})`);
      });
      console.log('   Skipping ward insertion, using existing wards...\n');

      // Use existing wards
      const insertedWards = existingWards;

      // Jump to bed insertion
      await insertBeds(existingWards, practiceId, supabase);
      return;
    }

    // Define sample wards with different types and capacities (only if no existing wards)
    const sampleWards = [
      {
        practice_id: practiceId,
        ward_name: 'General Ward A',
        ward_code: 'GWA',
        ward_type: 'general',
        floor_number: 1,
        total_beds: 20,
        occupied_beds: 2,
        description: 'Main general medical ward for standard patient care',
        features: ['oxygen', 'call_button', 'electric_adjustable'],
        visiting_hours_start: '09:00',
        visiting_hours_end: '17:00',
        max_visitors_per_patient: 2,
        nurse_station_ext: 'ext-101',
        head_nurse_id: null,
        is_active: true
      },
      {
        practice_id: practiceId,
        ward_name: 'Intensive Care Unit',
        ward_code: 'ICU',
        ward_type: 'icu',
        floor_number: 2,
        total_beds: 10,
        occupied_beds: 2,
        description: 'Critical care unit for patients requiring intensive monitoring',
        features: ['oxygen', 'cardiac_monitor', 'ventilator', 'call_button'],
        visiting_hours_start: '14:00',
        visiting_hours_end: '16:00',
        max_visitors_per_patient: 1,
        nurse_station_ext: 'ext-201',
        head_nurse_id: null,
        is_active: true
      },
      {
        practice_id: practiceId,
        ward_name: 'Pediatric Ward',
        ward_code: 'PED',
        ward_type: 'pediatric',
        floor_number: 1,
        total_beds: 15,
        occupied_beds: 2,
        description: 'Specialized ward for children and adolescent patients',
        features: ['oxygen', 'call_button', 'side_rails', 'child_safety'],
        visiting_hours_start: '10:00',
        visiting_hours_end: '19:00',
        max_visitors_per_patient: 3,
        nurse_station_ext: 'ext-102',
        head_nurse_id: null,
        is_active: true
      },
      {
        practice_id: practiceId,
        ward_name: 'Maternity Ward',
        ward_code: 'MAT',
        ward_type: 'maternity',
        floor_number: 3,
        total_beds: 12,
        occupied_beds: 2,
        description: 'Dedicated ward for maternity and obstetric care',
        features: ['oxygen', 'call_button', 'electric_adjustable', 'birthing_equipment'],
        visiting_hours_start: '08:00',
        visiting_hours_end: '20:00',
        max_visitors_per_patient: 3,
        nurse_station_ext: 'ext-301',
        head_nurse_id: null,
        is_active: true
      },
      {
        practice_id: practiceId,
        ward_name: 'Emergency Ward',
        ward_code: 'ER',
        ward_type: 'emergency',
        floor_number: 0,
        total_beds: 8,
        occupied_beds: 2,
        description: 'High-turnover ward for emergency department admissions',
        features: ['oxygen', 'cardiac_monitor', 'call_button', 'trauma_equipment'],
        visiting_hours_start: '00:00',
        visiting_hours_end: '23:59',
        max_visitors_per_patient: 1,
        nurse_station_ext: 'ext-001',
        head_nurse_id: null,
        is_active: true
      }
    ];

    // Insert the wards
    const { data: insertedWards, error: wardsError } = await supabase
      .from('hospital_wards')
      .insert(sampleWards)
      .select();

    if (wardsError) {
      console.error('❌ Error inserting wards:', wardsError);
      return;
    }

    console.log(`✅ Successfully inserted ${insertedWards.length} wards:`);
    insertedWards.forEach(ward => {
      console.log(`   • ${ward.ward_name} (${ward.ward_code}) - ${ward.ward_type} - ${ward.total_beds} beds`);
    });
    console.log();

    // Continue with bed insertion
    await insertBeds(insertedWards, practiceId, supabase);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

main();