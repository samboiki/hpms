import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Migration script to convert appointments to visits
 */
async function migrateAppointmentsToVisits() {
  console.log('🚀 Starting appointments to visits migration...');
  
  try {
    // Step 1: Fetch all appointments
    console.log('📊 Fetching existing appointments...');
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch appointments: ${fetchError.message}`);
    }

    if (!appointments || appointments.length === 0) {
      console.log('✅ No appointments found to migrate');
      return;
    }

    console.log(`📋 Found ${appointments.length} appointments to migrate`);

    // Step 2: Convert appointments to visits
    console.log('🔄 Converting appointments to visit format...');
    const visitsToInsert = appointments.map((appointment) => {
      // Map appointment status to visit boolean flags
      const isScheduled = ['scheduled', 'pending', 'confirmed'].includes(appointment.status);
      const isConfirmed = ['scheduled', 'confirmed', 'ready', 'in-progress', 'completed'].includes(appointment.status);
      const isCheckedIn = ['ready', 'in-progress', 'completed'].includes(appointment.status);
      const isReady = appointment.status === 'ready';
      const isCancelled = appointment.status === 'cancelled';
      
      // Map appointment status to visit status
      let visitStatus = appointment.status;
      if (appointment.status === 'scheduled' || appointment.status === 'confirmed' || appointment.status === 'pending') {
        visitStatus = 'scheduled';
      }

      return {
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        visit_date: appointment.date,
        visit_time: appointment.time,
        visit_type: appointment.type || 'consultation',
        status: visitStatus,
        notes: appointment.notes || null,
        practice_id: appointment.practice_id,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        
        // New scheduling properties
        is_scheduled: isScheduled,
        is_confirmed: isConfirmed,
        is_ready: isReady,
        is_checked_in: isCheckedIn,
        is_cancelled: isCancelled,
        scheduled_date: appointment.date,
        scheduled_time: appointment.time,
      };
    });

    // Step 3: Insert visits in batches
    console.log('💾 Inserting visits into database...');
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < visitsToInsert.length; i += batchSize) {
      const batch = visitsToInsert.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('visits')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
        throw insertError;
      }

      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(visitsToInsert.length / batchSize)} (${insertedCount}/${visitsToInsert.length} visits)`);
    }

    console.log(`🎉 Successfully migrated ${insertedCount} appointments to visits!`);

    // Step 4: Verify migration
    console.log('🔍 Verifying migration...');
    const { data: migratedVisits, error: verifyError } = await supabase
      .from('visits')
      .select('id')
      .not('scheduled_date', 'is', null);

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else {
      console.log(`✅ Verification complete: ${migratedVisits?.length || 0} visits found with scheduled dates`);
    }

    // Step 5: Show migration summary
    console.log('\n📊 Migration Summary:');
    console.log(`   • Appointments processed: ${appointments.length}`);
    console.log(`   • Visits created: ${insertedCount}`);
    console.log(`   • Status mapping:`);
    
    const statusCounts = appointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`     - ${status}: ${count} appointments`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   1. Test the new visits-based components');
    console.log('   2. Update all appointment references to use visits');
    console.log('   3. Verify real-time subscriptions work correctly');
    console.log('   4. Once confident, consider backing up and removing appointments table');
    console.log('   5. Update edge functions to use visits table');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Check migration status and provide statistics
 */
async function checkMigrationStatus() {
  console.log('📊 Checking migration status...');
  
  try {
    // Count appointments
    const { count: appointmentCount, error: aptError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    // Count visits
    const { count: visitCount, error: visitError } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true });

    // Count visits with scheduled dates (migrated visits)
    const { count: scheduledVisitCount, error: schedError } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .not('scheduled_date', 'is', null);

    if (aptError || visitError || schedError) {
      throw new Error('Error checking migration status');
    }

    console.log('\n📈 Current Status:');
    console.log(`   • Appointments: ${appointmentCount || 0}`);
    console.log(`   • Total Visits: ${visitCount || 0}`);
    console.log(`   • Migrated Visits (with scheduled dates): ${scheduledVisitCount || 0}`);

    // Check if migration is needed
    const aptCount = appointmentCount || 0;
    const migratedCount = scheduledVisitCount || 0;
    
    if (aptCount > 0 && migratedCount === 0) {
      console.log('\n🚨 Migration needed: Found appointments but no migrated visits');
    } else if (aptCount > 0 && migratedCount > 0) {
      console.log('\n⚠️  Partial migration detected: Both appointments and migrated visits exist');
    } else if (aptCount === 0 && migratedCount > 0) {
      console.log('\n✅ Migration appears complete: No appointments, migrated visits exist');
    } else {
      console.log('\n❓ No data found in either table');
    }

  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

// Run based on command line argument
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrateAppointmentsToVisits();
    break;
  case 'status':
    checkMigrationStatus();
    break;
  default:
    console.log('Usage: node run-migration.js [migrate|status]');
    break;
}