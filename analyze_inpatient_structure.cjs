const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERROR: No Supabase key found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeInpatientStructure() {
  console.log('='.repeat(80));
  console.log('COMPLETE INPATIENT STRUCTURE ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Query all wards
    console.log('📊 HOSPITAL WARDS:');
    console.log('-'.repeat(80));
    const { data: wards, error: wardsError } = await supabase
      .from('hospital_wards')
      .select('*')
      .order('ward_name');

    if (wardsError) {
      console.error('Error fetching wards:', wardsError);
    } else if (wards && wards.length > 0) {
      console.log(`Total Wards: ${wards.length}\n`);
      wards.forEach((ward, idx) => {
        console.log(`${idx + 1}. ${ward.ward_name} (${ward.ward_code})`);
        console.log(`   - ID: ${ward.id}`);
        console.log(`   - Type: ${ward.ward_type || 'N/A'}`);
        console.log(`   - Floor: ${ward.floor_number || 'N/A'}`);
        console.log(`   - Department ID: ${ward.department_id || 'None'}`);
        console.log(`   - Total Beds: ${ward.total_beds || 0}`);
        console.log(`   - Occupied: ${ward.occupied_beds || 0}`);
        console.log(`   - Available: ${(ward.total_beds || 0) - (ward.occupied_beds || 0)}`);
        console.log(`   - Status: ${ward.is_active ? 'Active' : 'Inactive'}`);
        console.log(`   - Description: ${ward.description || 'N/A'}`);
        console.log(`   - Features: ${ward.features ? ward.features.join(', ') : 'None'}`);
        console.log(`   - Visiting Hours: ${ward.visiting_hours_start || 'N/A'} - ${ward.visiting_hours_end || 'N/A'}`);
        console.log(`   - Head Nurse: ${ward.head_nurse_id || 'Not assigned'}`);
        console.log();
      });
    } else {
      console.log('No wards found in hospital_wards table.');
    }
    console.log();

    // 2. Query all beds
    console.log('🛏️  WARD BEDS:');
    console.log('-'.repeat(80));
    const { data: beds, error: bedsError } = await supabase
      .from('ward_beds')
      .select('*')
      .order('ward_id, room_number, bed_number');

    if (bedsError) {
      console.error('Error fetching beds:', bedsError);
    } else if (beds && beds.length > 0) {
      console.log(`Total Beds: ${beds.length}\n`);

      // Group by ward
      const bedsByWard = beds.reduce((acc, bed) => {
        if (!acc[bed.ward_id]) acc[bed.ward_id] = [];
        acc[bed.ward_id].push(bed);
        return acc;
      }, {});

      Object.entries(bedsByWard).forEach(([wardId, wardBeds]) => {
        const ward = wards?.find(w => w.id === wardId);
        console.log(`Ward: ${ward?.ward_name || wardId}`);

        // Group by room
        const bedsByRoom = wardBeds.reduce((acc, bed) => {
          const room = bed.room_number || 'No Room';
          if (!acc[room]) acc[room] = [];
          acc[room].push(bed);
          return acc;
        }, {});

        Object.entries(bedsByRoom).forEach(([roomNumber, roomBeds]) => {
          console.log(`  Room ${roomNumber}: ${roomBeds.length} bed(s)`);
          roomBeds.forEach(bed => {
            console.log(`    - Bed ${bed.bed_number}: ${bed.bed_type || 'standard'} (${bed.status || 'available'})`);
          });
        });
        console.log();
      });
    } else {
      console.log('No beds found in ward_beds table.');
    }
    console.log();

    // 3. Query departments
    console.log('🏥 DEPARTMENTS:');
    console.log('-'.repeat(80));
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
    } else if (departments && departments.length > 0) {
      console.log(`Total Departments: ${departments.length}\n`);
      departments.forEach((dept, idx) => {
        const deptWards = wards?.filter(w => w.department_id === dept.id) || [];
        console.log(`${idx + 1}. ${dept.name}`);
        console.log(`   - ID: ${dept.id}`);
        console.log(`   - Type: ${dept.department_type || 'N/A'}`);
        console.log(`   - Description: ${dept.description || 'N/A'}`);
        console.log(`   - Wards: ${deptWards.length} (${deptWards.map(w => w.ward_name).join(', ') || 'None'})`);
        console.log();
      });
    } else {
      console.log('No departments found.');
    }
    console.log();

    // 4. Summary and structure analysis
    console.log('📈 STRUCTURE SUMMARY:');
    console.log('-'.repeat(80));
    console.log(`Total Departments: ${departments?.length || 0}`);
    console.log(`Total Wards: ${wards?.length || 0}`);
    console.log(`Total Beds: ${beds?.length || 0}`);
    console.log();

    if (wards && beds) {
      // Analyze room structure
      const totalRooms = new Set(beds.map(b => `${b.ward_id}-${b.room_number}`)).size;
      console.log(`Total Rooms (estimated): ${totalRooms}`);
      console.log();

      console.log('HIERARCHY:');
      console.log('Departments → Wards → Rooms (via bed grouping) → Beds');
      console.log();

      // Check if structure matches examples
      const wardNames = wards.map(w => w.ward_name.toLowerCase());
      const expectedWards = ['emergency', 'general', 'icu', 'maternity'];
      const matchedWards = expectedWards.filter(expected =>
        wardNames.some(name => name.includes(expected))
      );

      console.log('EXAMPLE WARD MATCHING:');
      console.log(`Expected wards: Emergency, General, ICU, Maternity`);
      console.log(`Matched: ${matchedWards.join(', ') || 'None'}`);
    }

    console.log();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

analyzeInpatientStructure();