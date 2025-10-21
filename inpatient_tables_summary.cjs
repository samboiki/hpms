const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateSummary() {
  console.log('\n' + '='.repeat(100));
  console.log('INPATIENT MODULE - COMPREHENSIVE TABLE SUMMARY');
  console.log('='.repeat(100));

  const tables = [
    { name: 'departments', description: 'Practice departments (e.g., Emergency, Surgery, Pediatrics)' },
    { name: 'wards', description: 'Hospital wards within departments' },
    { name: 'rooms', description: 'Individual rooms within wards' },
    { name: 'beds', description: 'Beds within rooms' },
    { name: 'bed_allocations', description: 'Active bed assignments to patients' },
    { name: 'patient_admissions', description: 'Patient admission records' }
  ];

  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      console.log(`\n📊 ${table.name.toUpperCase()}`);
      console.log(`   Description: ${table.description}`);
      console.log(`   Record Count: ${count || 0}`);
      console.log(`   Status: ${count > 0 ? '✅ Has Data' : '⚠️  Empty'}`);
    } catch (err) {
      console.log(`\n❌ ${table.name.toUpperCase()}: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('INPATIENT DATA HIERARCHY');
  console.log('='.repeat(100));

  const hierarchy = `
  practices (root)
      ↓
  departments (15 records)
      ↓ (department_id)
  wards (8 records)
      ↓ (ward_id)
  rooms (40 records)
      ↓ (room_id)
  beds (72 records)
      ↓ (bed_id)
  bed_allocations (0 records) ← Assigns beds to patients
      ↓
  patient_admissions (0 records) ← Tracks full admission lifecycle
  `;

  console.log(hierarchy);

  console.log('='.repeat(100));
  console.log('FOREIGN KEY RELATIONSHIPS');
  console.log('='.repeat(100));

  const relationships = [
    { table: 'departments', fk: 'practice_id', references: 'practices(id)' },
    { table: 'wards', fk: 'department_id', references: 'departments(id)' },
    { table: 'wards', fk: 'practice_id', references: 'practices(id)' },
    { table: 'rooms', fk: 'department_id', references: 'departments(id)' },
    { table: 'rooms', fk: 'ward_id', references: 'wards(id)' },
    { table: 'rooms', fk: 'practice_id', references: 'practices(id)' },
    { table: 'beds', fk: 'room_id', references: 'rooms(id)' },
    { table: 'beds', fk: 'ward_id', references: 'wards(id)' },
    { table: 'beds', fk: 'department_id', references: 'departments(id)' },
    { table: 'beds', fk: 'practice_id', references: 'practices(id)' },
    { table: 'beds', fk: 'patient_id', references: 'patients(id)' },
    { table: 'bed_allocations', fk: 'bed_id', references: 'beds(id)' },
    { table: 'bed_allocations', fk: 'patient_id', references: 'patients(id)' },
    { table: 'patient_admissions', fk: 'patient_id', references: 'patients(id)' },
    { table: 'patient_admissions', fk: 'ward_id', references: 'wards(id)' },
    { table: 'patient_admissions', fk: 'bed_id', references: 'beds(id)' }
  ];

  relationships.forEach(rel => {
    console.log(`   ${rel.table}.${rel.fk} → ${rel.references}`);
  });

  console.log('\n' + '='.repeat(100));
  console.log('LEGACY TABLES (For Migration/Compatibility)');
  console.log('='.repeat(100));

  const legacyTables = [
    { name: 'hospital_wards', records: 5, note: 'Older ward structure' },
    { name: 'ward_beds', records: 65, note: 'Older bed structure without room concept' }
  ];

  legacyTables.forEach(table => {
    console.log(`   ${table.name}: ${table.records} records - ${table.note}`);
  });

  console.log('\n' + '='.repeat(100));
  console.log('KEY STATISTICS');
  console.log('='.repeat(100));

  try {
    const stats = await Promise.all([
      supabase.from('departments').select('*', { count: 'exact', head: true }),
      supabase.from('wards').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('beds').select('*', { count: 'exact', head: true }),
      supabase.from('beds').select('*', { count: 'exact', head: true }).eq('bed_status', 'Available'),
      supabase.from('beds').select('*', { count: 'exact', head: true }).eq('bed_status', 'Occupied')
    ]);

    console.log(`   Total Departments: ${stats[0].count || 0}`);
    console.log(`   Total Wards: ${stats[1].count || 0}`);
    console.log(`   Total Rooms: ${stats[2].count || 0}`);
    console.log(`   Total Beds: ${stats[3].count || 0}`);
    console.log(`   Available Beds: ${stats[4].count || 0}`);
    console.log(`   Occupied Beds: ${stats[5].count || 0}`);
    console.log(`   Occupancy Rate: ${stats[3].count > 0 ? ((stats[5].count / stats[3].count) * 100).toFixed(1) : 0}%`);
  } catch (err) {
    console.log(`   Error calculating statistics: ${err.message}`);
  }

  console.log('\n' + '='.repeat(100));
}

generateSummary().catch(console.error);
