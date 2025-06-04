-- =====================================================
-- COMPREHENSIVE DENTAL TARIFF DATA IMPORT
-- =====================================================
-- This script imports extensive dental tariff data based on Namibian dental practice standards
-- Includes all major dental specialties and procedures

-- First, clear any existing dental tariffs to avoid duplicates
DELETE FROM practice_tariffs WHERE practice_type = 'dental';

-- Insert comprehensive dental tariff data
INSERT INTO practice_tariffs (
  practice_id, code, price, namaf_prace_2025, edi_diagnosi, full_description, 
  practice_type, practice_subtypes, category, subcategory, unit
) VALUES

-- ===========================================
-- 1. DIAGNOSTIC AND CONSULTATION CODES (8100-8199)
-- ===========================================
(NULL, '8101', 450.00, 'Comprehensive Oral Health Assessment', 'Z01.20', 'Complete oral health assessment including medical history, intraoral and extraoral examination, radiographic evaluation, diagnosis, and treatment planning', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Comprehensive Examination', 'per visit'),
(NULL, '8102', 350.00, 'Limited Oral Examination', 'Z01.20', 'Problem-focused oral examination for specific dental complaint or emergency', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Limited Examination', 'per visit'),
(NULL, '8103', 280.00, 'Emergency Oral Examination', 'Z01.20', 'Urgent examination for acute dental pain, trauma, or dental emergency', 'dental', ARRAY['General Dental Practitioners', 'Emergency Services'], 'Consultation', 'Emergency Examination', 'per visit'),
(NULL, '8104', 200.00, 'Follow-up Examination', 'Z01.20', 'Post-treatment follow-up examination to assess healing and treatment progress', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Follow-up', 'per visit'),
(NULL, '8105', 380.00, 'Pediatric Oral Health Assessment', 'Z01.20', 'Comprehensive oral health assessment specifically for children under 12 years', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Consultation', 'Pediatric Examination', 'per visit'),
(NULL, '8106', 520.00, 'Orthodontic Consultation', 'K07.9', 'Initial orthodontic consultation including clinical examination and treatment planning', 'dental', ARRAY['Orthodontists'], 'Consultation', 'Orthodontic', 'per visit'),
(NULL, '8107', 680.00, 'Periodontal Consultation', 'K05.9', 'Specialized periodontal examination including periodontal charting and assessment', 'dental', ARRAY['Periodontists'], 'Consultation', 'Periodontal', 'per visit'),
(NULL, '8108', 850.00, 'Oral Surgery Consultation', 'K00.9', 'Specialized oral surgery consultation for complex extractions, implants, or surgery', 'dental', ARRAY['Oral Surgeons'], 'Consultation', 'Oral Surgery', 'per visit'),
(NULL, '8109', 750.00, 'Endodontic Consultation', 'K04.9', 'Specialized endodontic consultation for root canal treatment assessment', 'dental', ARRAY['Endodontists'], 'Consultation', 'Endodontic', 'per visit'),
(NULL, '8110', 950.00, 'Prosthodontic Consultation', 'K08.9', 'Specialized consultation for crowns, bridges, and prosthodontic treatment', 'dental', ARRAY['Prosthodontists'], 'Consultation', 'Prosthodontic', 'per visit'),

-- ===========================================
-- 2. DIAGNOSTIC IMAGING (8200-8299)
-- ===========================================
(NULL, '8201', 180.00, 'Periapical Radiograph (Single)', 'Z87.891', 'Single periapical radiograph for specific tooth evaluation', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Intraoral Radiography', 'per image'),
(NULL, '8202', 160.00, 'Bitewing Radiograph (Single)', 'Z87.891', 'Single bitewing radiograph for caries detection', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Intraoral Radiography', 'per image'),
(NULL, '8203', 320.00, 'Bitewing Radiographs (Set of 4)', 'Z87.891', 'Full mouth bitewing radiographic series (4 films)', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Intraoral Radiography', 'per set'),
(NULL, '8204', 450.00, 'Full Mouth Periapical Series', 'Z87.891', 'Complete periapical radiographic survey (14-21 films)', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Intraoral Radiography', 'per series'),
(NULL, '8205', 850.00, 'Panoramic Radiograph', 'Z87.891', 'Panoramic radiographic examination of entire dentition and jaws', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Extraoral Radiography', 'per image'),
(NULL, '8206', 1200.00, 'Cephalometric Radiograph', 'Z87.891', 'Lateral cephalometric radiograph for orthodontic analysis', 'dental', ARRAY['Orthodontists'], 'Diagnostic', 'Cephalometric', 'per image'),
(NULL, '8207', 2500.00, 'CBCT Scan (Limited FOV)', 'Z87.891', 'Cone beam computed tomography - limited field of view (single tooth/region)', 'dental', ARRAY['Specialists', 'Oral Surgeons'], 'Diagnostic', 'Advanced Imaging', 'per scan'),
(NULL, '8208', 4500.00, 'CBCT Scan (Full Mouth)', 'Z87.891', 'Cone beam computed tomography - full mouth/maxillofacial region', 'dental', ARRAY['Specialists', 'Oral Surgeons'], 'Diagnostic', 'Advanced Imaging', 'per scan'),
(NULL, '8209', 450.00, 'Occlusal Radiograph', 'Z87.891', 'Occlusal radiographic view for impacted teeth or pathology', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Intraoral Radiography', 'per image'),
(NULL, '8210', 380.00, 'Digital Intraoral Photography', 'Z87.891', 'Digital photography for documentation and treatment planning', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Photography', 'per session'),

-- ===========================================
-- 3. PREVENTIVE SERVICES (8300-8399)
-- ===========================================
(NULL, '8301', 650.00, 'Adult Prophylaxis', 'Z29.3', 'Professional teeth cleaning including scaling and polishing for healthy adults', 'dental', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Preventive', 'Prophylaxis', 'per visit'),
(NULL, '8302', 550.00, 'Child Prophylaxis (Under 12)', 'Z29.3', 'Professional teeth cleaning for children under 12 years', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Preventive', 'Pediatric Prophylaxis', 'per visit'),
(NULL, '8303', 380.00, 'Fluoride Treatment (Professional)', 'Z29.3', 'Professional fluoride application for caries prevention', 'dental', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Preventive', 'Fluoride Treatment', 'per application'),
(NULL, '8304', 450.00, 'Dental Sealant (Per Tooth)', 'Z29.3', 'Pit and fissure sealant application on posterior teeth', 'dental', ARRAY['General Dental Practitioners', 'Pediatric Dentists'], 'Preventive', 'Sealants', 'per tooth'),
(NULL, '8305', 1200.00, 'Scaling and Root Planing (Per Quadrant)', 'K05.00', 'Deep cleaning including scaling and root planing for periodontal disease', 'dental', ARRAY['General Dental Practitioners', 'Periodontists'], 'Preventive', 'Periodontal Therapy', 'per quadrant'),
(NULL, '8306', 850.00, 'Gross Debridement', 'K03.6', 'Removal of heavy calculus deposits prior to comprehensive treatment', 'dental', ARRAY['General Dental Practitioners', 'Periodontists'], 'Preventive', 'Debridement', 'per visit'),
(NULL, '8307', 320.00, 'Oral Hygiene Instruction', 'Z71.3', 'Comprehensive oral hygiene education and instruction', 'dental', ARRAY['Dental Hygienists', 'General Dental Practitioners'], 'Preventive', 'Education', 'per session'),
(NULL, '8308', 750.00, 'Periodontal Maintenance', 'K05.00', 'Ongoing periodontal maintenance therapy for treated periodontal patients', 'dental', ARRAY['General Dental Practitioners', 'Periodontists'], 'Preventive', 'Periodontal Maintenance', 'per visit'),
(NULL, '8309', 280.00, 'Desensitizing Treatment', 'K03.2', 'Application of desensitizing agents for hypersensitive teeth', 'dental', ARRAY['General Dental Practitioners'], 'Preventive', 'Desensitizing', 'per application'),
(NULL, '8310', 580.00, 'Nutritional Counseling', 'Z71.3', 'Dietary counseling for oral health maintenance', 'dental', ARRAY['Dental Hygienists', 'Nutritionists'], 'Preventive', 'Counseling', 'per session'),

-- ===========================================
-- 4. RESTORATIVE DENTISTRY (8400-8499)
-- ===========================================
-- Amalgam Restorations
(NULL, '8401', 850.00, 'Amalgam Filling (1 Surface)', 'K02.9', 'Amalgam restoration involving one tooth surface', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Amalgam Fillings', 'per tooth'),
(NULL, '8402', 1200.00, 'Amalgam Filling (2 Surfaces)', 'K02.9', 'Amalgam restoration involving two tooth surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Amalgam Fillings', 'per tooth'),
(NULL, '8403', 1500.00, 'Amalgam Filling (3+ Surfaces)', 'K02.9', 'Amalgam restoration involving three or more tooth surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Amalgam Fillings', 'per tooth'),

-- Composite Restorations
(NULL, '8404', 1200.00, 'Composite Filling (1 Surface, Anterior)', 'K02.9', 'Composite resin restoration - single surface, anterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),
(NULL, '8405', 1600.00, 'Composite Filling (2 Surfaces, Anterior)', 'K02.9', 'Composite resin restoration - two surfaces, anterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),
(NULL, '8406', 2000.00, 'Composite Filling (3+ Surfaces, Anterior)', 'K02.9', 'Composite resin restoration - three or more surfaces, anterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),
(NULL, '8407', 1400.00, 'Composite Filling (1 Surface, Posterior)', 'K02.9', 'Composite resin restoration - single surface, posterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),
(NULL, '8408', 1800.00, 'Composite Filling (2 Surfaces, Posterior)', 'K02.9', 'Composite resin restoration - two surfaces, posterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),
(NULL, '8409', 2200.00, 'Composite Filling (3+ Surfaces, Posterior)', 'K02.9', 'Composite resin restoration - three or more surfaces, posterior tooth', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Composite Fillings', 'per tooth'),

-- Glass Ionomer Restorations
(NULL, '8410', 750.00, 'Glass Ionomer Filling (1 Surface)', 'K02.9', 'Glass ionomer restoration - single surface', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Glass Ionomer', 'per tooth'),
(NULL, '8411', 950.00, 'Glass Ionomer Filling (2+ Surfaces)', 'K02.9', 'Glass ionomer restoration - multiple surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Glass Ionomer', 'per tooth'),

-- Inlays and Onlays
(NULL, '8420', 4500.00, 'Porcelain Inlay', 'K02.9', 'Indirect porcelain inlay restoration', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Restorative', 'Indirect Restorations', 'per tooth'),
(NULL, '8421', 5200.00, 'Porcelain Onlay', 'K02.9', 'Indirect porcelain onlay restoration', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Restorative', 'Indirect Restorations', 'per tooth'),
(NULL, '8422', 3800.00, 'Gold Inlay', 'K02.9', 'Indirect gold inlay restoration', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Restorative', 'Indirect Restorations', 'per tooth'),
(NULL, '8423', 4500.00, 'Gold Onlay', 'K02.9', 'Indirect gold onlay restoration', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Restorative', 'Indirect Restorations', 'per tooth'),

-- ===========================================
-- 5. ENDODONTIC TREATMENT (8500-8599)
-- ===========================================
(NULL, '8501', 2800.00, 'Root Canal Treatment (Anterior)', 'K04.9', 'Complete endodontic treatment - anterior tooth (incisors, canines)', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal Therapy', 'per tooth'),
(NULL, '8502', 3500.00, 'Root Canal Treatment (Premolar)', 'K04.9', 'Complete endodontic treatment - premolar tooth', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal Therapy', 'per tooth'),
(NULL, '8503', 4200.00, 'Root Canal Treatment (Molar)', 'K04.9', 'Complete endodontic treatment - molar tooth', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal Therapy', 'per tooth'),
(NULL, '8504', 1800.00, 'Pulpotomy (Vital)', 'K04.1', 'Vital pulpotomy procedure - partial pulp removal', 'dental', ARRAY['General Dental Practitioners', 'Pediatric Dentists'], 'Endodontic', 'Pulp Therapy', 'per tooth'),
(NULL, '8505', 1200.00, 'Pulpectomy', 'K04.1', 'Complete pulp removal from primary tooth', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Endodontic', 'Pulp Therapy', 'per tooth'),
(NULL, '8506', 3800.00, 'Root Canal Retreatment (Anterior)', 'K04.9', 'Endodontic retreatment - anterior tooth', 'dental', ARRAY['Endodontists', 'General Dental Practitioners'], 'Endodontic', 'Retreatment', 'per tooth'),
(NULL, '8507', 4800.00, 'Root Canal Retreatment (Premolar)', 'K04.9', 'Endodontic retreatment - premolar tooth', 'dental', ARRAY['Endodontists', 'General Dental Practitioners'], 'Endodontic', 'Retreatment', 'per tooth'),
(NULL, '8508', 5500.00, 'Root Canal Retreatment (Molar)', 'K04.9', 'Endodontic retreatment - molar tooth', 'dental', ARRAY['Endodontists', 'General Dental Practitioners'], 'Endodontic', 'Retreatment', 'per tooth'),
(NULL, '8509', 2200.00, 'Apicoectomy', 'K04.8', 'Surgical endodontic procedure - root end surgery', 'dental', ARRAY['Endodontists', 'Oral Surgeons'], 'Endodontic', 'Surgical Endodontics', 'per root'),
(NULL, '8510', 850.00, 'Pulp Cap (Direct)', 'K04.1', 'Direct pulp capping procedure', 'dental', ARRAY['General Dental Practitioners'], 'Endodontic', 'Pulp Protection', 'per tooth'),
(NULL, '8511', 650.00, 'Pulp Cap (Indirect)', 'K04.1', 'Indirect pulp capping procedure', 'dental', ARRAY['General Dental Practitioners'], 'Endodontic', 'Pulp Protection', 'per tooth'),

-- ===========================================
-- 6. PROSTHODONTIC SERVICES (8600-8699)
-- ===========================================
-- Single Crowns
(NULL, '8601', 8500.00, 'Crown (Porcelain Fused to Metal)', 'K08.1', 'Single crown - porcelain fused to metal alloy', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Single Crowns', 'per crown'),
(NULL, '8602', 12000.00, 'Crown (All Ceramic/Porcelain)', 'K08.1', 'Single crown - all ceramic or all porcelain', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Single Crowns', 'per crown'),
(NULL, '8603', 15000.00, 'Crown (Zirconia)', 'K08.1', 'Single crown - zirconia based', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Single Crowns', 'per crown'),
(NULL, '8604', 6500.00, 'Crown (Base Metal)', 'K08.1', 'Single crown - base metal alloy', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Single Crowns', 'per crown'),
(NULL, '8605', 18000.00, 'Crown (Gold/High Noble)', 'K08.1', 'Single crown - gold or high noble metal', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Single Crowns', 'per crown'),
(NULL, '8606', 2200.00, 'Crown (Stainless Steel - Pediatric)', 'K02.9', 'Stainless steel crown for primary teeth', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Prosthodontic', 'Pediatric Crowns', 'per crown'),

-- Fixed Bridges
(NULL, '8610', 6500.00, 'Bridge Unit (Pontic)', 'K08.1', 'Fixed bridge pontic (replacement tooth)', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Fixed Bridges', 'per unit'),
(NULL, '8611', 8500.00, 'Bridge Unit (Retainer)', 'K08.1', 'Fixed bridge retainer (crown)', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Fixed Bridges', 'per unit'),
(NULL, '8612', 4500.00, 'Bridge Repair', 'K08.59', 'Repair of existing fixed bridge', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Bridge Repair', 'per repair'),

-- Removable Prosthetics
(NULL, '8620', 8500.00, 'Complete Denture (Upper)', 'K08.1', 'Complete maxillary denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Complete Dentures', 'per denture'),
(NULL, '8621', 8500.00, 'Complete Denture (Lower)', 'K08.1', 'Complete mandibular denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Complete Dentures', 'per denture'),
(NULL, '8622', 6500.00, 'Partial Denture (Cast Metal)', 'K08.1', 'Removable partial denture with cast metal framework', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Partial Dentures', 'per denture'),
(NULL, '8623', 4200.00, 'Partial Denture (Acrylic)', 'K08.1', 'Removable partial denture - acrylic base', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Partial Dentures', 'per denture'),
(NULL, '8624', 2800.00, 'Denture Repair', 'K08.59', 'Repair of existing denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Denture Repair', 'per repair'),
(NULL, '8625', 1800.00, 'Denture Reline (Soft)', 'K08.59', 'Soft reline of existing denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Denture Reline', 'per reline'),
(NULL, '8626', 2500.00, 'Denture Reline (Hard)', 'K08.59', 'Hard reline of existing denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Denture Reline', 'per reline'),

-- ===========================================
-- 7. ORAL SURGERY (8700-8799)
-- ===========================================
-- Extractions
(NULL, '8701', 1200.00, 'Simple Extraction (Anterior)', 'K08.1', 'Simple extraction of anterior tooth', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Simple Extractions', 'per tooth'),
(NULL, '8702', 1400.00, 'Simple Extraction (Premolar)', 'K08.1', 'Simple extraction of premolar tooth', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Simple Extractions', 'per tooth'),
(NULL, '8703', 1600.00, 'Simple Extraction (Molar)', 'K08.1', 'Simple extraction of molar tooth', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Simple Extractions', 'per tooth'),
(NULL, '8704', 2200.00, 'Surgical Extraction', 'K08.1', 'Surgical extraction requiring bone removal or sectioning', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Surgical Extractions', 'per tooth'),
(NULL, '8705', 3500.00, 'Impacted Wisdom Tooth (Soft Tissue)', 'K01.1', 'Extraction of soft tissue impacted third molar', 'dental', ARRAY['Oral Surgeons', 'General Dental Practitioners'], 'Oral Surgery', 'Impacted Teeth', 'per tooth'),
(NULL, '8706', 4500.00, 'Impacted Wisdom Tooth (Partial Bony)', 'K01.1', 'Extraction of partially bony impacted third molar', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Impacted Teeth', 'per tooth'),
(NULL, '8707', 6500.00, 'Impacted Wisdom Tooth (Complete Bony)', 'K01.1', 'Extraction of completely bony impacted third molar', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Impacted Teeth', 'per tooth'),

-- Dental Implants
(NULL, '8710', 25000.00, 'Dental Implant (Single)', 'K08.3', 'Single dental implant placement', 'dental', ARRAY['Oral Surgeons', 'Prosthodontists'], 'Oral Surgery', 'Dental Implants', 'per implant'),
(NULL, '8711', 15000.00, 'Implant Abutment', 'K08.3', 'Implant abutment placement', 'dental', ARRAY['Oral Surgeons', 'Prosthodontists'], 'Oral Surgery', 'Dental Implants', 'per abutment'),
(NULL, '8712', 12000.00, 'Implant Crown', 'K08.3', 'Crown restoration on dental implant', 'dental', ARRAY['Prosthodontists', 'General Dental Practitioners'], 'Oral Surgery', 'Dental Implants', 'per crown'),
(NULL, '8713', 8500.00, 'Bone Graft (Implant Site)', 'K08.2', 'Bone grafting for implant site development', 'dental', ARRAY['Oral Surgeons', 'Periodontists'], 'Oral Surgery', 'Bone Grafting', 'per site'),
(NULL, '8714', 12000.00, 'Sinus Lift (Internal)', 'K08.2', 'Internal sinus lift procedure for implant placement', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Sinus Procedures', 'per procedure'),
(NULL, '8715', 18000.00, 'Sinus Lift (External)', 'K08.2', 'External sinus lift procedure for implant placement', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Sinus Procedures', 'per procedure'),

-- Other Oral Surgery
(NULL, '8720', 2800.00, 'Alveoloplasty (Per Quadrant)', 'K08.2', 'Alveolar bone recontouring', 'dental', ARRAY['Oral Surgeons', 'General Dental Practitioners'], 'Oral Surgery', 'Bone Surgery', 'per quadrant'),
(NULL, '8721', 4500.00, 'Frenectomy', 'K13.5', 'Surgical removal of frenum', 'dental', ARRAY['Oral Surgeons', 'General Dental Practitioners'], 'Oral Surgery', 'Soft Tissue Surgery', 'per procedure'),
(NULL, '8722', 8500.00, 'Biopsy (Soft Tissue)', 'C00.9', 'Soft tissue biopsy procedure', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Biopsy', 'per biopsy'),
(NULL, '8723', 12000.00, 'Biopsy (Hard Tissue)', 'C41.1', 'Hard tissue/bone biopsy procedure', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Biopsy', 'per biopsy'),

-- ===========================================
-- 8. PERIODONTAL TREATMENT (8800-8899)
-- ===========================================
(NULL, '8801', 1800.00, 'Gingivectomy (Per Quadrant)', 'K05.1', 'Surgical removal of gingival tissue', 'dental', ARRAY['Periodontists', 'General Dental Practitioners'], 'Periodontal', 'Gingival Surgery', 'per quadrant'),
(NULL, '8802', 4500.00, 'Soft Tissue Graft (Per Site)', 'K06.2', 'Soft tissue graft procedure for root coverage', 'dental', ARRAY['Periodontists'], 'Periodontal', 'Grafting Procedures', 'per site'),
(NULL, '8803', 3200.00, 'Bone Graft (Small)', 'K08.2', 'Bone grafting procedure - small defect', 'dental', ARRAY['Periodontists', 'Oral Surgeons'], 'Periodontal', 'Bone Grafting', 'per site'),
(NULL, '8804', 5500.00, 'Bone Graft (Large)', 'K08.2', 'Bone grafting procedure - large defect', 'dental', ARRAY['Periodontists', 'Oral Surgeons'], 'Periodontal', 'Bone Grafting', 'per site'),
(NULL, '8805', 2800.00, 'Flap Surgery (Per Quadrant)', 'K05.2', 'Open flap debridement with osseous surgery', 'dental', ARRAY['Periodontists'], 'Periodontal', 'Flap Surgery', 'per quadrant'),
(NULL, '8806', 6500.00, 'Guided Tissue Regeneration', 'K05.2', 'Guided tissue regeneration with barrier membrane', 'dental', ARRAY['Periodontists'], 'Periodontal', 'Regenerative Procedures', 'per site'),
(NULL, '8807', 3800.00, 'Crown Lengthening (Per Tooth)', 'K05.5', 'Surgical crown lengthening procedure', 'dental', ARRAY['Periodontists', 'General Dental Practitioners'], 'Periodontal', 'Crown Lengthening', 'per tooth'),
(NULL, '8808', 1200.00, 'Localized Antibiotic Delivery', 'K05.3', 'Local delivery of antimicrobial agents', 'dental', ARRAY['Periodontists', 'General Dental Practitioners'], 'Periodontal', 'Antibiotic Therapy', 'per site'),

-- ===========================================
-- 9. ORTHODONTIC TREATMENT (8900-8999)
-- ===========================================
(NULL, '8901', 85000.00, 'Complete Orthodontic Treatment (Metal Braces)', 'K07.9', 'Comprehensive orthodontic treatment with metal brackets', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Fixed Appliances', 'per treatment'),
(NULL, '8902', 95000.00, 'Complete Orthodontic Treatment (Ceramic Braces)', 'K07.9', 'Comprehensive orthodontic treatment with ceramic brackets', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Fixed Appliances', 'per treatment'),
(NULL, '8903', 120000.00, 'Complete Orthodontic Treatment (Clear Aligners)', 'K07.9', 'Comprehensive orthodontic treatment with clear aligner therapy', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Clear Aligners', 'per treatment'),
(NULL, '8904', 25000.00, 'Orthodontic Records and Diagnosis', 'K07.9', 'Complete orthodontic records including models, radiographs, and analysis', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Diagnosis', 'per case'),
(NULL, '8905', 2500.00, 'Orthodontic Adjustment (Active Treatment)', 'K07.9', 'Routine orthodontic adjustment during active treatment', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Adjustments', 'per visit'),
(NULL, '8906', 1500.00, 'Orthodontic Adjustment (Retention)', 'K07.9', 'Orthodontic adjustment during retention phase', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Retention', 'per visit'),
(NULL, '8907', 8500.00, 'Removable Orthodontic Appliance', 'K07.9', 'Fabrication of removable orthodontic appliance', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Removable Appliances', 'per appliance'),
(NULL, '8908', 12000.00, 'Fixed Retainer', 'K07.9', 'Placement of fixed orthodontic retainer', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Retention', 'per arch'),
(NULL, '8909', 6500.00, 'Removable Retainer', 'K07.9', 'Fabrication of removable orthodontic retainer', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Retention', 'per retainer'),

-- ===========================================
-- 10. PEDIATRIC DENTISTRY (9000-9099)
-- ===========================================
(NULL, '9001', 380.00, 'Pediatric Oral Health Assessment', 'Z01.20', 'Comprehensive oral health assessment for children', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Examination', 'per visit'),
(NULL, '9002', 750.00, 'Pediatric Prophylaxis', 'Z29.3', 'Professional cleaning and fluoride treatment for children', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Preventive', 'per visit'),
(NULL, '9003', 2200.00, 'Stainless Steel Crown (Primary Tooth)', 'K02.9', 'Stainless steel crown for primary molar', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Restorative', 'per crown'),
(NULL, '9004', 850.00, 'Composite Filling (Primary Tooth)', 'K02.9', 'Composite restoration on primary tooth', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Restorative', 'per filling'),
(NULL, '9005', 1500.00, 'Pulpotomy (Primary Tooth)', 'K04.1', 'Pulpotomy procedure on primary tooth', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Endodontic', 'per tooth'),
(NULL, '9006', 850.00, 'Primary Tooth Extraction (Simple)', 'K08.1', 'Simple extraction of primary tooth', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Extraction', 'per tooth'),
(NULL, '9007', 2800.00, 'Space Maintainer (Fixed)', 'K07.9', 'Fixed space maintainer for premature primary tooth loss', 'dental', ARRAY['Pediatric Dentists'], 'Pediatric', 'Space Management', 'per appliance'),
(NULL, '9008', 1800.00, 'Space Maintainer (Removable)', 'K07.9', 'Removable space maintainer', 'dental', ARRAY['Pediatric Dentists'], 'Pediatric', 'Space Management', 'per appliance'),
(NULL, '9009', 450.00, 'Behavior Management Session', 'Z71.9', 'Specialized behavior management for anxious children', 'dental', ARRAY['Pediatric Dentists'], 'Pediatric', 'Behavior Management', 'per session'),

-- ===========================================
-- 11. EMERGENCY SERVICES (9100-9199)
-- ===========================================
(NULL, '9101', 680.00, 'Emergency Pain Relief', 'K08.8', 'Emergency treatment for acute dental pain', 'dental', ARRAY['General Dental Practitioners', 'Emergency Services'], 'Emergency', 'Pain Management', 'per visit'),
(NULL, '9102', 450.00, 'Temporary Filling', 'K02.9', 'Temporary restoration for emergency situations', 'dental', ARRAY['General Dental Practitioners', 'Emergency Services'], 'Emergency', 'Temporary Treatment', 'per filling'),
(NULL, '9103', 850.00, 'Dental Trauma Assessment', 'S02.5', 'Comprehensive assessment and initial treatment of dental trauma', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Emergency', 'Trauma', 'per assessment'),
(NULL, '9104', 1200.00, 'Emergency Extraction', 'K08.1', 'Emergency tooth extraction for severe pain or infection', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Emergency', 'Extraction', 'per tooth'),
(NULL, '9105', 320.00, 'Emergency Prescription', 'Z51.1', 'Emergency prescription for antibiotics or pain medication', 'dental', ARRAY['General Dental Practitioners'], 'Emergency', 'Medication', 'per prescription'),
(NULL, '9106', 950.00, 'Emergency Root Canal (Access Opening)', 'K04.9', 'Emergency endodontic access for pain relief', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Emergency', 'Endodontic', 'per tooth'),
(NULL, '9107', 650.00, 'Splinting (Traumatic Injury)', 'S02.5', 'Splinting of teeth following traumatic injury', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Emergency', 'Trauma', 'per splint'),

-- ===========================================
-- 12. AESTHETIC DENTISTRY (9200-9299)
-- ===========================================
(NULL, '9201', 8500.00, 'Porcelain Veneer (Per Tooth)', 'K08.1', 'Porcelain laminate veneer for aesthetic enhancement', 'aesthetic', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Aesthetic', 'Veneers', 'per tooth'),
(NULL, '9202', 6500.00, 'Composite Veneer (Per Tooth)', 'K08.1', 'Direct composite veneer for aesthetic improvement', 'aesthetic', ARRAY['General Dental Practitioners'], 'Aesthetic', 'Veneers', 'per tooth'),
(NULL, '9203', 12000.00, 'Teeth Whitening (In-Office)', 'K03.7', 'Professional in-office teeth whitening treatment', 'aesthetic', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Aesthetic', 'Whitening', 'per session'),
(NULL, '9204', 4500.00, 'Teeth Whitening (Take-Home Kit)', 'K03.7', 'Professional take-home teeth whitening system', 'aesthetic', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Aesthetic', 'Whitening', 'per kit'),
(NULL, '9205', 2800.00, 'Gingival Contouring (Per Tooth)', 'K06.2', 'Cosmetic gingival reshaping for aesthetic improvement', 'aesthetic', ARRAY['Periodontists', 'General Dental Practitioners'], 'Aesthetic', 'Gingival Aesthetics', 'per tooth'),
(NULL, '9206', 1500.00, 'Cosmetic Bonding (Per Tooth)', 'K03.3', 'Direct composite bonding for aesthetic enhancement', 'aesthetic', ARRAY['General Dental Practitioners'], 'Aesthetic', 'Bonding', 'per tooth'),

-- ===========================================
-- 13. LABORATORY FEES (9300-9399)
-- ===========================================
(NULL, '9301', 2500.00, 'Crown/Bridge Laboratory Fee', 'Z51.9', 'Laboratory fabrication fee for crown or bridge', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Laboratory', 'Crown/Bridge', 'per unit'),
(NULL, '9302', 3500.00, 'Denture Laboratory Fee', 'Z51.9', 'Laboratory fabrication fee for complete or partial denture', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Laboratory', 'Dentures', 'per denture'),
(NULL, '9303', 4500.00, 'Veneer Laboratory Fee', 'Z51.9', 'Laboratory fabrication fee for porcelain veneer', 'aesthetic', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Laboratory', 'Veneers', 'per veneer'),
(NULL, '9304', 1800.00, 'Orthodontic Appliance Laboratory Fee', 'Z51.9', 'Laboratory fabrication fee for orthodontic appliance', 'dental', ARRAY['Orthodontists'], 'Laboratory', 'Orthodontic', 'per appliance'),
(NULL, '9305', 2200.00, 'Night Guard Laboratory Fee', 'Z51.9', 'Laboratory fabrication fee for custom night guard', 'dental', ARRAY['General Dental Practitioners'], 'Laboratory', 'Appliances', 'per guard');

-- Update some tariffs to be associated with existing practices
UPDATE practice_tariffs 
SET practice_id = (SELECT id FROM practices WHERE slug = 'cityclinic' LIMIT 1) 
WHERE code IN (
  '8101', '8102', '8201', '8301', '8401', '8501', '8601', '8701', '8801', '8901', '9001', '9101', '9201'
);

UPDATE practice_tariffs 
SET practice_id = (SELECT id FROM practices WHERE slug = 'coastalmed' LIMIT 1) 
WHERE code IN (
  '8103', '8104', '8202', '8302', '8402', '8502', '8602', '8702', '8802', '8902', '9002', '9102', '9202'
);

-- Create summary of imported data
SELECT 
  '🦷 DENTAL TARIFF IMPORT COMPLETED' as status,
  COUNT(*) as total_tariffs_imported,
  COUNT(DISTINCT category) as categories,
  COUNT(DISTINCT subcategory) as subcategories,
  COUNT(CASE WHEN practice_id IS NOT NULL THEN 1 END) as assigned_to_practices,
  COUNT(CASE WHEN practice_id IS NULL THEN 1 END) as available_for_all_practices
FROM practice_tariffs 
WHERE practice_type = 'dental';

-- Show category breakdown
SELECT 
  category,
  subcategory,
  COUNT(*) as tariff_count,
  MIN(price) as min_price,
  MAX(price) as max_price,
  AVG(price) as avg_price
FROM practice_tariffs 
WHERE practice_type = 'dental'
GROUP BY category, subcategory
ORDER BY category, subcategory;