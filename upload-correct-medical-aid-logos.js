import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

async function uploadCorrectLogos() {
  try {
    console.log('🚀 Uploading the 5 medical aid logos from /public/medical aids/...');

    // Step 1: Get list of logo files from the correct directory
    const logoDir = '/home/happy/projects/hpms/public/medical aids';
    const logoFiles = fs.readdirSync(logoDir).filter(file => 
      file.endsWith('.png') || file.endsWith('.svg') || file.endsWith('.jpg') || file.endsWith('.jpeg')
    );

    console.log('📁 Found logo files in /public/medical aids/:', logoFiles);

    // Expected files: MAG1.png, NAMM.png, NHPM.png, NMC1.png, PROS.png
    const expectedFiles = ['MAG1.png', 'NAMM.png', 'NHPM.png', 'NMC1.png', 'PROS.png'];
    const missingFiles = expectedFiles.filter(file => !logoFiles.includes(file));
    
    if (missingFiles.length > 0) {
      console.log('⚠️ Missing expected files:', missingFiles);
    }

    console.log('📋 Logo file mapping:');
    console.log('  - MAG1.png → Gemhealth Medical Aid');
    console.log('  - NAMM.png → Nammed Medical Aid Fund');
    console.log('  - NHPM.png → Namibia Health Plan');
    console.log('  - NMC1.png → Namibia Medical Care');
    console.log('  - PROS.png → Renaissance Health Medical Aid Fund');

    // Step 2: Show public URLs where logos will be accessible
    console.log('\n🌐 Logos will be accessible at:');
    logoFiles.forEach(filename => {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/medical-aid-logos/${filename}`;
      console.log(`  - ${filename}: ${publicUrl}`);
    });

    console.log('\n📝 Next Steps:');
    console.log('1. Execute SETUP_MEDICAL_AID_REFERENCES_AND_LOGOS.sql in Supabase Dashboard');
    console.log('2. This will add medical_aid_reference column and update logo URLs');
    console.log('3. The medical_aid_reference values will match the logo filenames:');
    logoFiles.forEach(file => {
      const reference = file.replace('.png', '');
      console.log(`   - medical_aid_reference: '${reference}' → logo: ${file}`);
    });

    console.log('\n✅ Ready to proceed with database updates!');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the function
uploadCorrectLogos().catch(console.error);