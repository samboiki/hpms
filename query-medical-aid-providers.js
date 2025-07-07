import pg from 'pg';
const { Client } = pg;

async function queryMedicalAidProviders() {
  const client = new Client({
    connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');
    
    const result = await client.query(`
      SELECT id, name, medical_aid_reference, logo_url 
      FROM medical_aid_providers 
      ORDER BY medical_aid_reference;
    `);
    
    console.log('\n📋 Medical Aid Providers:');
    console.log('========================');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`Medical Aid Reference: ${row.medical_aid_reference}`);
      console.log(`Logo URL: ${row.logo_url || 'NULL'}`);
      console.log('---');
    });
    
    console.log(`\nTotal providers found: ${result.rows.length}`);
    
    // Show the available logo files
    console.log('\n🖼️  Available logo files in /public/medical aids/:');
    console.log('- MAG1.png');
    console.log('- NAMM.png');
    console.log('- NHPM.png');
    console.log('- NMC1.png');
    console.log('- PROS.png');
    
    console.log('\n🔍 Matching Analysis:');
    console.log('====================');
    const logoFiles = ['MAG1', 'NAMM', 'NHPM', 'NMC1', 'PROS'];
    result.rows.forEach(row => {
      const ref = row.medical_aid_reference;
      const hasMatchingLogo = logoFiles.includes(ref);
      console.log(`${ref} -> ${hasMatchingLogo ? '✅' : '❌'} ${hasMatchingLogo ? 'HAS' : 'MISSING'} logo file`);
    });
    
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

queryMedicalAidProviders();