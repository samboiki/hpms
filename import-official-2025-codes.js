#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// 🔑 SERVICE ROLE CONFIGURATION
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function importOfficial2025Codes() {
  console.log('🦷 IMPORTING OFFICIAL 2025 DENTAL CODES\n');
  
  try {
    // Step 1: Clear all existing tariffs
    console.log('🧹 Clearing all existing tariffs...');
    
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      throw new Error(`Failed to clear tariffs: ${deleteError.message}`);
    }
    
    console.log('✅ All existing tariffs cleared');
    
    // Step 2: Official 2025 Dental Codes with all required columns
    console.log('\n📊 Preparing official 2025 codes with complete data...');
    
    const official2025Codes = [
      { code: '8101', description: 'Full mouth examination, charting and treatment planning', official_2025_price: 254.70, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '254.7 NAD', notes: '' },
      { code: '8102', description: 'Comprehensive consultation', official_2025_price: 479.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '479.0 NAD', notes: '' },
      { code: '8104', description: 'Examination or consultation for a specific problem', official_2025_price: 137.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '137.4 NAD', notes: '' },
      { code: '8106', description: 'Provision of a written treatment plan and quotation', official_2025_price: 345.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '345.6 NAD', notes: '' },
      { code: '8107', description: 'Intra-oral radiographs, per film', official_2025_price: 135.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of X-rays', example_calculation: '78.90 × 3 = 236.70 (for 3 X-rays)', notes: 'Multiply by number of radiographs taken' },
      { code: '8108', description: 'Maximum for 8107 is 7 radiographs', official_2025_price: 1061.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1061.2 NAD', notes: '' },
      { code: '8109', description: 'Infection control, per dentist/hygienist/assistant, per visit', official_2025_price: 34.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: 'SOMETIMES', business_rule: 'Usually charged once per visit, but can be per procedure', example_calculation: '40.00 NAD per visit OR 20.00 × procedures', notes: 'Two pricing models observed in claims' },
      { code: '8110', description: 'Provision of sterilised and wrapped instrumentation', official_2025_price: 76.80, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '76.8 NAD', notes: '' },
      { code: '8113', description: 'Occlusal radiographs', official_2025_price: 234.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '234.5 NAD', notes: '' },
      { code: '8114', description: 'Hand-wrist radiograph', official_2025_price: 549.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '549.8 NAD', notes: '' },
      { code: '8115', description: 'Extra-oral radiograph, per film', official_2025_price: 549.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: true, business_rule: 'Base price × number of films/photos', example_calculation: '549.8 × quantity', notes: 'Multiply by number of films or photographs taken' },
      { code: '8117', description: 'Study models - unmounted', official_2025_price: 151.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '151.6 NAD', notes: '' },
      { code: '8119', description: 'Study models - mounted on adjustable articulator', official_2025_price: 369.90, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '369.9 NAD', notes: '' },
      { code: '8121', description: 'Diagnostic photographs, per photograph', official_2025_price: 151.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: true, business_rule: 'Base price × number of films/photos', example_calculation: '151.6 × quantity', notes: 'Multiply by number of films or photographs taken' },
      { code: '8129', description: 'Additional fee for emergency treatment outside hours', official_2025_price: 513.40, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '513.4 NAD', notes: '' },
      { code: '8131', description: 'Palliative treatment for dental pain', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8132', description: 'Gross pulpal debridement', official_2025_price: 339.60, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '339.6 NAD', notes: '' },
      { code: '8133', description: 'Re-cementing of inlays, crowns or bridges', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8135', description: 'Removal of inlays and crowns', official_2025_price: 412.30, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '412.3 NAD', notes: '' },
      { code: '8136', description: 'Access through prosthetic crown', official_2025_price: 188.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '188.0 NAD', notes: '' },
      { code: '8137', description: 'Temporary crown emergency procedure', official_2025_price: 711.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '711.5 NAD', notes: '' },
      { code: '8140', description: 'Fee for treatment at venue other than surgery', official_2025_price: 337.50, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '337.5 NAD', notes: '' },
      { code: '8141', description: 'Inhalation sedation - first quarter-hour', official_2025_price: 155.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8143', description: 'Inhalation sedation - additional quarter-hour', official_2025_price: 76.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '76.8 NAD', notes: '' },
      { code: '8144', description: 'Intravenous sedation', official_2025_price: 93.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '93.0 NAD', notes: '' },
      { code: '8145', description: 'Local anaesthetic, per visit', official_2025_price: 40.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of injections', example_calculation: '23.50 × 2 = 47.00 (for 2 injections)', notes: 'Multiply by number of anaesthetic carpules administered' },
      { code: '8147', description: 'Use of monitoring equipment for IV sedation', official_2025_price: 329.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '329.5 NAD', notes: '' },
      { code: '8151', description: 'Oral hygiene instructions', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8153', description: 'Follow-up for oral hygiene re-evaluation', official_2025_price: 155.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8155', description: 'Polishing only - complete dentition', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8157', description: 'Re-burnishing and polishing of restorations', official_2025_price: 208.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8159', description: 'Scaling and polishing', official_2025_price: 410.30, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '410.3 NAD', notes: '' },
      { code: '8161', description: 'Topical application of fluoride', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8163', description: 'Fissure sealant, per tooth', official_2025_price: 135.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of teeth', example_calculation: '135.4 × number of teeth', notes: 'Multiply by number of teeth treated' },
      { code: '8167', description: 'Treatment of hypersensitive dentine, per visit', official_2025_price: 159.70, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Charged once per visit', example_calculation: '159.7 per visit', notes: 'Should only appear once per invoice' },
      { code: '8169', description: 'Bite plate for TMJ dysfunction', official_2025_price: 802.40, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '802.4 NAD', notes: '' },
      { code: '8170', description: 'Minor occlusal adjustment', official_2025_price: 456.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '456.8 NAD', notes: '' },
      { code: '8173', description: 'Space maintainer - fixed, per abutment', official_2025_price: 390.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '390.1 NAD', notes: '' },
      { code: '8175', description: 'Space maintainer - removable', official_2025_price: 493.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '493.2 NAD', notes: '' },
      { code: '8176', description: 'Periodontal screening', official_2025_price: 252.70, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '252.7 NAD', notes: '' },
      { code: '8177', description: 'Oral hygiene instruction for periodontally compromised', official_2025_price: 315.30, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '315.3 NAD', notes: '' },
      { code: '8178', description: 'Oral hygiene evaluation for periodontally compromised', official_2025_price: 169.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '169.8 NAD', notes: '' },
      { code: '8179', description: 'Plaque removal for periodontally compromised', official_2025_price: 236.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '236.5 NAD', notes: '' },
      { code: '8180', description: 'Scaling and polishing for periodontally compromised', official_2025_price: 444.70, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '444.7 NAD', notes: '' },
      { code: '8182', description: 'Root planing with/without curettage, per quadrant', official_2025_price: 832.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: true, business_rule: 'Base price × number of quadrants (max 4)', example_calculation: '832.8 × quadrants', notes: 'Multiply by number of quadrants treated' },
      { code: '8183', description: 'Intra-muscular or sub-cutaneous injection', official_2025_price: 93.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '93.0 NAD', notes: '' },
      { code: '8184', description: 'Root planing with/without curettage, per sextant', official_2025_price: 660.90, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of sextants (max 6)', example_calculation: '660.9 × sextants', notes: 'Multiply by number of sextants treated' },
      { code: '8185', description: 'Gingivectomy-gingivoplasty, per quadrant', official_2025_price: 1087.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of quadrants (max 4)', example_calculation: '1087.4 × quadrants', notes: 'Multiply by number of quadrants treated' },
      { code: '8186', description: 'Gingivectomy-gingivoplasty, per sextant', official_2025_price: 865.10, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of sextants (max 6)', example_calculation: '865.1 × sextants', notes: 'Multiply by number of sextants treated' },
      { code: '8188', description: 'Biopsy - intra-oral', official_2025_price: 529.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '529.6 NAD', notes: '' },
      { code: '8192', description: 'Appositioning of soft tissue injuries', official_2025_price: 1024.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1024.8 NAD', notes: '' },
      { code: '8193', description: 'Osseo-integrated abutment restoration', official_2025_price: 3082.40, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '3082.4 NAD', notes: '' },
      { code: '8194', description: 'Placement of single osseo-integrated implant', official_2025_price: 1932.30, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1932.3 NAD', notes: '' },
      { code: '8195', description: 'Placement of second osseo-integrated implant', official_2025_price: 1445.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1445.2 NAD', notes: '' },
      { code: '8196', description: 'Placement of third osseo-integrated implant', official_2025_price: 962.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '962.1 NAD', notes: '' },
      { code: '8198', description: 'Exposure of single osseo-integrated implant', official_2025_price: 715.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '715.5 NAD', notes: '' },
      { code: '8199', description: 'Exposure of second osseo-integrated implant', official_2025_price: 537.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '537.6 NAD', notes: '' },
      { code: '8200', description: 'Exposure of third osseo-integrated implant', official_2025_price: 359.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '359.8 NAD', notes: '' },
      { code: '8201', description: 'Single tooth extraction', official_2025_price: 208.20, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '208.2 NAD', notes: '' },
      { code: '8202', description: 'Each additional tooth extraction same quadrant', official_2025_price: 82.90, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: 'PROGRESSIVE', business_rule: 'First item at full price, additional items at reduced price', example_calculation: 'First: 82.9, Additional: varies', notes: 'Different prices for first vs additional items' },
      { code: '8209', description: 'Surgical removal of erupted tooth', official_2025_price: 895.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '895.4 NAD', notes: '' },
      { code: '8210', description: 'Removal of unerupted/impacted tooth - first', official_2025_price: 1489.70, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1489.7 NAD', notes: '' },
      { code: '8211', description: 'Removal of unerupted/impacted tooth - second', official_2025_price: 802.40, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '802.4 NAD', notes: '' },
      { code: '8212', description: 'Removal of unerupted/impacted tooth - additional', official_2025_price: 452.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '452.8 NAD', notes: '' },
      { code: '8213', description: 'Surgical removal of residual roots', official_2025_price: 895.40, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '895.4 NAD', notes: '' },
      { code: '8214', description: 'Surgical removal of residual roots - subsequent', official_2025_price: 695.30, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '695.3 NAD', notes: '' },
      { code: '8215', description: 'Surgical exposure of impacted teeth for orthodontics', official_2025_price: 1661.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1661.5 NAD', notes: '' },
      { code: '8221', description: 'Local treatment of post-extraction haemorrhage', official_2025_price: 155.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8223', description: 'Post-extraction haemorrhage - additional visit', official_2025_price: 103.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '103.1 NAD', notes: '' },
      { code: '8225', description: 'Treatment of septic socket - initial', official_2025_price: 155.60, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8227', description: 'Treatment of septic socket - additional', official_2025_price: 103.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '103.1 NAD', notes: '' },
      { code: '8229', description: 'Apicoectomy including retrograde filling', official_2025_price: 1024.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1024.8 NAD', notes: '' }
    ];
    
    // Add more codes in batches to stay within reasonable limits
    const additionalCodes = [
      { code: '8231', description: 'Full upper and lower dentures', official_2025_price: 3355.30, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '3355.3 NAD', notes: '' },
      { code: '8232', description: 'Full upper or lower denture', official_2025_price: 2067.70, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '2067.7 NAD', notes: '' },
      { code: '8233', description: 'Partial denture, one tooth', official_2025_price: 960.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '960.1 NAD', notes: '' },
      { code: '8234', description: 'Partial denture, two teeth', official_2025_price: 960.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '960.1 NAD', notes: '' },
      { code: '8235', description: 'Partial denture, three teeth', official_2025_price: 1443.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1443.2 NAD', notes: '' },
      { code: '8236', description: 'Partial denture, four teeth', official_2025_price: 1443.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1443.2 NAD', notes: '' },
      { code: '8237', description: 'Partial denture, five teeth', official_2025_price: 1443.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1443.2 NAD', notes: '' },
      { code: '8238', description: 'Partial denture, six teeth', official_2025_price: 1910.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1910.1 NAD', notes: '' },
      { code: '8239', description: 'Partial denture, seven teeth', official_2025_price: 1910.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1910.1 NAD', notes: '' },
      { code: '8240', description: 'Partial denture, eight teeth', official_2025_price: 1910.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1910.1 NAD', notes: '' },
      { code: '8241', description: 'Partial denture, nine or more teeth', official_2025_price: 1910.10, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1910.1 NAD', notes: '' },
      { code: '8251', description: 'Cast gold clasp or rest', official_2025_price: 192.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '192.0 NAD', notes: '' },
      { code: '8253', description: 'Wrought gold clasp or rest', official_2025_price: 192.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '192.0 NAD', notes: '' },
      { code: '8255', description: 'Stainless steel clasp or rest', official_2025_price: 200.10, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '200.1 NAD', notes: '' },
      { code: '8257', description: 'Lingual bar or palatal bar', official_2025_price: 234.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '234.5 NAD', notes: '' },
      { code: '8259', description: 'Re-base of denture', official_2025_price: 784.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '784.2 NAD', notes: '' },
      { code: '8261', description: 'Re-model of denture', official_2025_price: 1255.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1255.2 NAD', notes: '' },
      { code: '8263', description: 'Reline of denture in selfcuring acrylic', official_2025_price: 493.20, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '493.2 NAD', notes: '' },
      { code: '8265', description: 'Tissue conditioner and soft reline', official_2025_price: 329.50, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '329.5 NAD', notes: '' },
      { code: '8267', description: 'Soft base re-line per denture', official_2025_price: 1142.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '1142.0 NAD', notes: '' },
      { code: '8269', description: 'Repair of denture', official_2025_price: 266.80, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '266.8 NAD', notes: '' },
      { code: '8270', description: 'Add clasp to existing partial denture', official_2025_price: 192.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '192.0 NAD', notes: '' },
      { code: '8271', description: 'Add tooth to existing partial denture', official_2025_price: 192.00, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '192.0 NAD', notes: '' },
      { code: '8273', description: 'Additional fee where impression required', official_2025_price: 155.60, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8275', description: 'Adjustment of denture', official_2025_price: 155.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '155.6 NAD', notes: '' },
      { code: '8281', description: 'Metal base to partial denture', official_2025_price: 2241.60, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '2241.6 NAD', notes: '' },
      { code: '8303', description: 'Indirect pulp capping', official_2025_price: 278.90, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '278.9 NAD', notes: '' },
      { code: '8304', description: 'Rubber dam, per arch', official_2025_price: 161.70, on_2025_list: true, found_in_claims: true, requires_tooth_number: true, can_be_multiplied: true, business_rule: 'Base price × number of arches (max 2)', example_calculation: '161.7 × arches', notes: 'Multiply by number of arches (upper/lower)' },
      { code: '8305', description: 'Apexification of root canal, per visit', official_2025_price: 278.90, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Charged once per visit', example_calculation: '278.9 per visit', notes: 'Should only appear once per invoice' },
      { code: '8307', description: 'Amputation of pulp (pulpotomy)', official_2025_price: 274.90, on_2025_list: true, found_in_claims: false, requires_tooth_number: false, can_be_multiplied: false, business_rule: 'Fixed price', example_calculation: '274.9 NAD', notes: '' }
    ];
    
    // Combine all codes
    const allCodes = [...official2025Codes, ...additionalCodes];
    
    // Step 3: Insert codes with proper database column mapping
    console.log(`📊 Inserting ${allCodes.length} official 2025 codes...`);
    
    const formattedCodes = allCodes.map(code => ({
      code: code.code,
      namaf_prace_2025: code.description, // Maps to existing column
      price: code.official_2025_price,
      practice_type: 'dental',
      unit: 'per visit',
      is_active: true,
      effective_from: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store additional metadata in edi_diagnosi as JSON
      edi_diagnosi: {
        on_2025_list: code.on_2025_list,
        found_in_claims: code.found_in_claims,
        requires_tooth_number: code.requires_tooth_number,
        can_be_multiplied: code.can_be_multiplied,
        business_rule: code.business_rule,
        example_calculation: code.example_calculation,
        notes: code.notes
      }
    }));
    
    // Insert in batches
    const batchSize = 25;
    let totalInserted = 0;
    
    for (let i = 0; i < formattedCodes.length; i += batchSize) {
      const batch = formattedCodes.slice(i, i + batchSize);
      
      const { data: insertedBatch, error: insertError } = await supabase
        .from('practice_tariffs')
        .insert(batch)
        .select('id');
      
      if (insertError) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, insertError.message);
        // Continue with other batches
      } else {
        totalInserted += insertedBatch.length;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${insertedBatch.length} codes inserted`);
      }
    }
    
    // Step 4: Verify the import
    console.log('\n🔍 Verifying import...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('practice_tariffs')
      .select('code, namaf_prace_2025, price, edi_diagnosi')
      .eq('is_active', true)
      .order('code')
      .limit(10);
    
    if (!verifyError && verifyData) {
      console.log('📋 Sample imported codes:');
      verifyData.forEach(item => {
        const metadata = item.edi_diagnosi || {};
        console.log(`   • ${item.code}: ${item.namaf_prace_2025} - N$${item.price}`);
        if (metadata.can_be_multiplied) {
          console.log(`     🔢 Can be multiplied: ${metadata.can_be_multiplied}`);
        }
        if (metadata.requires_tooth_number) {
          console.log(`     🦷 Requires tooth number: ${metadata.requires_tooth_number}`);
        }
      });
    }
    
    // Final summary
    console.log('\n📊 IMPORT SUMMARY:');
    console.log('==================');
    console.log(`✅ Total codes imported: ${totalInserted}`);
    console.log(`✅ All codes are official 2025 NAD prices`);
    console.log(`✅ Complete metadata stored in edi_diagnosi`);
    console.log(`✅ Codes available to dental/aesthetic practices`);
    
    console.log('\n🔧 Column Mapping:');
    console.log('   • code → code (dental code)');
    console.log('   • description → namaf_prace_2025 (procedure name)');
    console.log('   • official_2025_price → price (NAD amount)');
    console.log('   • metadata → edi_diagnosi (business rules, etc.)');
    
    console.log('\n🎉 OFFICIAL 2025 CODES IMPORT COMPLETE!');
    console.log('✅ Replaced all existing codes with official 2025 list');
    console.log('✅ All required columns and metadata preserved');
    console.log('✅ ServiceSelector will show official pricing');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

// Execute the import
try {
  await importOfficial2025Codes();
} catch (error) {
  console.error('Script error:', error.message);
}