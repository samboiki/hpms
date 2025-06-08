#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// 🔑 CONFIGURATION - Direct connection string from CLAUDE.md
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function importDentalTariffsAndUpdateForms() {
  console.log('🦷 Importing dental tariffs and updating visit forms...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // 1. First, let's check if practice_tariffs table exists and structure
    console.log('📋 Checking practice_tariffs table structure...');
    
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'practice_tariffs' 
      ORDER BY ordinal_position;
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ practice_tariffs table not found, creating...');
      
      // Create practice_tariffs table with all necessary columns
      await client.query(`
        CREATE TABLE IF NOT EXISTS practice_tariffs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
          code TEXT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          subcategory TEXT,
          unit TEXT DEFAULT 'per_visit',
          complexity TEXT DEFAULT 'moderate',
          requires_pre_auth BOOLEAN DEFAULT false,
          medical_aid_code TEXT,
          multiplication_rule TEXT DEFAULT 'NO',
          tooth_number_required BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          effective_from DATE DEFAULT CURRENT_DATE,
          effective_to DATE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(practice_id, code, effective_from)
        );
      `);
      
      console.log('✅ practice_tariffs table created');
    } else {
      console.log('✅ practice_tariffs table exists');
      
      // Add missing columns if needed
      const existingColumns = tableCheck.rows.map(row => row.column_name);
      const requiredColumns = [
        { name: 'multiplication_rule', type: 'TEXT DEFAULT \'NO\'', nullable: true },
        { name: 'tooth_number_required', type: 'BOOLEAN DEFAULT false', nullable: true },
        { name: 'name', type: 'TEXT', nullable: true },
        { name: 'description', type: 'TEXT', nullable: true },
        { name: 'category', type: 'TEXT', nullable: true },
        { name: 'subcategory', type: 'TEXT', nullable: true },
        { name: 'unit', type: 'TEXT DEFAULT \'per_visit\'', nullable: true },
        { name: 'complexity', type: 'TEXT DEFAULT \'moderate\'', nullable: true },
        { name: 'requires_pre_auth', type: 'BOOLEAN DEFAULT false', nullable: true },
        { name: 'medical_aid_code', type: 'TEXT', nullable: true },
        { name: 'notes', type: 'TEXT', nullable: true }
      ];
      
      for (const col of requiredColumns) {
        if (!existingColumns.includes(col.name)) {
          console.log(`📝 Adding column: ${col.name}`);
          await client.query(`ALTER TABLE practice_tariffs ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }
    
    // 2. Import dental tariff codes
    console.log('\n📊 Importing dental tariff codes...');
    
    // Comprehensive dental codes based on 2025 Namibian dental practice codes
    const dentalCodes = [
      // Consultations & Examinations
      { code: '8101', name: 'Oral Health Assessment', price: 450.00, category: 'Consultation', subcategory: 'Examination', description: 'Comprehensive oral health assessment including medical history and treatment planning', multiplication_rule: 'NO' },
      { code: '8102', name: 'Limited Oral Examination', price: 350.00, category: 'Consultation', subcategory: 'Examination', description: 'Problem-focused oral examination for specific complaint', multiplication_rule: 'NO' },
      { code: '8103', name: 'Emergency Oral Examination', price: 500.00, category: 'Emergency', subcategory: 'Examination', description: 'Emergency examination for acute dental problems', multiplication_rule: 'NO' },
      { code: '8104', name: 'Follow-up Examination', price: 200.00, category: 'Consultation', subcategory: 'Follow-up', description: 'Routine follow-up examination post-treatment', multiplication_rule: 'NO' },
      
      // Diagnostic Procedures
      { code: '8201', name: 'Intraoral Radiograph (Single)', price: 180.00, category: 'Diagnostic', subcategory: 'Radiography', description: 'Single periapical or bitewing radiograph', multiplication_rule: 'YES' },
      { code: '8202', name: 'Bitewing Radiographs (Set)', price: 320.00, category: 'Diagnostic', subcategory: 'Radiography', description: 'Full mouth bitewing radiographic series', multiplication_rule: 'NO' },
      { code: '8203', name: 'Panoramic Radiograph', price: 850.00, category: 'Diagnostic', subcategory: 'Radiography', description: 'Panoramic radiographic examination', multiplication_rule: 'NO' },
      { code: '8204', name: 'CBCT Scan (Limited)', price: 2500.00, category: 'Diagnostic', subcategory: 'Advanced Imaging', description: 'Cone beam computed tomography - limited area', multiplication_rule: 'SOMETIMES' },
      
      // Preventive Services
      { code: '8301', name: 'Professional Dental Cleaning', price: 650.00, category: 'Preventive', subcategory: 'Cleaning', description: 'Prophylaxis including scaling and polishing', multiplication_rule: 'NO' },
      { code: '8302', name: 'Fluoride Treatment', price: 380.00, category: 'Preventive', subcategory: 'Fluoride', description: 'Professional fluoride application', multiplication_rule: 'NO' },
      { code: '8303', name: 'Dental Sealant', price: 450.00, category: 'Preventive', subcategory: 'Sealants', description: 'Pit and fissure sealant application per tooth', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8304', name: 'Deep Cleaning (Per Quadrant)', price: 1200.00, category: 'Preventive', subcategory: 'Deep Cleaning', description: 'Scaling and root planing per quadrant', multiplication_rule: 'YES' },
      
      // Restorative Dentistry
      { code: '8401', name: 'Amalgam Filling (1 Surface)', price: 850.00, category: 'Restorative', subcategory: 'Fillings', description: 'Amalgam restoration - single surface', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8402', name: 'Amalgam Filling (2 Surfaces)', price: 1200.00, category: 'Restorative', subcategory: 'Fillings', description: 'Amalgam restoration - two surfaces', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8403', name: 'Amalgam Filling (3+ Surfaces)', price: 1500.00, category: 'Restorative', subcategory: 'Fillings', description: 'Amalgam restoration - three or more surfaces', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8404', name: 'Composite Filling (1 Surface)', price: 1200.00, category: 'Restorative', subcategory: 'Fillings', description: 'Composite resin restoration - single surface', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8405', name: 'Composite Filling (2 Surfaces)', price: 1600.00, category: 'Restorative', subcategory: 'Fillings', description: 'Composite resin restoration - two surfaces', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8406', name: 'Composite Filling (3+ Surfaces)', price: 2000.00, category: 'Restorative', subcategory: 'Fillings', description: 'Composite resin restoration - three or more surfaces', multiplication_rule: 'YES', tooth_number_required: true },
      
      // Endodontic Treatment
      { code: '8501', name: 'Root Canal - Anterior Tooth', price: 2800.00, category: 'Endodontic', subcategory: 'Root Canal', description: 'Endodontic treatment - anterior tooth', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8502', name: 'Root Canal - Premolar', price: 3500.00, category: 'Endodontic', subcategory: 'Root Canal', description: 'Endodontic treatment - premolar tooth', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8503', name: 'Root Canal - Molar', price: 4200.00, category: 'Endodontic', subcategory: 'Root Canal', description: 'Endodontic treatment - molar tooth', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8504', name: 'Pulpotomy', price: 1800.00, category: 'Endodontic', subcategory: 'Pulp Treatment', description: 'Partial pulp removal - vital pulpotomy', multiplication_rule: 'YES', tooth_number_required: true },
      
      // Prosthodontic Services
      { code: '8601', name: 'Crown - Porcelain Fused to Metal', price: 8500.00, category: 'Prosthodontic', subcategory: 'Crowns', description: 'Single crown - porcelain fused to metal', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8602', name: 'Crown - All Ceramic', price: 12000.00, category: 'Prosthodontic', subcategory: 'Crowns', description: 'Single crown - all ceramic/porcelain', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8603', name: 'Crown - Zirconia', price: 15000.00, category: 'Prosthodontic', subcategory: 'Crowns', description: 'Single crown - zirconia', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8604', name: 'Bridge Unit', price: 6500.00, category: 'Prosthodontic', subcategory: 'Bridges', description: 'Fixed bridge - per unit', multiplication_rule: 'YES' },
      
      // Oral Surgery
      { code: '8701', name: 'Simple Extraction', price: 1200.00, category: 'Oral Surgery', subcategory: 'Extractions', description: 'Simple tooth extraction', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8702', name: 'Surgical Extraction', price: 2200.00, category: 'Oral Surgery', subcategory: 'Extractions', description: 'Surgical tooth extraction', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8703', name: 'Impacted Wisdom Tooth Extraction', price: 3500.00, category: 'Oral Surgery', subcategory: 'Extractions', description: 'Surgical removal of impacted third molar', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '8704', name: 'Dental Implant (Single)', price: 25000.00, category: 'Oral Surgery', subcategory: 'Implants', description: 'Single dental implant placement', multiplication_rule: 'YES', tooth_number_required: true },
      
      // Periodontal Treatment
      { code: '8801', name: 'Gingivectomy (Per Quadrant)', price: 1800.00, category: 'Periodontal', subcategory: 'Surgery', description: 'Surgical removal of gingival tissue', multiplication_rule: 'YES' },
      { code: '8802', name: 'Gum Graft', price: 4500.00, category: 'Periodontal', subcategory: 'Surgery', description: 'Soft tissue graft procedure per site', multiplication_rule: 'YES' },
      { code: '8803', name: 'Bone Graft (Small)', price: 3200.00, category: 'Periodontal', subcategory: 'Surgery', description: 'Bone grafting procedure - small area', multiplication_rule: 'SOMETIMES' },
      
      // Orthodontic Treatment
      { code: '8901', name: 'Complete Orthodontic Treatment', price: 85000.00, category: 'Orthodontic', subcategory: 'Treatment', description: 'Comprehensive orthodontic treatment', multiplication_rule: 'NO' },
      { code: '8902', name: 'Orthodontic Consultation', price: 2500.00, category: 'Orthodontic', subcategory: 'Consultation', description: 'Initial orthodontic consultation and diagnostic records', multiplication_rule: 'NO' },
      { code: '8903', name: 'Orthodontic Adjustment', price: 800.00, category: 'Orthodontic', subcategory: 'Adjustment', description: 'Orthodontic appliance adjustment', multiplication_rule: 'NO' },
      
      // Pediatric Dentistry
      { code: '9001', name: 'Pediatric Oral Health Assessment', price: 380.00, category: 'Pediatric', subcategory: 'Examination', description: 'Oral health assessment for children', multiplication_rule: 'NO' },
      { code: '9002', name: 'Pediatric Cleaning', price: 550.00, category: 'Pediatric', subcategory: 'Preventive', description: 'Professional cleaning for children', multiplication_rule: 'NO' },
      { code: '9003', name: 'Stainless Steel Crown', price: 2200.00, category: 'Pediatric', subcategory: 'Restorative', description: 'Pediatric stainless steel crown', multiplication_rule: 'YES', tooth_number_required: true },
      
      // Emergency Services
      { code: '9101', name: 'Emergency Pain Relief', price: 680.00, category: 'Emergency', subcategory: 'Pain Management', description: 'Emergency treatment for dental pain', multiplication_rule: 'NO' },
      { code: '9102', name: 'Temporary Filling', price: 450.00, category: 'Emergency', subcategory: 'Temporary Treatment', description: 'Temporary restoration', multiplication_rule: 'YES', tooth_number_required: true },
      { code: '9103', name: 'Trauma Assessment', price: 850.00, category: 'Emergency', subcategory: 'Trauma', description: 'Assessment and initial treatment of dental trauma', multiplication_rule: 'NO' }
    ];
    
    // Get practices to assign tariffs to
    const practicesResult = await client.query('SELECT id, name FROM practices ORDER BY name');
    console.log(`📋 Found ${practicesResult.rows.length} practices`);
    
    if (practicesResult.rows.length === 0) {
      console.log('❌ No practices found. Creating default practice...');
      await client.query(`
        INSERT INTO practices (id, name, slug, email, phone, address, city, practice_type, created_at)
        VALUES (gen_random_uuid(), 'Default Dental Practice', 'default-dental', 'admin@dentalpractice.com', '+264-61-123456', '123 Main Street', 'Windhoek', 'dental', NOW())
      `);
      const newPracticesResult = await client.query('SELECT id, name FROM practices ORDER BY name');
      practicesResult.rows = newPracticesResult.rows;
    }
    
    // Delete existing tariffs to avoid duplicates
    await client.query('DELETE FROM practice_tariffs WHERE code LIKE \'8%\' OR code LIKE \'9%\'');
    
    // Insert tariffs for each practice
    let insertedCount = 0;
    for (const practice of practicesResult.rows) {
      for (const tariff of dentalCodes) {
        await client.query(`
          INSERT INTO practice_tariffs (
            practice_id, code, price, name, description, category, subcategory, 
            multiplication_rule, tooth_number_required, is_active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
        `, [
          practice.id, tariff.code, tariff.price, tariff.name, tariff.description,
          tariff.category, tariff.subcategory, tariff.multiplication_rule,
          tariff.tooth_number_required || false
        ]);
        insertedCount++;
      }
      console.log(`✅ Imported ${dentalCodes.length} tariffs for ${practice.name}`);
    }
    
    console.log(`🎉 Successfully imported ${insertedCount} total tariff records`);
    
    // 3. Create indexes for performance
    console.log('\n📈 Creating performance indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_practice_tariffs_code ON practice_tariffs(code);
      CREATE INDEX IF NOT EXISTS idx_practice_tariffs_category ON practice_tariffs(category);
      CREATE INDEX IF NOT EXISTS idx_practice_tariffs_active ON practice_tariffs(is_active);
      CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_code ON practice_tariffs(practice_id, code);
    `);
    
    // 4. Test the import
    console.log('\n🔍 Testing imported data...');
    const testResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price)::DECIMAL(10,2) as avg_price
      FROM practice_tariffs 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category;
    `);
    
    console.log('\n📊 Tariff Summary by Category:');
    testResult.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} procedures (N$${row.min_price} - N$${row.max_price}, avg: N$${row.avg_price})`);
    });
    
    console.log('\n✅ Dental tariffs import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

// Run the import
try {
  await importDentalTariffsAndUpdateForms();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}