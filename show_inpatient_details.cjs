const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function showDetailedStructures() {
  console.log('\n===================================================================================');
  console.log('         INPATIENT MODULE - DETAILED TABLE STRUCTURES & SAMPLE DATA');
  console.log('===================================================================================\n');

  // DEPARTMENTS
  const { data: depts } = await supabase.from('departments').select('*').limit(2);
  console.log('--- DEPARTMENTS -------------------------------------------------------------------');
  console.log('Columns: id, practice_id, name, description, head_user_id, color,');
  console.log('         is_active, created_at, updated_at, code, contact_email, contact_phone');
  console.log('-----------------------------------------------------------------------------------');
  depts.forEach((d, i) => {
    console.log(`Sample ${i + 1}: ${d.code} - ${d.name}`);
    console.log(`  ID: ${d.id}`);
    console.log(`  Practice: ${d.practice_id}`);
    console.log(`  Active: ${d.is_active}`);
    console.log(`  Color: ${d.color}`);
  });
  console.log('\n');

  // WARDS
  const { data: wards } = await supabase.from('wards').select('*').limit(2);
  console.log('--- WARDS -------------------------------------------------------------------------');
  console.log('Columns: id, ward_name, ward_code, department_id, capacity, current_occupancy,');
  console.log('         ward_type, floor_number, building, nurse_station_phone, is_active,');
  console.log('         practice_id, created_at, updated_at');
  console.log('-----------------------------------------------------------------------------------');
  wards.forEach((w, i) => {
    console.log(`Sample ${i + 1}: ${w.ward_code} - ${w.ward_name}`);
    console.log(`  ID: ${w.id}`);
    console.log(`  Department: ${w.department_id}`);
    console.log(`  Capacity: ${w.capacity}, Current Occupancy: ${w.current_occupancy}`);
    console.log(`  Type: ${w.ward_type}, Floor: ${w.floor_number}, Building: ${w.building}`);
  });
  console.log('\n');

  // ROOMS
  const { data: rooms } = await supabase.from('rooms').select('*').limit(2);
  console.log('--- ROOMS -------------------------------------------------------------------------');
  console.log('Columns: id, room_number, room_name, room_type, department_id, ward_id,');
  console.log('         floor_number, building, bed_count, occupied_beds, room_status,');
  console.log('         amenities, daily_rate, is_active, practice_id, created_at, updated_at');
  console.log('-----------------------------------------------------------------------------------');
  rooms.forEach((r, i) => {
    console.log(`Sample ${i + 1}: ${r.room_number} - ${r.room_name || 'N/A'}`);
    console.log(`  ID: ${r.id}`);
    console.log(`  Ward: ${r.ward_id}`);
    console.log(`  Department: ${r.department_id}`);
    console.log(`  Type: ${r.room_type}, Status: ${r.room_status}`);
    console.log(`  Beds: ${r.bed_count}, Occupied: ${r.occupied_beds}`);
    console.log(`  Floor: ${r.floor_number}, Building: ${r.building}`);
  });
  console.log('\n');

  // BEDS
  const { data: beds } = await supabase.from('beds').select('*').limit(3);
  console.log('--- BEDS --------------------------------------------------------------------------');
  console.log('Columns: id, bed_number, bed_name, room_id, ward_id, department_id, bed_type,');
  console.log('         bed_status, patient_id, patient_name, admission_date, expected_discharge,');
  console.log('         is_active, practice_id, created_at, updated_at');
  console.log('-----------------------------------------------------------------------------------');
  beds.forEach((b, i) => {
    console.log(`Sample ${i + 1}: ${b.bed_number}`);
    console.log(`  ID: ${b.id}`);
    console.log(`  Room: ${b.room_id}`);
    console.log(`  Ward: ${b.ward_id}`);
    console.log(`  Department: ${b.department_id}`);
    console.log(`  Type: ${b.bed_type}, Status: ${b.bed_status}`);
    console.log(`  Patient: ${b.patient_id || 'None'}`);
  });
  console.log('\n');

  // BED_ALLOCATIONS (empty but show structure)
  console.log('--- BED_ALLOCATIONS ---------------------------------------------------------------');
  console.log('Status: Empty table (no records yet)');
  console.log('Expected columns: id, bed_id, patient_id, allocation_date, expected_discharge,');
  console.log('                  discharge_date, status, notes, practice_id, created_at, updated_at');
  console.log('-----------------------------------------------------------------------------------\n');

  // PATIENT_ADMISSIONS (empty but show structure)
  console.log('--- PATIENT_ADMISSIONS ------------------------------------------------------------');
  console.log('Status: Empty table (no records yet)');
  console.log('Expected columns: id, patient_id, ward_id, bed_id, admission_date, admission_type,');
  console.log('                  admission_reason, attending_doctor_id, discharge_date, discharge_type,');
  console.log('                  discharge_summary, status, practice_id, created_at, updated_at');
  console.log('-----------------------------------------------------------------------------------\n');

  console.log('===================================================================================\n');
}

showDetailedStructures().catch(console.error);
