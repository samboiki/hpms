import { supabase } from '../src/lib/supabase';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes: string;
  practice_id: string;
  created_at: string;
  updated_at: string;
}

interface VisitMigrationData {
  patient_id: string;
  doctor_id: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  status: string;
  notes: string | null;
  practice_id: string;
  created_at: string;
  updated_at: string;
  
  // New scheduling properties
  is_scheduled: boolean;
  is_confirmed: boolean;
  is_ready: boolean;
  is_checked_in: boolean;
  is_cancelled: boolean;
  scheduled_date: string;
  scheduled_time: string;
}

/**
 * Migration script to convert appointments to visits
 * This script will:
 * 1. Fetch all existing appointments
 * 2. Convert them to visit format with appropriate scheduling flags
 * 3. Insert them into the visits table
 * 4. Optionally backup and remove appointments
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
    const visitsToInsert: VisitMigrationData[] = appointments.map((appointment: Appointment) => {
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

    // Step 5: Create backup of appointments table (optional)
    console.log('💾 Creating backup of appointments table...');
    const { error: backupError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        -- Create backup table
        CREATE TABLE IF NOT EXISTS appointments_backup AS 
        SELECT * FROM appointments;
        
        -- Add timestamp to backup
        COMMENT ON TABLE appointments_backup IS 'Backup created during migration to visits on ${new Date().toISOString()}';
      `
    });

    if (backupError) {
      console.error('⚠️  Warning: Could not create backup:', backupError);
    } else {
      console.log('✅ Appointments backup created successfully');
    }

    // Step 6: Show migration summary
    console.log('\n📊 Migration Summary:');
    console.log(`   • Appointments processed: ${appointments.length}`);
    console.log(`   • Visits created: ${insertedCount}`);
    console.log(`   • Status mapping:`);
    
    const statusCounts = appointments.reduce((acc: any, apt: Appointment) => {
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
    console.log('   4. Once confident, consider dropping appointments table');
    console.log('   5. Update edge functions to use visits table');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback function to restore appointments from visits
 * Use this if you need to revert the migration
 */
async function rollbackMigration() {
  console.log('🔄 Rolling back migration...');
  
  try {
    // Restore from backup
    const { error } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        -- Clear current appointments
        TRUNCATE TABLE appointments;
        
        -- Restore from backup
        INSERT INTO appointments 
        SELECT * FROM appointments_backup;
      `
    });

    if (error) {
      throw error;
    }

    console.log('✅ Migration rolled back successfully');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
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
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true });

    // Count visits
    const { data: visits, error: visitError } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true });

    // Count visits with scheduled dates (migrated visits)
    const { data: scheduledVisits, error: schedError } = await supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .not('scheduled_date', 'is', null);

    if (aptError || visitError || schedError) {
      throw new Error('Error checking migration status');
    }

    console.log('\n📈 Current Status:');
    console.log(`   • Appointments: ${appointments?.length || 0}`);
    console.log(`   • Total Visits: ${visits?.length || 0}`);
    console.log(`   • Migrated Visits (with scheduled dates): ${scheduledVisits?.length || 0}`);

    // Check if migration is needed
    const appointmentCount = appointments?.length || 0;
    const migratedCount = scheduledVisits?.length || 0;
    
    if (appointmentCount > 0 && migratedCount === 0) {
      console.log('\n🚨 Migration needed: Found appointments but no migrated visits');
    } else if (appointmentCount > 0 && migratedCount > 0) {
      console.log('\n⚠️  Partial migration detected: Both appointments and migrated visits exist');
    } else if (appointmentCount === 0 && migratedCount > 0) {
      console.log('\n✅ Migration appears complete: No appointments, migrated visits exist');
    } else {
      console.log('\n❓ No data found in either table');
    }

  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

// Export functions for use
export {
  migrateAppointmentsToVisits,
  rollbackMigration,
  checkMigrationStatus
};

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      migrateAppointmentsToVisits();
      break;
    case 'rollback':
      rollbackMigration();
      break;
    case 'status':
      checkMigrationStatus();
      break;
    default:
      console.log('Usage: tsx migrate-appointments-to-visits.ts [migrate|rollback|status]');
      break;
  }
}