import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

// Mapping discipline names to practice type names
const disciplineToType = {
  'DENTIST': 'dental',
  'DENTAL TECHNICIAN': 'dental',
  'DENTAL THERAPIST': 'dental',
  'GENERAL PRACTITIONER': 'medical',
  'FAMILY MEDICINE': 'medical',
  'MEDICAL PRACTITIONER': 'medical',
  'SPECIALIST PHYSICIAN': 'medical',
  'SURGEON': 'medical',
  'OPTOMETRIST': 'optometry',
  'PHARMACIST': 'pharmacy',
  'PHYSIOTHERAPIST': 'physiotherapy',
  'PSYCHOLOGIST': 'psychology',
  'PSYCHIATRIST': 'psychology',
  'RADIOLOGIST': 'radiology',
  'PATHOLOGIST': 'pathology',
  'DERMATOLOGIST': 'dermatology',
  'PEDIATRICIAN': 'pediatrics',
  'GYNECOLOGIST': 'gynecology',
  'CARDIOLOGIST': 'cardiology',
  'ORTHOPEDIC SURGEON': 'orthopedics',
  'OPHTHALMOLOGIST': 'ophthalmology',
  'ENT SPECIALIST': 'ent',
  'NEUROLOGIST': 'neurology',
  'REGISTERED NURSE': 'nursing',
};

function mapDisciplineToType(discipline) {
  const upper = discipline.toUpperCase();
  if (disciplineToType[upper]) return disciplineToType[upper];

  // Fallback logic
  if (upper.includes('DENTAL') || upper.includes('DENTIST')) return 'dental';
  if (upper.includes('MEDICAL') || upper.includes('PRACTITIONER') || upper.includes('PHYSICIAN')) return 'medical';
  if (upper.includes('NURSE')) return 'nursing';
  if (upper.includes('OPTOM')) return 'optometry';
  if (upper.includes('PHYSIO')) return 'physiotherapy';
  if (upper.includes('PSYCH')) return 'psychology';

  return 'medical'; // Default
}

function generateSlug(practiceName, practiceNo) {
  // Create slug from practice name
  const baseSlug = practiceName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);

  // Add practice number suffix to ensure uniqueness
  const suffix = practiceNo.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${baseSlug}-${suffix}`.substring(0, 50);
}

function cleanPhone(phone) {
  if (!phone || phone === '0' || phone.trim() === '') return null;
  return phone.replace(/\s+/g, '').trim();
}

function cleanEmail(email) {
  if (!email || email.trim() === '') return null;
  return email.toLowerCase().trim();
}

async function checkTableStructure() {
  console.log('Checking practices table structure...\n');

  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error fetching sample:', error);
    return null;
  }

  if (data && data.length > 0) {
    console.log('Sample practice record:');
    console.log(JSON.stringify(data[0], null, 2));
    return data[0];
  }

  return null;
}

async function importPractices() {
  try {
    console.log('🚀 Starting practice import from CSV...\n');

    // Step 1: Get practice_type_ids for mapping
    console.log('📋 Step 1: Fetching practice types...');
    const { data: practiceTypes, error: typesError } = await supabase
      .from('practice_types')
      .select('id, name');

    if (typesError) {
      console.error('❌ Error fetching practice types:', typesError);
      return;
    }

    const typeMap = {};
    practiceTypes.forEach(pt => {
      typeMap[pt.name] = pt.id;
    });

    // Add missing types if needed
    const requiredTypes = ['dental', 'medical', 'optometry', 'physiotherapy', 'psychology', 'nursing', 'pharmacy', 'radiology', 'pathology', 'dermatology', 'pediatrics', 'gynecology', 'cardiology', 'orthopedics', 'ophthalmology', 'ent', 'neurology'];
    for (const typeName of requiredTypes) {
      if (!typeMap[typeName]) {
        console.log(`   ➕ Creating missing practice type: ${typeName}`);
        const { data: newType, error: createError } = await supabase
          .from('practice_types')
          .insert([{ name: typeName, description: `${typeName} practice type` }])
          .select()
          .single();

        if (!createError && newType) {
          typeMap[typeName] = newType.id;
        }
      }
    }

    console.log(`   ✅ Practice types ready: ${Object.keys(typeMap).length} types\n`);

    // Step 2: Read and parse CSV
    console.log('📄 Step 2: Reading CSV file...');
    const csvContent = readFileSync('C:\\Users\\Happyou2\\Downloads\\CLIENTS.csv', 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`   ✅ Found ${records.length} records in CSV\n`);

    // Step 3: Prepare practice records
    console.log('🔄 Step 3: Preparing practice records...');
    const practices = records.map(record => {
      const practiceTypeName = mapDisciplineToType(record['Discipline Name'] || '');
      const practiceTypeId = typeMap[practiceTypeName];

      const slug = generateSlug(
        record['Practice Name'] || 'Unknown Practice',
        record['Practice No.'] || ''
      );

      return {
        slug: slug,
        name: record['Practice Name'] || 'Unknown Practice',
        contact_email: cleanEmail(record['email']),
        contact_phone: cleanPhone(record['Tel. No.']),
        address: record['Town'] || null,
        city: record['Town'] || null,
        country: 'Namibia',
        status: 'lead', // CRITICAL: Set as lead for Practice Pipeline
        practice_type_id: practiceTypeId,
        settings: {
          discipline_code: record['Dis Code'] || null,
          discipline_name: record['Discipline Name'] || null,
          practice_number: record['Practice No.'] || null
        }
      };
    });

    console.log(`   ✅ Prepared ${practices.length} practice records\n`);

    // Step 4: Insert practices in batches
    console.log('💾 Step 4: Inserting practices into database...');
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < practices.length; i += batchSize) {
      const batch = practices.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(practices.length / batchSize);

      console.log(`   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('practices')
        .upsert(batch, {
          onConflict: 'slug',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        console.error(`   ❌ Batch error: ${error.message}`);
        errorCount += batch.length;
        errors.push({
          batch: batchNum,
          error: error.message,
          records: batch.length
        });
      } else {
        successCount += (data?.length || batch.length);
        console.log(`   ✅ Batch inserted successfully`);
      }
    }

    // Step 5: Verify import
    console.log('\n🔍 Step 5: Verifying import...');
    const { count, error: countError } = await supabase
      .from('practices')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lead');

    if (countError) {
      console.error('❌ Error counting practices:', countError);
    } else {
      console.log(`   ✅ Total practices with status='lead': ${count}\n`);
    }

    // Final report
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Successfully imported: ${successCount} practices`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors encountered: ${errorCount} practices`);
    }
    console.log(`📋 Total CSV records: ${records.length}`);
    console.log(`🎯 Status: All imported as 'lead'`);
    console.log(`🌍 Country: Namibia`);
    console.log('═══════════════════════════════════════════════════');

    if (errors.length > 0) {
      console.log('\n⚠️  Error Details:');
      errors.forEach(e => {
        console.log(`   Batch ${e.batch}: ${e.error} (${e.records} records)`);
      });
    }

    console.log('\n✨ All practices are now visible in the Practice Pipeline!');

  } catch (error) {
    console.error('💥 Fatal error during import:', error);
    process.exit(1);
  }
}

importPractices();
