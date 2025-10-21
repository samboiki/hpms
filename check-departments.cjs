const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDepartments() {
  try {
    console.log('=================================');
    console.log('ALL DEPARTMENTS IN DATABASE');
    console.log('=================================\n');

    // Get ALL departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return;
    }

    if (!departments || departments.length === 0) {
      console.log('NO DEPARTMENTS FOUND IN DATABASE!');
      console.log('\nCreating Clinicals department...');

      // Create a Clinicals department
      const { data: newDept, error: createError } = await supabase
        .from('departments')
        .insert({
          name: 'Clinicals',
          department_code: 'MED-10',
          practice_id: '5da3896d-b9f3-4b0a-996a-3adca867cb30', // Default practice ID
          description: 'Clinical and Medical Department',
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating department:', createError);
      } else {
        console.log('✅ Created Clinicals department:', newDept.id);
      }
      return;
    }

    console.log(`Found ${departments.length} departments:\n`);
    departments.forEach(d => {
      console.log(`Department: ${d.name || d.department_name}`);
      console.log(`  ID: ${d.id}`);
      console.log(`  Code: ${d.department_code || 'none'}`);
      console.log(`  Practice ID: ${d.practice_id}`);
      console.log(`  Active: ${d.is_active}`);
      console.log('');
    });

    // Check for any department with "Clinical" in the name
    const clinicalDepts = departments.filter(d =>
      (d.name && d.name.toLowerCase().includes('clinical')) ||
      (d.department_name && d.department_name.toLowerCase().includes('clinical')) ||
      d.department_code === 'MED-10'
    );

    if (clinicalDepts.length > 0) {
      console.log('=================================');
      console.log('CLINICAL DEPARTMENTS FOUND:');
      console.log('=================================\n');
      clinicalDepts.forEach(d => {
        console.log(`✅ ${d.name || d.department_name} (${d.id})`);
      });
    } else {
      console.log('⚠️ NO CLINICAL DEPARTMENT FOUND!');
      console.log('Creating one now...');

      // Get first practice ID or use default
      const practiceId = departments[0]?.practice_id || '5da3896d-b9f3-4b0a-996a-3adca867cb30';

      const { data: newDept, error: createError } = await supabase
        .from('departments')
        .insert({
          name: 'Clinicals',
          department_code: 'MED-10',
          practice_id: practiceId,
          description: 'Clinical and Medical Department',
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating department:', createError);
      } else {
        console.log('✅ Created Clinicals department:', newDept.id);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkDepartments();