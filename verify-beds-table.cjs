const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBeds() {
  console.log('=== WARD_BEDS TABLE VERIFICATION ===\n');

  const { data: beds, error: bedsError } = await supabase
    .from('ward_beds')
    .select('id, bed_number, bed_code, status, ward_id, ward:hospital_wards(ward_name, ward_code)');

  if (bedsError) {
    console.error('Error fetching beds:', bedsError);
    return;
  }

  console.log(`Total beds in ward_beds table: ${beds.length}\n`);

  if (beds.length > 0) {
    console.log('Bed Status Breakdown:');
    const statuses = beds.reduce((acc, bed) => {
      acc[bed.status] = (acc[bed.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\nBeds by Ward:');
    const bedsByWard = beds.reduce((acc, bed) => {
      const wardName = bed.ward?.ward_name || 'Unknown Ward';
      if (!acc[wardName]) acc[wardName] = [];
      acc[wardName].push(bed);
      return acc;
    }, {});

    Object.entries(bedsByWard).forEach(([wardName, wardBeds]) => {
      console.log(`  ${wardName}: ${wardBeds.length} beds`);
      const statusCounts = wardBeds.reduce((acc, bed) => {
        acc[bed.status] = (acc[bed.status] || 0) + 1;
        return acc;
      }, {});
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });
    });
  } else {
    console.log('⚠️  NO BEDS FOUND IN ward_beds TABLE');
    console.log('The dashboard will use ward aggregate counters (total_beds/occupied_beds from hospital_wards table)');
  }

  console.log('\n=== DASHBOARD CALCULATION LOGIC ===');
  console.log('Based on inpatientStore.ts calculateOccupancy() function:');

  if (beds.length > 0) {
    console.log('\n✓ Using ward_beds table (individual bed records)');
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const availableBeds = beds.filter(b => b.status === 'available').length;
    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0;

    console.log(`  Total Beds: ${totalBeds}`);
    console.log(`  Occupied Beds: ${occupiedBeds}`);
    console.log(`  Available Beds: ${availableBeds}`);
    console.log(`  Occupancy Rate: ${occupancyRate}%`);
  } else {
    console.log('\n✓ Using hospital_wards aggregate counters (fallback)');

    const { data: wards } = await supabase
      .from('hospital_wards')
      .select('total_beds, occupied_beds')
      .eq('is_active', true);

    const totalBeds = wards.reduce((sum, w) => sum + (w.total_beds || 0), 0);
    const occupiedBeds = wards.reduce((sum, w) => sum + (w.occupied_beds || 0), 0);
    const availableBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0;

    console.log(`  Total Beds: ${totalBeds}`);
    console.log(`  Occupied Beds: ${occupiedBeds}`);
    console.log(`  Available Beds: ${availableBeds}`);
    console.log(`  Occupancy Rate: ${occupancyRate}%`);
  }
}

verifyBeds().catch(console.error);