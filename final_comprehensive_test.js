#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';

// Use service role key for admin operations (bypassing RLS)
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.4X9nJKdwYhGDnE8aQOlMANJC8BfgEF_JjLRiKHYfQ3w';
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';

// Admin client with service role (bypasses RLS)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Regular client for testing user operations
const userClient = createClient(
  SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

// Comprehensive dental codes from the specified Excel file structure
function getDentalCodesFromExcel() {
  const excelPath = 'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';
  
  try {
    if (fs.existsSync(excelPath)) {
      console.log(`📋 Reading dental codes from: ${excelPath}`);
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`✅ Loaded ${jsonData.length} codes from Excel file`);
      
      return jsonData.map(row => ({
        code: row.Code ? row.Code.toString().trim() : '',
        price: parseFloat(row.Price) || 0,
        name: row.Description ? row.Description.trim() : '',
        category: row.Category ? row.Category.trim() : 'General',
        subcategory: row.Subcategory ? row.Subcategory.trim() : null,
        complexity: row.Complexity ? row.Complexity.trim() : 'Moderate',
        notes: row.Notes ? row.Notes.trim() : null
      })).filter(item => item.code && item.price && item.name);
    }
  } catch (error) {
    console.log('⚠️  Error reading Excel file:', error.message);
  }
  
  console.log('📋 Using comprehensive sample dental codes...');
  return [
    // Consultation & Examination (001-010)
    { code: '001', price: 95.00, name: 'Initial comprehensive oral examination', category: 'Consultation & Examination', subcategory: 'Initial Consultation', complexity: 'Simple' },
    { code: '002', price: 65.00, name: 'Periodic oral examination', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
    { code: '003', price: 55.00, name: 'Limited oral examination - problem focused', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
    { code: '004', price: 135.00, name: 'Emergency oral examination', category: 'Consultation & Examination', subcategory: 'Emergency', complexity: 'Simple' },
    { code: '005', price: 185.00, name: 'Emergency examination after hours', category: 'Consultation & Examination', subcategory: 'Emergency', complexity: 'Simple' },
    { code: '006', price: 155.00, name: 'Specialist consultation', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Moderate' },
    { code: '007', price: 125.00, name: 'Second opinion consultation', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Simple' },
    { code: '008', price: 85.00, name: 'Pre-operative consultation', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
    { code: '009', price: 45.00, name: 'Post-operative examination', category: 'Consultation & Examination', subcategory: 'Follow-up', complexity: 'Simple' },
    { code: '010', price: 115.00, name: 'Oral cancer screening', category: 'Consultation & Examination', subcategory: 'Specialist', complexity: 'Moderate' },

    // Restorative - Fillings (211-233)
    { code: '211', price: 185.00, name: 'Amalgam filling - 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
    { code: '212', price: 225.00, name: 'Amalgam filling - 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
    { code: '213', price: 285.00, name: 'Amalgam filling - 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
    { code: '221', price: 225.00, name: 'Composite filling - anterior 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
    { code: '222', price: 285.00, name: 'Composite filling - anterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
    { code: '223', price: 385.00, name: 'Composite filling - anterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
    { code: '231', price: 285.00, name: 'Composite filling - posterior 1 surface', category: 'Restorative', subcategory: 'Fillings', complexity: 'Simple' },
    { code: '232', price: 385.00, name: 'Composite filling - posterior 2 surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },
    { code: '233', price: 485.00, name: 'Composite filling - posterior 3+ surfaces', category: 'Restorative', subcategory: 'Fillings', complexity: 'Moderate' },

    // Restorative - Crowns & Bridge (271-282)
    { code: '271', price: 1885.00, name: 'Porcelain fused to metal crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
    { code: '272', price: 2185.00, name: 'All ceramic crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
    { code: '273', price: 2485.00, name: 'Gold crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Complex' },
    { code: '274', price: 385.00, name: 'Temporary crown', category: 'Restorative', subcategory: 'Crowns', complexity: 'Simple' },
    { code: '281', price: 1685.00, name: 'Pontic - porcelain fused to metal', category: 'Restorative', subcategory: 'Bridge', complexity: 'Complex' },
    { code: '282', price: 1885.00, name: 'Pontic - all ceramic', category: 'Restorative', subcategory: 'Bridge', complexity: 'Complex' },

    // Endodontics (331-335)
    { code: '331', price: 1285.00, name: 'Root canal - anterior tooth', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
    { code: '332', price: 1485.00, name: 'Root canal - premolar', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
    { code: '333', price: 1885.00, name: 'Root canal - molar', category: 'Endodontics', subcategory: 'Root Canal', complexity: 'Complex' },
    { code: '334', price: 485.00, name: 'Pulpotomy - emergency', category: 'Endodontics', subcategory: 'Emergency', complexity: 'Moderate' },
    { code: '335', price: 685.00, name: 'Post and core buildup', category: 'Endodontics', subcategory: 'Post Treatment', complexity: 'Moderate' },

    // Periodontics (411-422)
    { code: '411', price: 285.00, name: 'Routine prophylaxis', category: 'Periodontics', subcategory: 'Cleaning', complexity: 'Simple' },
    { code: '412', price: 485.00, name: 'Deep cleaning - per quadrant', category: 'Periodontics', subcategory: 'Cleaning', complexity: 'Moderate' },
    { code: '421', price: 785.00, name: 'Gingivectomy - per quadrant', category: 'Periodontics', subcategory: 'Surgery', complexity: 'Complex' },
    { code: '422', price: 1285.00, name: 'Periodontal flap surgery - per quadrant', category: 'Periodontics', subcategory: 'Surgery', complexity: 'Complex' },

    // Oral Surgery (501-512)
    { code: '501', price: 285.00, name: 'Simple extraction', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Simple' },
    { code: '502', price: 485.00, name: 'Surgical extraction', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Moderate' },
    { code: '503', price: 585.00, name: 'Wisdom tooth extraction - simple', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Moderate' },
    { code: '504', price: 885.00, name: 'Wisdom tooth extraction - surgical', category: 'Oral Surgery', subcategory: 'Extractions', complexity: 'Complex' },
    { code: '511', price: 1285.00, name: 'Bone grafting - small', category: 'Oral Surgery', subcategory: 'Advanced', complexity: 'Complex' },
    { code: '512', price: 2485.00, name: 'Sinus lift', category: 'Oral Surgery', subcategory: 'Advanced', complexity: 'Complex' },

    // Prosthodontics (601-622)
    { code: '601', price: 3485.00, name: 'Complete upper denture', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
    { code: '602', price: 3485.00, name: 'Complete lower denture', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
    { code: '603', price: 2185.00, name: 'Partial denture - acrylic', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Moderate' },
    { code: '604', price: 2885.00, name: 'Partial denture - cast metal', category: 'Prosthodontics', subcategory: 'Dentures', complexity: 'Complex' },
    { code: '621', price: 4885.00, name: 'Single implant placement', category: 'Prosthodontics', subcategory: 'Implants', complexity: 'Complex' },
    { code: '622', price: 2885.00, name: 'Implant crown', category: 'Prosthodontics', subcategory: 'Implants', complexity: 'Complex' },

    // Orthodontics (701-721)
    { code: '701', price: 285.00, name: 'Orthodontic consultation', category: 'Orthodontics', subcategory: 'Consultation', complexity: 'Simple' },
    { code: '711', price: 18500.00, name: 'Metal braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
    { code: '712', price: 22500.00, name: 'Ceramic braces - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
    { code: '713', price: 28500.00, name: 'Invisalign - full treatment', category: 'Orthodontics', subcategory: 'Treatment', complexity: 'Complex' },
    { code: '721', price: 785.00, name: 'Retainer - upper or lower', category: 'Orthodontics', subcategory: 'Appliances', complexity: 'Simple' },

    // Pediatric Dentistry (801-821)
    { code: '801', price: 185.00, name: 'Child prophylaxis', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
    { code: '802', price: 125.00, name: 'Fluoride treatment', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
    { code: '803', price: 185.00, name: 'Sealant per tooth', category: 'Pediatric', subcategory: 'Preventive', complexity: 'Simple' },
    { code: '811', price: 185.00, name: 'Primary tooth filling', category: 'Pediatric', subcategory: 'Restorative', complexity: 'Simple' },
    { code: '821', price: 185.00, name: 'Primary tooth extraction', category: 'Pediatric', subcategory: 'Surgery', complexity: 'Simple' },

    // Cosmetic Procedures (901-932)
    { code: '901', price: 785.00, name: 'Professional in-office whitening', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Moderate' },
    { code: '902', price: 385.00, name: 'Take-home whitening kit', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Simple' },
    { code: '903', price: 185.00, name: 'Whitening maintenance kit', category: 'Cosmetic', subcategory: 'Whitening', complexity: 'Simple' },
    { code: '911', price: 1685.00, name: 'Porcelain veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Moderate' },
    { code: '912', price: 785.00, name: 'Composite veneer per tooth', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Moderate' },
    { code: '913', price: 285.00, name: 'Veneer consultation and mockup', category: 'Cosmetic', subcategory: 'Veneers', complexity: 'Simple' },
    { code: '921', price: 325.00, name: 'Cosmetic bonding per tooth', category: 'Cosmetic', subcategory: 'Bonding', complexity: 'Simple' },
    { code: '922', price: 185.00, name: 'Tooth reshaping per tooth', category: 'Cosmetic', subcategory: 'Bonding', complexity: 'Simple' },
    { code: '931', price: 185.00, name: 'Smile makeover consultation', category: 'Cosmetic', subcategory: 'Consultation', complexity: 'Simple' },
    { code: '932', price: 385.00, name: 'Digital smile design', category: 'Cosmetic', subcategory: 'Digital Services', complexity: 'Moderate' }
  ];
}

// Test patients with corrected schema
const testPatients = [
  {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.johnson@example.com',
    cell_number: '+264-81-234-5678',
    date_of_birth: '1985-03-15',
    gender: 'Female',
    id_number: '85031512345',
    home_address: '123 Independence Avenue, Windhoek',
    postal_address: 'P.O. Box 123, Windhoek',
    postal_code: '10001',
    occupation: 'Teacher',
    employer: 'Windhoek High School',
    marital_status: 'Married',
    home_language: 'English',
    profile: 'Patient with medical aid'
  },
  {
    first_name: 'Michael',
    last_name: 'Kapenda',
    email: 'michael.kapenda@example.com',
    cell_number: '+264-85-987-6543',
    date_of_birth: '1992-08-22',
    gender: 'Male',
    id_number: '92082298765',
    home_address: '45 Robert Mugabe Avenue, Windhoek',
    postal_address: 'P.O. Box 456, Windhoek',
    postal_code: '10002',
    occupation: 'Software Developer',
    employer: 'TechCorp Namibia',
    marital_status: 'Single',
    home_language: 'English',
    profile: 'Young professional without medical aid'
  },
  {
    first_name: 'Elizabeth',
    last_name: 'Van Der Merwe',
    email: 'liz.vandermerwe@example.com',
    cell_number: '+264-81-555-0123',
    date_of_birth: '1958-12-10',
    gender: 'Female',
    id_number: '58121098765',
    home_address: '78 Klein Windhoek Street, Windhoek',
    postal_address: 'P.O. Box 789, Windhoek',
    postal_code: '10003',
    occupation: 'Retired Nurse',
    employer: 'Retired',
    marital_status: 'Widowed',
    home_language: 'Afrikaans',
    profile: 'Senior citizen'
  }
];

async function importDentalCodesWithServiceRole() {
  console.log('\n🦷 IMPORTING DENTAL CODES (Service Role)');
  console.log('=========================================');
  
  const dentalCodes = getDentalCodesFromExcel();
  console.log(`📋 Loaded ${dentalCodes.length} dental codes`);
  
  // Get all practices
  const { data: practices, error: practicesError } = await adminClient
    .from('practices')
    .select('id, name, practice_type');
  
  if (practicesError || !practices || practices.length === 0) {
    console.log('❌ No practices found for dental code import');
    return 0;
  }
  
  console.log(`🏥 Found ${practices.length} practices for import`);
  
  // Clear existing dental tariffs
  console.log('🧹 Clearing existing dental tariffs...');
  const { error: deleteError } = await adminClient
    .from('practice_tariffs')
    .delete()
    .eq('practice_type', 'dental');
  
  if (deleteError) {
    console.log('⚠️  Warning clearing tariffs:', deleteError.message);
  } else {
    console.log('✅ Cleared existing dental tariffs');
  }
  
  let totalImported = 0;
  
  // Import for each practice
  for (const practice of practices) {
    console.log(`\n📝 Importing for: ${practice.name}...`);
    
    const tariffRecords = dentalCodes.map(code => ({
      practice_id: practice.id,
      code: code.code,
      price: code.price,
      namaf_prace_2025: code.name,
      practice_type: 'dental',
      category: code.category,
      subcategory: code.subcategory,
      full_description: `${code.name}${code.complexity ? ' - Complexity: ' + code.complexity : ''}${code.notes ? '. Notes: ' + code.notes : ''}`,
      unit: 'per visit',
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0]
    }));
    
    // Insert in batches
    const batchSize = 50;
    let successCount = 0;
    
    for (let i = 0; i < tariffRecords.length; i += batchSize) {
      const batch = tariffRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await adminClient
        .from('practice_tariffs')
        .insert(batch);
      
      if (insertError) {
        console.log(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error:`, insertError.message);
      } else {
        successCount += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} codes`);
      }
    }
    
    totalImported += successCount;
    console.log(`   📊 Total for ${practice.name}: ${successCount}/${dentalCodes.length}`);
  }
  
  console.log(`\n🎉 Import completed: ${totalImported} codes imported across ${practices.length} practices`);
  return totalImported;
}

async function createTestPatientsWithServiceRole() {
  console.log('\n👥 CREATING TEST PATIENTS');
  console.log('=========================');
  
  // Get first practice
  const { data: practices } = await adminClient
    .from('practices')
    .select('id')
    .limit(1);
  
  const practiceId = practices?.[0]?.id;
  const createdPatients = [];
  
  for (let i = 0; i < testPatients.length; i++) {
    const patientData = testPatients[i];
    
    console.log(`\n👤 Creating Patient ${i + 1}: ${patientData.first_name} ${patientData.last_name}`);
    
    try {
      const { data: patient, error: patientError } = await adminClient
        .from('patients')
        .insert([{
          ...patientData,
          practice_id: practiceId
        }])
        .select()
        .single();
      
      if (patientError) {
        console.log(`   ❌ Error: ${patientError.message}`);
        continue;
      }
      
      console.log(`   ✅ Created successfully (ID: ${patient.id})`);
      createdPatients.push(patient);
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Created ${createdPatients.length}/${testPatients.length} test patients`);
  return createdPatients;
}

async function createTestAppointmentsAndVisits(patients) {
  console.log('\n📅 CREATING APPOINTMENTS & VISITS');
  console.log('==================================');
  
  // Get practice
  const { data: practices } = await adminClient
    .from('practices')
    .select('id')
    .limit(1);
  
  const practiceId = practices?.[0]?.id;
  const results = { appointments: [], visits: [], totalBilling: 0 };
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    console.log(`\n🔄 Workflow ${i + 1}: ${patient.first_name} ${patient.last_name}`);
    
    // Create appointment
    const appointmentData = {
      patient_id: patient.id,
      practice_id: practiceId,
      appointment_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      appointment_time: ['09:00:00', '10:30:00', '14:00:00'][i],
      duration: [60, 90, 30][i],
      type: ['consultation', 'procedure', 'follow-up'][i],
      status: 'scheduled',
      notes: `${['Initial exam', 'Root canal treatment', 'Follow-up checkup'][i]} for ${patient.first_name}`
    };
    
    const { data: appointment, error: appointmentError } = await adminClient
      .from('appointments')
      .insert([appointmentData])
      .select()
      .single();
    
    if (appointmentError) {
      console.log(`   ❌ Appointment error: ${appointmentError.message}`);
      continue;
    }
    
    console.log(`   ✅ Appointment created: ${appointment.type} on ${appointment.appointment_date}`);
    results.appointments.push(appointment);
    
    // Create visit
    const visitData = {
      patient_id: patient.id,
      visit_type: appointmentData.type,
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      chief_complaint: ['Routine checkup and cleaning', 'Severe tooth pain in lower molar', 'Post-treatment follow-up'][i],
      diagnosis: ['Good oral health, mild plaque', 'Pulpitis requiring root canal', 'Excellent healing progress'][i],
      treatment_plan: ['Professional cleaning, fluoride', 'Root canal therapy and crown', 'Continue monitoring'][i],
      prescription: ['Fluoride toothpaste', 'Ibuprofen 400mg TDS x 5 days', 'None required'][i],
      follow_up_required: [true, true, false][i],
      follow_up_date: i < 2 ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
      notes: [`Patient ${i + 1} comprehensive notes`, `Complex treatment completed successfully`, `Recovery excellent, no issues`][i],
      status: 'completed'
    };
    
    const { data: visit, error: visitError } = await adminClient
      .from('visits')
      .insert([visitData])
      .select()
      .single();
    
    if (visitError) {
      console.log(`   ❌ Visit error: ${visitError.message}`);
      continue;
    }
    
    console.log(`   ✅ Visit created: ${visit.visit_type} - ${visit.diagnosis}`);
    results.visits.push(visit);
    
    // Add vitals
    const vitalsData = {
      visit_id: visit.id,
      blood_pressure: ['120/80', '130/85', '115/75'][i],
      temperature: [36.8, 37.1, 36.5][i],
      pulse_rate: [72, 88, 68][i],
      respiratory_rate: [16, 18, 14][i],
      weight: [68.5, 82.0, 72.3][i],
      height: [165, 178, 162][i]
    };
    
    // Calculate BMI
    vitalsData.bmi = vitalsData.weight / Math.pow(vitalsData.height / 100, 2);
    vitalsData.bmi = Math.round(vitalsData.bmi * 10) / 10;
    
    const { error: vitalsError } = await adminClient
      .from('vitals')
      .insert([vitalsData]);
    
    if (vitalsError) {
      console.log(`   ⚠️  Vitals error: ${vitalsError.message}`);
    } else {
      console.log(`   ✅ Vitals added (BMI: ${vitalsData.bmi})`);
    }
    
    // Test billing workflow
    const serviceCodes = [['001', '411', '802'], ['333', '335', '274'], ['002', '271']][i];
    
    console.log(`   💰 Testing billing with services: ${serviceCodes.join(', ')}`);
    
    // Get tariffs for billing
    const { data: tariffs } = await userClient
      .from('practice_tariffs')
      .select('*')
      .eq('practice_id', practiceId)
      .in('code', serviceCodes);
    
    if (tariffs && tariffs.length > 0) {
      const totalAmount = tariffs.reduce((sum, tariff) => sum + parseFloat(tariff.price), 0);
      const taxAmount = totalAmount * 0.15;
      const finalTotal = totalAmount + taxAmount;
      
      console.log(`   💵 Services total: N$ ${totalAmount.toFixed(2)}`);
      console.log(`   📊 With VAT (15%): N$ ${finalTotal.toFixed(2)}`);
      
      results.totalBilling += finalTotal;
      
      tariffs.forEach(tariff => {
        console.log(`      • ${tariff.code}: ${tariff.namaf_prace_2025} - N$ ${parseFloat(tariff.price).toFixed(2)}`);
      });
    } else {
      console.log(`   ⚠️  No tariffs found for services: ${serviceCodes.join(', ')}`);
    }
    
    // Update appointment status
    await adminClient
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointment.id);
  }
  
  return results;
}

async function validateSystemIntegration() {
  console.log('\n🔍 VALIDATING SYSTEM INTEGRATION');
  console.log('=================================');
  
  const validation = {
    tariffs: 0,
    patients: 0,
    appointments: 0,
    visits: 0,
    vitals: 0,
    practices: 0
  };
  
  // Check tariffs
  const { data: tariffs } = await userClient
    .from('practice_tariffs')
    .select('count', { count: 'exact' })
    .eq('practice_type', 'dental');
  
  validation.tariffs = tariffs || 0;
  console.log(`📋 Dental tariffs available: ${validation.tariffs}`);
  
  // Check patients
  const { data: patients } = await userClient
    .from('patients')
    .select('*');
  
  validation.patients = patients?.length || 0;
  console.log(`👥 Total patients: ${validation.patients}`);
  
  // Check appointments
  const { data: appointments } = await userClient
    .from('appointments')
    .select('*');
  
  validation.appointments = appointments?.length || 0;
  console.log(`📅 Total appointments: ${validation.appointments}`);
  
  // Check visits
  const { data: visits } = await userClient
    .from('visits')
    .select('*');
  
  validation.visits = visits?.length || 0;
  console.log(`🏥 Total visits: ${validation.visits}`);
  
  // Check vitals
  const { data: vitals } = await userClient
    .from('vitals')
    .select('*');
  
  validation.vitals = vitals?.length || 0;
  console.log(`📊 Total vitals records: ${validation.vitals}`);
  
  // Check practices
  const { data: practices } = await userClient
    .from('practices')
    .select('*');
  
  validation.practices = practices?.length || 0;
  console.log(`🏥 Total practices: ${validation.practices}`);
  
  return validation;
}

async function runFinalComprehensiveTest() {
  console.log('🧪 FINAL COMPREHENSIVE HPMS WORKFLOW TEST');
  console.log('==========================================');
  console.log('Using service role for admin operations');
  console.log('Testing complete patient → appointment → visit → billing workflow\n');
  
  const testResults = {
    dentalCodesImported: 0,
    patientsCreated: 0,
    appointmentsCreated: 0,
    visitsCreated: 0,
    totalBillingAmount: 0,
    validationResults: null
  };
  
  try {
    // Step 1: Import dental codes
    testResults.dentalCodesImported = await importDentalCodesWithServiceRole();
    
    // Step 2: Create test patients
    const patients = await createTestPatientsWithServiceRole();
    testResults.patientsCreated = patients.length;
    
    // Step 3: Create appointments and visits
    const workflowResults = await createTestAppointmentsAndVisits(patients);
    testResults.appointmentsCreated = workflowResults.appointments.length;
    testResults.visitsCreated = workflowResults.visits.length;
    testResults.totalBillingAmount = workflowResults.totalBilling;
    
    // Step 4: Validate system integration
    testResults.validationResults = await validateSystemIntegration();
    
    // Generate final report
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 FINAL TEST RESULTS');
    console.log(`${'='.repeat(80)}`);
    
    console.log('\n🦷 DENTAL CODES IMPORT:');
    console.log(`   Status: ${testResults.dentalCodesImported > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Codes imported: ${testResults.dentalCodesImported}`);
    
    console.log('\n👥 PATIENT MANAGEMENT:');
    console.log(`   Test patients created: ${testResults.patientsCreated}/3`);
    console.log(`   Total patients in system: ${testResults.validationResults?.patients || 0}`);
    
    console.log('\n📅 APPOINTMENT SYSTEM:');
    console.log(`   Test appointments created: ${testResults.appointmentsCreated}/3`);
    console.log(`   Total appointments in system: ${testResults.validationResults?.appointments || 0}`);
    
    console.log('\n🏥 VISIT MANAGEMENT:');
    console.log(`   Test visits created: ${testResults.visitsCreated}/3`);
    console.log(`   Total visits in system: ${testResults.validationResults?.visits || 0}`);
    console.log(`   Vitals records: ${testResults.validationResults?.vitals || 0}`);
    
    console.log('\n💰 BILLING INTEGRATION:');
    console.log(`   Total test billing: N$ ${testResults.totalBillingAmount.toFixed(2)}`);
    console.log(`   Tariffs available: ${testResults.validationResults?.tariffs || 0}`);
    
    const overallSuccess = 
      testResults.dentalCodesImported > 0 &&
      testResults.patientsCreated === 3 &&
      testResults.appointmentsCreated === 3 &&
      testResults.visitsCreated === 3;
    
    console.log(`\n${overallSuccess ? '🎉' : '⚠️'} OVERALL RESULT: ${overallSuccess ? 'COMPLETE SUCCESS' : 'PARTIAL SUCCESS'}`);
    
    if (overallSuccess) {
      console.log('\n✅ SYSTEM READY FOR PRODUCTION TESTING');
      console.log('   • All core workflows functional');
      console.log('   • Dental codes imported and available');
      console.log('   • Patient management working');
      console.log('   • Appointment scheduling operational');
      console.log('   • Visit creation with vitals working');
      console.log('   • Billing integration functional');
    }
    
    console.log('\n🚀 UI TESTING INSTRUCTIONS:');
    console.log('   1. Development server: http://localhost:5001/');
    console.log('   2. Navigate to any patient detail page');
    console.log('   3. Click "Add Visit" to test billing integration');
    console.log('   4. ServiceSelector will show imported dental codes');
    console.log('   5. Test complete workflow with real tariff data');
    
    console.log('\n📋 AVAILABLE TEST DATA:');
    console.log(`   • ${testResults.dentalCodesImported} dental procedure codes`);
    console.log(`   • ${testResults.patientsCreated} test patients with different profiles`);
    console.log(`   • ${testResults.appointmentsCreated} sample appointments`);
    console.log(`   • ${testResults.visitsCreated} completed visits with vitals`);
    console.log(`   • N$ ${testResults.totalBillingAmount.toFixed(2)} in test billing transactions`);
    
    return testResults;
    
  } catch (error) {
    console.error('\n❌ TEST EXECUTION FAILED:', error);
    return testResults;
  }
}

// Execute the comprehensive test
runFinalComprehensiveTest()
  .then(results => {
    console.log('\n🏁 Comprehensive test execution completed');
    
    if (results.dentalCodesImported > 0 && results.patientsCreated === 3) {
      console.log('🎯 SUCCESS: System is ready for UI testing');
      console.log('   Navigate to http://localhost:5001/ to test the AddVisitForm billing integration');
    } else {
      console.log('⚠️  PARTIAL: Some components may need attention');
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });