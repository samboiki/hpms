#!/usr/bin/env node

import pg from 'pg';

// 🔑 CONFIGURATION - Direct connection string from CLAUDE.md
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function executeSQL(sql) {
  console.log('🦷 Importing dental tariffs...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    console.log('📋 Executing dental tariffs import...');
    await client.query(sql);
    console.log('✅ Dental tariffs imported successfully!\n');
    
    // Test the import
    const testResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price)::DECIMAL(10,2) as avg_price
      FROM practice_tariffs 
      WHERE is_active = true AND (code LIKE '8%' OR code LIKE '9%')
      GROUP BY category
      ORDER BY category;
    `);
    
    console.log('📊 Tariff Summary by Category:');
    testResult.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} procedures (N$${row.min_price} - N$${row.max_price}, avg: N$${row.avg_price})`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

// Import dental tariffs
const dentalTariffsSQL = `
-- Import Dental Tariffs for HPMS Practice Management System
-- Based on 2025 Namibian Dental Practice Codes

-- First, ensure the practice_tariffs table has all necessary columns
ALTER TABLE practice_tariffs 
ADD COLUMN IF NOT EXISTS multiplication_rule TEXT DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS tooth_number_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'per_visit',
ADD COLUMN IF NOT EXISTS complexity TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS requires_pre_auth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS medical_aid_code TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Clear existing dental codes to avoid duplicates
DELETE FROM practice_tariffs WHERE code LIKE '8%' OR code LIKE '9%';

-- Insert comprehensive dental tariff codes for all practices
INSERT INTO practice_tariffs (
  practice_id, code, price, name, description, category, subcategory, 
  multiplication_rule, tooth_number_required, unit, complexity, is_active, created_at
) 
SELECT 
  p.id as practice_id,
  dental_codes.code,
  dental_codes.price,
  dental_codes.name,
  dental_codes.description,
  dental_codes.category,
  dental_codes.subcategory,
  dental_codes.multiplication_rule,
  dental_codes.tooth_number_required,
  dental_codes.unit,
  dental_codes.complexity,
  true as is_active,
  NOW() as created_at
FROM practices p
CROSS JOIN (
  VALUES
    -- Consultations & Examinations
    ('8101', 450.00, 'Oral Health Assessment', 'Comprehensive oral health assessment including medical history and treatment planning', 'Consultation', 'Examination', 'NO', false, 'per_visit', 'moderate'),
    ('8102', 350.00, 'Limited Oral Examination', 'Problem-focused oral examination for specific complaint', 'Consultation', 'Examination', 'NO', false, 'per_visit', 'simple'),
    ('8103', 500.00, 'Emergency Oral Examination', 'Emergency examination for acute dental problems', 'Emergency', 'Examination', 'NO', false, 'per_visit', 'moderate'),
    ('8104', 200.00, 'Follow-up Examination', 'Routine follow-up examination post-treatment', 'Consultation', 'Follow-up', 'NO', false, 'per_visit', 'simple'),
    
    -- Diagnostic Procedures
    ('8201', 180.00, 'Intraoral Radiograph (Single)', 'Single periapical or bitewing radiograph', 'Diagnostic', 'Radiography', 'YES', false, 'per_film', 'simple'),
    ('8202', 320.00, 'Bitewing Radiographs (Set)', 'Full mouth bitewing radiographic series', 'Diagnostic', 'Radiography', 'NO', false, 'per_set', 'moderate'),
    ('8203', 850.00, 'Panoramic Radiograph', 'Panoramic radiographic examination', 'Diagnostic', 'Radiography', 'NO', false, 'per_visit', 'moderate'),
    ('8204', 2500.00, 'CBCT Scan (Limited)', 'Cone beam computed tomography - limited area', 'Diagnostic', 'Advanced Imaging', 'SOMETIMES', false, 'per_scan', 'complex'),
    ('8205', 4200.00, 'CBCT Scan (Full Mouth)', 'Cone beam computed tomography - full mouth', 'Diagnostic', 'Advanced Imaging', 'NO', false, 'per_scan', 'complex'),
    
    -- Preventive Services
    ('8301', 650.00, 'Professional Dental Cleaning', 'Prophylaxis including scaling and polishing', 'Preventive', 'Cleaning', 'NO', false, 'per_visit', 'simple'),
    ('8302', 380.00, 'Fluoride Treatment', 'Professional fluoride application', 'Preventive', 'Fluoride', 'NO', false, 'per_treatment', 'simple'),
    ('8303', 450.00, 'Dental Sealant', 'Pit and fissure sealant application per tooth', 'Preventive', 'Sealants', 'YES', true, 'per_tooth', 'simple'),
    ('8304', 1200.00, 'Deep Cleaning (Per Quadrant)', 'Scaling and root planing per quadrant', 'Preventive', 'Deep Cleaning', 'YES', false, 'per_quadrant', 'moderate'),
    ('8305', 580.00, 'Oral Hygiene Instruction', 'Comprehensive oral hygiene education and instruction', 'Preventive', 'Education', 'NO', false, 'per_visit', 'simple'),
    
    -- Restorative Dentistry - Amalgam Fillings
    ('8401', 850.00, 'Amalgam Filling (1 Surface)', 'Amalgam restoration - single surface', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'simple'),
    ('8402', 1200.00, 'Amalgam Filling (2 Surfaces)', 'Amalgam restoration - two surfaces', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'moderate'),
    ('8403', 1500.00, 'Amalgam Filling (3+ Surfaces)', 'Amalgam restoration - three or more surfaces', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'moderate'),
    
    -- Restorative Dentistry - Composite Fillings
    ('8404', 1200.00, 'Composite Filling (1 Surface)', 'Composite resin restoration - single surface', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'moderate'),
    ('8405', 1600.00, 'Composite Filling (2 Surfaces)', 'Composite resin restoration - two surfaces', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'moderate'),
    ('8406', 2000.00, 'Composite Filling (3+ Surfaces)', 'Composite resin restoration - three or more surfaces', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'complex'),
    ('8407', 2800.00, 'Large Composite Restoration', 'Large composite restoration with cusp coverage', 'Restorative', 'Fillings', 'YES', true, 'per_tooth', 'complex'),
    
    -- Endodontic Treatment
    ('8501', 2800.00, 'Root Canal - Anterior Tooth', 'Endodontic treatment - anterior tooth', 'Endodontic', 'Root Canal', 'YES', true, 'per_tooth', 'complex'),
    ('8502', 3500.00, 'Root Canal - Premolar', 'Endodontic treatment - premolar tooth', 'Endodontic', 'Root Canal', 'YES', true, 'per_tooth', 'complex'),
    ('8503', 4200.00, 'Root Canal - Molar', 'Endodontic treatment - molar tooth', 'Endodontic', 'Root Canal', 'YES', true, 'per_tooth', 'complex'),
    ('8504', 1800.00, 'Pulpotomy', 'Partial pulp removal - vital pulpotomy', 'Endodontic', 'Pulp Treatment', 'YES', true, 'per_tooth', 'moderate'),
    ('8505', 1200.00, 'Pulp Capping (Direct)', 'Direct pulp capping procedure', 'Endodontic', 'Pulp Treatment', 'YES', true, 'per_tooth', 'moderate'),
    ('8506', 800.00, 'Pulp Capping (Indirect)', 'Indirect pulp capping procedure', 'Endodontic', 'Pulp Treatment', 'YES', true, 'per_tooth', 'simple'),
    
    -- Prosthodontic Services - Crowns
    ('8601', 8500.00, 'Crown - Porcelain Fused to Metal', 'Single crown - porcelain fused to metal', 'Prosthodontic', 'Crowns', 'YES', true, 'per_tooth', 'complex'),
    ('8602', 12000.00, 'Crown - All Ceramic', 'Single crown - all ceramic/porcelain', 'Prosthodontic', 'Crowns', 'YES', true, 'per_tooth', 'complex'),
    ('8603', 15000.00, 'Crown - Zirconia', 'Single crown - zirconia', 'Prosthodontic', 'Crowns', 'YES', true, 'per_tooth', 'complex'),
    ('8604', 6500.00, 'Crown - Stainless Steel', 'Stainless steel crown (usually pediatric)', 'Prosthodontic', 'Crowns', 'YES', true, 'per_tooth', 'moderate'),
    ('8605', 3500.00, 'Crown - Temporary', 'Temporary crown while permanent is being made', 'Prosthodontic', 'Crowns', 'YES', true, 'per_tooth', 'simple'),
    
    -- Prosthodontic Services - Bridges
    ('8610', 6500.00, 'Bridge Unit (PFM)', 'Fixed bridge unit - porcelain fused to metal', 'Prosthodontic', 'Bridges', 'YES', false, 'per_unit', 'complex'),
    ('8611', 9500.00, 'Bridge Unit (All Ceramic)', 'Fixed bridge unit - all ceramic', 'Prosthodontic', 'Bridges', 'YES', false, 'per_unit', 'complex'),
    ('8612', 12000.00, 'Bridge Unit (Zirconia)', 'Fixed bridge unit - zirconia', 'Prosthodontic', 'Bridges', 'YES', false, 'per_unit', 'complex'),
    
    -- Prosthodontic Services - Dentures
    ('8620', 15000.00, 'Complete Denture (Upper)', 'Complete upper denture', 'Prosthodontic', 'Dentures', 'NO', false, 'per_arch', 'complex'),
    ('8621', 15000.00, 'Complete Denture (Lower)', 'Complete lower denture', 'Prosthodontic', 'Dentures', 'NO', false, 'per_arch', 'complex'),
    ('8622', 8500.00, 'Partial Denture (Acrylic)', 'Partial denture - acrylic base', 'Prosthodontic', 'Dentures', 'NO', false, 'per_arch', 'moderate'),
    ('8623', 12000.00, 'Partial Denture (Metal Framework)', 'Partial denture with metal framework', 'Prosthodontic', 'Dentures', 'NO', false, 'per_arch', 'complex'),
    
    -- Oral Surgery - Extractions
    ('8701', 1200.00, 'Simple Extraction', 'Simple tooth extraction', 'Oral Surgery', 'Extractions', 'YES', true, 'per_tooth', 'simple'),
    ('8702', 2200.00, 'Surgical Extraction', 'Surgical tooth extraction', 'Oral Surgery', 'Extractions', 'YES', true, 'per_tooth', 'moderate'),
    ('8703', 3500.00, 'Impacted Wisdom Tooth Extraction', 'Surgical removal of impacted third molar', 'Oral Surgery', 'Extractions', 'YES', true, 'per_tooth', 'complex'),
    ('8704', 4500.00, 'Complex Surgical Extraction', 'Complex surgical extraction with bone removal', 'Oral Surgery', 'Extractions', 'YES', true, 'per_tooth', 'complex'),
    ('8705', 2800.00, 'Root Removal', 'Surgical removal of retained root', 'Oral Surgery', 'Extractions', 'YES', true, 'per_root', 'moderate'),
    
    -- Oral Surgery - Implants
    ('8710', 25000.00, 'Dental Implant (Single)', 'Single dental implant placement', 'Oral Surgery', 'Implants', 'YES', true, 'per_implant', 'complex'),
    ('8711', 18000.00, 'Implant Abutment', 'Implant abutment placement', 'Oral Surgery', 'Implants', 'YES', true, 'per_abutment', 'complex'),
    ('8712', 15000.00, 'Implant Crown', 'Crown for dental implant', 'Oral Surgery', 'Implants', 'YES', true, 'per_crown', 'complex'),
    ('8713', 8500.00, 'Bone Graft (Implant Site)', 'Bone grafting for implant site preparation', 'Oral Surgery', 'Implants', 'YES', true, 'per_site', 'complex'),
    
    -- Periodontal Treatment
    ('8801', 1800.00, 'Gingivectomy (Per Quadrant)', 'Surgical removal of gingival tissue', 'Periodontal', 'Surgery', 'YES', false, 'per_quadrant', 'moderate'),
    ('8802', 4500.00, 'Gum Graft', 'Soft tissue graft procedure per site', 'Periodontal', 'Surgery', 'YES', false, 'per_site', 'complex'),
    ('8803', 3200.00, 'Bone Graft (Small)', 'Bone grafting procedure - small area', 'Periodontal', 'Surgery', 'SOMETIMES', false, 'per_site', 'complex'),
    ('8804', 2500.00, 'Pocket Reduction Surgery', 'Periodontal pocket reduction surgery', 'Periodontal', 'Surgery', 'YES', false, 'per_quadrant', 'moderate'),
    ('8805', 1500.00, 'Crown Lengthening', 'Crown lengthening procedure', 'Periodontal', 'Surgery', 'YES', true, 'per_tooth', 'moderate'),
    
    -- Orthodontic Treatment
    ('8901', 85000.00, 'Complete Orthodontic Treatment', 'Comprehensive orthodontic treatment with braces', 'Orthodontic', 'Treatment', 'NO', false, 'per_treatment', 'complex'),
    ('8902', 95000.00, 'Invisalign Treatment', 'Complete Invisalign clear aligner treatment', 'Orthodontic', 'Treatment', 'NO', false, 'per_treatment', 'complex'),
    ('8903', 2500.00, 'Orthodontic Consultation', 'Initial orthodontic consultation and diagnostic records', 'Orthodontic', 'Consultation', 'NO', false, 'per_visit', 'simple'),
    ('8904', 800.00, 'Orthodontic Adjustment', 'Orthodontic appliance adjustment visit', 'Orthodontic', 'Adjustment', 'NO', false, 'per_visit', 'simple'),
    ('8905', 3500.00, 'Retainer (Upper)', 'Upper orthodontic retainer', 'Orthodontic', 'Appliances', 'NO', false, 'per_arch', 'moderate'),
    ('8906', 3500.00, 'Retainer (Lower)', 'Lower orthodontic retainer', 'Orthodontic', 'Appliances', 'NO', false, 'per_arch', 'moderate'),
    
    -- Pediatric Dentistry
    ('9001', 380.00, 'Pediatric Oral Health Assessment', 'Oral health assessment for children', 'Pediatric', 'Examination', 'NO', false, 'per_visit', 'simple'),
    ('9002', 550.00, 'Pediatric Cleaning', 'Professional cleaning for children', 'Pediatric', 'Preventive', 'NO', false, 'per_visit', 'simple'),
    ('9003', 2200.00, 'Stainless Steel Crown (Pediatric)', 'Pediatric stainless steel crown', 'Pediatric', 'Restorative', 'YES', true, 'per_tooth', 'moderate'),
    ('9004', 1800.00, 'Pulpotomy (Pediatric)', 'Pediatric pulpotomy procedure', 'Pediatric', 'Endodontic', 'YES', true, 'per_tooth', 'moderate'),
    ('9005', 350.00, 'Fluoride Treatment (Pediatric)', 'Fluoride application for children', 'Pediatric', 'Preventive', 'NO', false, 'per_treatment', 'simple'),
    ('9006', 450.00, 'Space Maintainer', 'Space maintainer for early tooth loss', 'Pediatric', 'Appliances', 'YES', false, 'per_appliance', 'moderate'),
    
    -- Emergency Services
    ('9101', 680.00, 'Emergency Pain Relief', 'Emergency treatment for dental pain', 'Emergency', 'Pain Management', 'NO', false, 'per_visit', 'moderate'),
    ('9102', 450.00, 'Temporary Filling', 'Temporary restoration for emergency', 'Emergency', 'Temporary Treatment', 'YES', true, 'per_tooth', 'simple'),
    ('9103', 850.00, 'Trauma Assessment', 'Assessment and initial treatment of dental trauma', 'Emergency', 'Trauma', 'NO', false, 'per_visit', 'moderate'),
    ('9104', 1200.00, 'Emergency Extraction', 'Emergency tooth extraction for pain relief', 'Emergency', 'Extractions', 'YES', true, 'per_tooth', 'moderate'),
    ('9105', 800.00, 'Emergency Endodontic Treatment', 'Emergency root canal therapy', 'Emergency', 'Endodontic', 'YES', true, 'per_tooth', 'complex'),
    
    -- Aesthetic/Cosmetic Dentistry
    ('9201', 8500.00, 'Veneer (Porcelain)', 'Porcelain veneer per tooth', 'Aesthetic', 'Veneers', 'YES', true, 'per_tooth', 'complex'),
    ('9202', 6500.00, 'Veneer (Composite)', 'Composite veneer per tooth', 'Aesthetic', 'Veneers', 'YES', true, 'per_tooth', 'moderate'),
    ('9203', 12000.00, 'Teeth Whitening (In-Office)', 'Professional in-office teeth whitening', 'Aesthetic', 'Whitening', 'NO', false, 'per_treatment', 'simple'),
    ('9204', 4500.00, 'Teeth Whitening (Take-Home)', 'Custom take-home whitening trays and gel', 'Aesthetic', 'Whitening', 'NO', false, 'per_treatment', 'simple'),
    ('9205', 2800.00, 'Bonding (Cosmetic)', 'Cosmetic dental bonding per tooth', 'Aesthetic', 'Bonding', 'YES', true, 'per_tooth', 'moderate'),
    
    -- Specialized Procedures
    ('9301', 1500.00, 'Biopsy (Oral)', 'Oral tissue biopsy', 'Oral Surgery', 'Biopsy', 'YES', false, 'per_site', 'moderate'),
    ('9302', 2200.00, 'Frenectomy', 'Surgical removal of frenum', 'Oral Surgery', 'Minor Surgery', 'NO', false, 'per_procedure', 'moderate'),
    ('9303', 3500.00, 'Apicoectomy', 'Surgical root tip removal', 'Endodontic', 'Surgery', 'YES', true, 'per_tooth', 'complex'),
    ('9304', 4200.00, 'Cyst Removal', 'Surgical removal of oral cyst', 'Oral Surgery', 'Surgery', 'SOMETIMES', false, 'per_procedure', 'complex'),
    ('9305', 1800.00, 'Torus Removal', 'Surgical removal of torus', 'Oral Surgery', 'Minor Surgery', 'NO', false, 'per_procedure', 'moderate')
) AS dental_codes(code, price, name, description, category, subcategory, multiplication_rule, tooth_number_required, unit, complexity);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_code ON practice_tariffs(code);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_category ON practice_tariffs(category);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_active ON practice_tariffs(is_active);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_code ON practice_tariffs(practice_id, code);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_multiplication ON practice_tariffs(multiplication_rule);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_tooth_required ON practice_tariffs(tooth_number_required);
`;

// Execute the import
executeSQL(dentalTariffsSQL);