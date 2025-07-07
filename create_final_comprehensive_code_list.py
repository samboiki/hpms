#!/usr/bin/env python3
import csv
import os
import re
from collections import defaultdict

# 2025 Official tariff codes (same as before)
official_2025_codes = {
    '8101': {'description': 'Full mouth examination, charting and treatment planning', 'price': 254.70},
    '8102': {'description': 'Comprehensive consultation', 'price': 479.00},
    '8104': {'description': 'Examination or consultation for a specific problem', 'price': 137.40},
    '8106': {'description': 'Provision of a written treatment plan and quotation', 'price': 345.60},
    '8107': {'description': 'Intra-oral radiographs, per film', 'price': 135.40},
    '8108': {'description': 'Maximum for 8107 is 7 radiographs', 'price': 1061.20},
    '8109': {'description': 'Infection control, per dentist/hygienist/assistant, per visit', 'price': 34.40},
    '8110': {'description': 'Provision of sterilised and wrapped instrumentation', 'price': 76.80},
    '8113': {'description': 'Occlusal radiographs', 'price': 234.50},
    '8114': {'description': 'Hand-wrist radiograph', 'price': 549.80},
    '8115': {'description': 'Extra-oral radiograph, per film', 'price': 549.80},
    '8117': {'description': 'Study models - unmounted', 'price': 151.60},
    '8119': {'description': 'Study models - mounted on adjustable articulator', 'price': 369.90},
    '8121': {'description': 'Diagnostic photographs, per photograph', 'price': 151.60},
    '8129': {'description': 'Additional fee for emergency treatment outside hours', 'price': 513.40},
    '8131': {'description': 'Palliative treatment for dental pain', 'price': 208.20},
    '8132': {'description': 'Gross pulpal debridement', 'price': 339.60},
    '8133': {'description': 'Re-cementing of inlays, crowns or bridges', 'price': 208.20},
    '8135': {'description': 'Removal of inlays and crowns', 'price': 412.30},
    '8136': {'description': 'Access through prosthetic crown', 'price': 188.00},
    '8137': {'description': 'Temporary crown emergency procedure', 'price': 711.50},
    '8140': {'description': 'Fee for treatment at venue other than surgery', 'price': 337.50},
    '8141': {'description': 'Inhalation sedation - first quarter-hour', 'price': 155.60},
    '8143': {'description': 'Inhalation sedation - additional quarter-hour', 'price': 76.80},
    '8144': {'description': 'Intravenous sedation', 'price': 93.00},
    '8145': {'description': 'Local anaesthetic, per visit', 'price': 40.40},
    '8147': {'description': 'Use of monitoring equipment for IV sedation', 'price': 329.50},
    '8151': {'description': 'Oral hygiene instructions', 'price': 208.20},
    '8153': {'description': 'Follow-up for oral hygiene re-evaluation', 'price': 155.60},
    '8155': {'description': 'Polishing only - complete dentition', 'price': 208.20},
    '8157': {'description': 'Re-burnishing and polishing of restorations', 'price': 208.20},
    '8159': {'description': 'Scaling and polishing', 'price': 410.30},
    '8161': {'description': 'Topical application of fluoride', 'price': 208.20},
    '8163': {'description': 'Fissure sealant, per tooth', 'price': 135.40},
    '8167': {'description': 'Treatment of hypersensitive dentine, per visit', 'price': 159.70},
    '8169': {'description': 'Bite plate for TMJ dysfunction', 'price': 802.40},
    '8170': {'description': 'Minor occlusal adjustment', 'price': 456.80},
    '8173': {'description': 'Space maintainer - fixed, per abutment', 'price': 390.10},
    '8175': {'description': 'Space maintainer - removable', 'price': 493.20},
    '8176': {'description': 'Periodontal screening', 'price': 252.70},
    '8177': {'description': 'Oral hygiene instruction for periodontally compromised', 'price': 315.30},
    '8178': {'description': 'Oral hygiene evaluation for periodontally compromised', 'price': 169.80},
    '8179': {'description': 'Plaque removal for periodontally compromised', 'price': 236.50},
    '8180': {'description': 'Scaling and polishing for periodontally compromised', 'price': 444.70},
    '8182': {'description': 'Root planing with/without curettage, per quadrant', 'price': 832.80},
    '8183': {'description': 'Intra-muscular or sub-cutaneous injection', 'price': 93.00},
    '8184': {'description': 'Root planing with/without curettage, per sextant', 'price': 660.90},
    '8185': {'description': 'Gingivectomy-gingivoplasty, per quadrant', 'price': 1087.40},
    '8186': {'description': 'Gingivectomy-gingivoplasty, per sextant', 'price': 865.10},
    '8188': {'description': 'Biopsy - intra-oral', 'price': 529.60},
    '8192': {'description': 'Appositioning of soft tissue injuries', 'price': 1024.80},
    '8193': {'description': 'Osseo-integrated abutment restoration', 'price': 3082.40},
    '8194': {'description': 'Placement of single osseo-integrated implant', 'price': 1932.30},
    '8195': {'description': 'Placement of second osseo-integrated implant', 'price': 1445.20},
    '8196': {'description': 'Placement of third osseo-integrated implant', 'price': 962.10},
    '8198': {'description': 'Exposure of single osseo-integrated implant', 'price': 715.50},
    '8199': {'description': 'Exposure of second osseo-integrated implant', 'price': 537.60},
    '8200': {'description': 'Exposure of third osseo-integrated implant', 'price': 359.80},
    '8201': {'description': 'Single tooth extraction', 'price': 208.20},
    '8202': {'description': 'Each additional tooth extraction same quadrant', 'price': 82.90},
    '8209': {'description': 'Surgical removal of erupted tooth', 'price': 895.40},
    '8210': {'description': 'Removal of unerupted/impacted tooth - first', 'price': 1489.70},
    '8211': {'description': 'Removal of unerupted/impacted tooth - second', 'price': 802.40},
    '8212': {'description': 'Removal of unerupted/impacted tooth - additional', 'price': 452.80},
    '8213': {'description': 'Surgical removal of residual roots', 'price': 895.40},
    '8214': {'description': 'Surgical removal of residual roots - subsequent', 'price': 695.30},
    '8215': {'description': 'Surgical exposure of impacted teeth for orthodontics', 'price': 1661.50},
    '8221': {'description': 'Local treatment of post-extraction haemorrhage', 'price': 155.60},
    '8223': {'description': 'Post-extraction haemorrhage - additional visit', 'price': 103.10},
    '8225': {'description': 'Treatment of septic socket - initial', 'price': 155.60},
    '8227': {'description': 'Treatment of septic socket - additional', 'price': 103.10},
    '8229': {'description': 'Apicoectomy including retrograde filling', 'price': 1024.80},
    '8231': {'description': 'Full upper and lower dentures', 'price': 3355.30},
    '8232': {'description': 'Full upper or lower denture', 'price': 2067.70},
    '8233': {'description': 'Partial denture, one tooth', 'price': 960.10},
    '8234': {'description': 'Partial denture, two teeth', 'price': 960.10},
    '8235': {'description': 'Partial denture, three teeth', 'price': 1443.20},
    '8236': {'description': 'Partial denture, four teeth', 'price': 1443.20},
    '8237': {'description': 'Partial denture, five teeth', 'price': 1443.20},
    '8238': {'description': 'Partial denture, six teeth', 'price': 1910.10},
    '8239': {'description': 'Partial denture, seven teeth', 'price': 1910.10},
    '8240': {'description': 'Partial denture, eight teeth', 'price': 1910.10},
    '8241': {'description': 'Partial denture, nine or more teeth', 'price': 1910.10},
    '8251': {'description': 'Cast gold clasp or rest', 'price': 192.00},
    '8253': {'description': 'Wrought gold clasp or rest', 'price': 192.00},
    '8255': {'description': 'Stainless steel clasp or rest', 'price': 200.10},
    '8257': {'description': 'Lingual bar or palatal bar', 'price': 234.50},
    '8259': {'description': 'Re-base of denture', 'price': 784.20},
    '8261': {'description': 'Re-model of denture', 'price': 1255.20},
    '8263': {'description': 'Reline of denture in selfcuring acrylic', 'price': 493.20},
    '8265': {'description': 'Tissue conditioner and soft reline', 'price': 329.50},
    '8267': {'description': 'Soft base re-line per denture', 'price': 1142.00},
    '8269': {'description': 'Repair of denture', 'price': 266.80},
    '8270': {'description': 'Add clasp to existing partial denture', 'price': 192.00},
    '8271': {'description': 'Add tooth to existing partial denture', 'price': 192.00},
    '8273': {'description': 'Additional fee where impression required', 'price': 155.60},
    '8275': {'description': 'Adjustment of denture', 'price': 155.60},
    '8281': {'description': 'Metal base to partial denture', 'price': 2241.60},
    '8303': {'description': 'Indirect pulp capping', 'price': 278.90},
    '8304': {'description': 'Rubber dam, per arch', 'price': 161.70},
    '8305': {'description': 'Apexification of root canal, per visit', 'price': 278.90},
    '8307': {'description': 'Amputation of pulp (pulpotomy)', 'price': 274.90},
    '8325': {'description': 'Bleaching of non-vital teeth, per tooth', 'price': 491.20},
    '8327': {'description': 'Additional visit for bleaching non-vital tooth', 'price': 234.50},
    '8328': {'description': 'Each additional canal - anteriors and premolars', 'price': 390.10},
    '8329': {'description': 'Each additional canal - anteriors and premolars', 'price': 479.00},
    '8330': {'description': 'Removal of fractured post or instrument', 'price': 274.90},
    '8332': {'description': 'Single-canal tooth, per visit', 'price': 208.20},
    '8333': {'description': 'Multi-canal tooth, per visit', 'price': 289.00},
    '8334': {'description': 'Re-preparation of previously obturated canal', 'price': 309.30},
    '8335': {'description': 'First canal - anteriors and premolars', 'price': 939.90},
    '8336': {'description': 'First canal - molars', 'price': 1297.60},
    '8337': {'description': 'Each additional canal - molars', 'price': 390.10},
    '8338': {'description': 'First canal - anteriors and premolars', 'price': 1445.20},
    '8339': {'description': 'First canal - molars', 'price': 1986.90},
    '8340': {'description': 'Each additional canal - molars', 'price': 479.00},
    '8341': {'description': 'Amalgam - one surface', 'price': 373.90},
    '8342': {'description': 'Amalgam - two surfaces', 'price': 468.90},
    '8343': {'description': 'Amalgam - three surfaces', 'price': 563.90},
    '8344': {'description': 'Amalgam - four or more surfaces', 'price': 632.60},
    '8345': {'description': 'Preformed post retention, per post', 'price': 410.30},
    '8346': {'description': 'RESTORATIVE MATERIAL (TOOTH-SPECIFIC)', 'price': 'VARIES'},
    '8347': {'description': 'Pin retention for restoration, first pin', 'price': 202.10},
    '8348': {'description': 'Pin retention, each additional pin', 'price': 192.00},
    '8349': {'description': 'Carving plastic restoration for prosthesis', 'price': 82.90},
    '8351': {'description': 'Resin - one surface, anterior', 'price': 412.30},
    '8352': {'description': 'Resin - two surfaces, anterior', 'price': 523.50},
    '8353': {'description': 'Resin - three surfaces, anterior', 'price': 620.50},
    '8354': {'description': 'Resin - four or more surfaces, anterior', 'price': 695.30},
    '8355': {'description': 'Composite veneers (Direct)', 'price': 723.60},
    '8356': {'description': 'Bridge per abutment - Maryland type', 'price': 925.80},
    '8357': {'description': 'Preformed metal crown', 'price': 422.40},
    '8361': {'description': 'Inlay, metallic - one surface', 'price': 636.70},
    '8362': {'description': 'Inlay, metallic - two surfaces', 'price': 925.70},
    '8363': {'description': 'Inlay, metallic - three surfaces', 'price': 1538.20},
    '8364': {'description': 'Inlay, metallic - four or more surfaces', 'price': 1863.60},
    '8366': {'description': 'Pin retention as part of cast restoration', 'price': 309.20},
    '8367': {'description': 'Resin - one surface, posterior', 'price': 448.70},
    '8368': {'description': 'Resin - two surfaces, posterior', 'price': 551.80},
    '8369': {'description': 'Resin - three surfaces, posterior', 'price': 663.00},
    '8370': {'description': 'Resin - four or more surfaces, posterior', 'price': 723.60},
    '8371': {'description': 'Inlay, ceramic/resin - one surface', 'price': 760.00},
    '8372': {'description': 'Inlay, ceramic/resin - two surfaces', 'price': 1125.80},
    '8373': {'description': 'Inlay, ceramic/resin - three surfaces', 'price': 1851.40},
    '8374': {'description': 'Inlay, ceramic/resin - four or more surfaces', 'price': 2241.60},
    '8376': {'description': 'Prefabricated post and core', 'price': 1129.90},
    '8391': {'description': 'Cast post and core - single', 'price': 477.00},
    '8393': {'description': 'Cast post and core - double', 'price': 760.00},
    '8395': {'description': 'Cast post and core - triple', 'price': 1101.60},
    '8396': {'description': 'Cast coping', 'price': 311.30},
    '8397': {'description': 'Cast core with pins', 'price': 760.00},
    '8398': {'description': 'Core build-up, including any pins', 'price': 925.70},
    '8401': {'description': 'Cast full crown', 'price': 2379.00},
    '8403': {'description': 'Cast three-quarter crown', 'price': 2379.00},
    '8407': {'description': 'Acrylic veneered crown', 'price': 2379.00},
    '8409': {'description': 'Porcelain jacket crown', 'price': 2379.00},
    '8411': {'description': 'Porcelain veneered crown', 'price': 2379.00},
    '8413': {'description': 'Facing replacement', 'price': 464.90},
    '8414': {'description': 'Additional fee for crown within clasp', 'price': 135.40},
    '8420': {'description': 'Sanitary pontic', 'price': 1156.20},
    '8422': {'description': 'Posterior pontic', 'price': 1538.20},
    '8424': {'description': 'Anterior pontic', 'price': 1940.40},
    '8570': {'description': 'Computer generated ceramic restoration', 'price': 2374.90},
    '8811': {'description': 'Tracing and analysis of extra-oral film', 'price': 62.60},
    '8812': {'description': 'CBCT capture limited field - less than one jaw', 'price': 1155.50},
    '8813': {'description': 'CBCT capture one full arch - mandible', 'price': 1290.70},
    '8814': {'description': 'CBCT capture one full arch - maxilla', 'price': 1290.70},
    '8815': {'description': 'CBCT capture both arches without orbits', 'price': 1352.10},
    '8816': {'description': 'CBCT capture for TMJ series', 'price': 1352.10},
    '8817': {'description': 'CBCT capture maxilla with orbits', 'price': 1475.10},
    '8818': {'description': 'CBCT capture both arches with orbits', 'price': 1647.20},
    '8819': {'description': 'Interpretation of diagnostic image', 'price': 491.60},
    '8820': {'description': 'CBCT image capture limited - less than one jaw', 'price': 693.20},
    '8821': {'description': 'CBCT image capture one arch - mandible', 'price': 774.40},
    '8822': {'description': 'CBCT image capture one arch - maxilla', 'price': 774.40},
    '8823': {'description': 'CBCT capture both arches without orbits', 'price': 811.30},
    '8824': {'description': 'CBCT capture for TMJ series', 'price': 811.30},
    '8825': {'description': 'CBCT capture maxilla with orbits', 'price': 885.00},
    '8826': {'description': 'CBCT capture both arches with orbits', 'price': 988.30}
}

def get_claims_analysis():
    """Get analysis from claims data"""
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    code_data = defaultdict(lambda: {
        'found_in_claims': False,
        'prices_seen': [],
        'has_tooth_info': False,
        'tooth_numbers': set(),
        'diagnoses': set(),
        'multiplication_detected': False,
        'multipliers': []
    })
    
    # Process all .DAT files
    for filename in os.listdir(directory):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory, filename)
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    for line in file:
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            if len(fields) >= 18:
                                code = fields[12].strip()
                                price = fields[13].strip()
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                
                                if code and price:
                                    try:
                                        price_float = float(price)
                                        
                                        code_data[code]['found_in_claims'] = True
                                        code_data[code]['prices_seen'].append(price_float)
                                        code_data[code]['diagnoses'].add(diagnosis)
                                        
                                        # Check for tooth information
                                        tooth_match = re.search(r'TOOTH:\s*(\d+)', diagnosis)
                                        if tooth_match:
                                            code_data[code]['has_tooth_info'] = True
                                            code_data[code]['tooth_numbers'].add(tooth_match.group(1))
                                        
                                        # Also check field 35 for tooth info
                                        if len(fields) > 35 and fields[35].strip():
                                            code_data[code]['has_tooth_info'] = True
                                            code_data[code]['tooth_numbers'].add(fields[35].strip())
                                    
                                    except ValueError:
                                        continue
                            
            except Exception as e:
                continue
    
    # Analyze multiplication patterns
    for code, data in code_data.items():
        if data['prices_seen'] and len(set(data['prices_seen'])) > 1:
            unique_prices = sorted(set(data['prices_seen']))
            base_price = min(unique_prices)
            
            multipliers = []
            for price in unique_prices:
                if base_price > 0:
                    ratio = price / base_price
                    if abs(ratio - round(ratio)) < 0.1 and round(ratio) > 1:
                        multipliers.append(round(ratio))
            
            if multipliers:
                data['multiplication_detected'] = True
                data['multipliers'] = sorted(set(multipliers))
    
    return code_data

# Get claims analysis
claims_analysis = get_claims_analysis()

# Create the final comprehensive CSV
output_file = '/mnt/c/Users/Happyou2/Documents/emminance/MASTER_DENTAL_CODES_2025_WITH_BUSINESS_RULES.csv'

with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    
    # Write header
    writer.writerow([
        'Code',
        'Description',
        'Official 2025 Price (NAD)',
        'On 2025 List',
        'Found in Claims',
        'Requires Tooth Number',
        'Can Be Multiplied',
        'Business Rule/Formula',
        'Example Calculation',
        'Notes'
    ])
    
    # Get all codes
    all_codes = set(official_2025_codes.keys()) | set(claims_analysis.keys())
    
    for code in sorted(all_codes):
        # Get official data
        official = official_2025_codes.get(code, {})
        description = official.get('description', 'NOT ON 2025 LIST')
        official_price = official.get('price', 'NOT ON 2025 LIST')
        on_2025_list = 'YES' if code in official_2025_codes else 'NO'
        
        # Get claims data
        claims = claims_analysis.get(code, {})
        found_in_claims = 'YES' if claims.get('found_in_claims', False) else 'NO'
        requires_tooth = 'YES' if claims.get('has_tooth_info', False) else 'NO'
        
        # Determine multiplication and business rules
        can_multiply = 'NO'
        business_rule = 'Fixed price'
        example_calc = f'{official_price} NAD' if official_price != 'NOT ON 2025 LIST' else 'Price not established'
        notes = ''
        
        # Special handling for known codes
        if code == '8346':
            can_multiply = 'NO'
            business_rule = 'TOOTH-SPECIFIC PRICING'
            example_calc = 'Tooth 11: 50.84, Tooth 47: 46.71, Tooth 36: 45.33'
            notes = 'Price varies by tooth location. Use tooth lookup table.'
            
        elif code == '8145':
            can_multiply = 'YES'
            business_rule = 'Base price × number of injections'
            example_calc = '23.50 × 2 = 47.00 (for 2 injections)'
            notes = 'Multiply by number of anaesthetic carpules administered'
            
        elif code == '8107':
            can_multiply = 'YES'
            business_rule = 'Base price × number of X-rays'
            example_calc = '78.90 × 3 = 236.70 (for 3 X-rays)'
            notes = 'Multiply by number of radiographs taken'
            
        elif code == '8109':
            can_multiply = 'SOMETIMES'
            business_rule = 'Usually charged once per visit, but can be per procedure'
            example_calc = '40.00 NAD per visit OR 20.00 × procedures'
            notes = 'Two pricing models observed in claims'
            
        elif 'per film' in description.lower() or 'per photograph' in description.lower():
            can_multiply = 'YES'
            business_rule = f'Base price × number of films/photos'
            example_calc = f'{official_price} × quantity' if official_price != 'NOT ON 2025 LIST' else 'Base price × quantity'
            notes = 'Multiply by number of films or photographs taken'
            
        elif 'per tooth' in description.lower():
            can_multiply = 'YES'
            business_rule = f'Base price × number of teeth'
            example_calc = f'{official_price} × number of teeth' if official_price != 'NOT ON 2025 LIST' else 'Base price × number of teeth'
            notes = 'Multiply by number of teeth treated'
            
        elif 'each additional' in description.lower():
            can_multiply = 'PROGRESSIVE'
            business_rule = 'First item at full price, additional items at reduced price'
            example_calc = f'First: {official_price}, Additional: varies' if official_price != 'NOT ON 2025 LIST' else 'Progressive pricing'
            notes = 'Different prices for first vs additional items'
            
        elif 'per quadrant' in description.lower():
            can_multiply = 'YES'
            business_rule = f'Base price × number of quadrants (max 4)'
            example_calc = f'{official_price} × quadrants' if official_price != 'NOT ON 2025 LIST' else 'Base price × quadrants'
            notes = 'Multiply by number of quadrants treated'
            
        elif 'per sextant' in description.lower():
            can_multiply = 'YES'
            business_rule = f'Base price × number of sextants (max 6)'
            example_calc = f'{official_price} × sextants' if official_price != 'NOT ON 2025 LIST' else 'Base price × sextants'
            notes = 'Multiply by number of sextants treated'
            
        elif 'per arch' in description.lower():
            can_multiply = 'YES'
            business_rule = f'Base price × number of arches (max 2)'
            example_calc = f'{official_price} × arches' if official_price != 'NOT ON 2025 LIST' else 'Base price × arches'
            notes = 'Multiply by number of arches (upper/lower)'
            
        elif 'per visit' in description.lower():
            can_multiply = 'NO'
            business_rule = 'Charged once per visit'
            example_calc = f'{official_price} per visit' if official_price != 'NOT ON 2025 LIST' else 'Fixed price per visit'
            notes = 'Should only appear once per invoice'
            
        elif claims.get('multiplication_detected'):
            can_multiply = 'YES'
            multipliers = claims['multipliers']
            business_rule = f'Base price × quantity (seen: x{", x".join(map(str, multipliers[:3]))})'
            if claims['prices_seen']:
                base = min(claims['prices_seen'])
                example_calc = f'{base:.2f} × 2 = {base * 2:.2f}'
            notes = f'Multiplication pattern detected in claims data'
        
        # Handle codes not on 2025 list
        if on_2025_list == 'NO':
            if claims['prices_seen']:
                avg_price = sum(claims['prices_seen']) / len(claims['prices_seen'])
                business_rule = f'Average price from claims: {avg_price:.2f} NAD'
                example_calc = f'{avg_price:.2f} NAD'
                notes = 'Code not on official 2025 list. Price from practice claims.'
        
        writer.writerow([
            code,
            description[:100],  # Truncate long descriptions
            official_price if isinstance(official_price, str) else f'{official_price:.2f}',
            on_2025_list,
            found_in_claims,
            requires_tooth,
            can_multiply,
            business_rule,
            example_calc,
            notes[:150]  # Truncate long notes
        ])

print(f"Master dental codes file created: {output_file}")
print("\nThis file contains:")
print("- All 179 codes from the 2025 official tariff list")
print("- 29 additional codes found in claims but not on 2025 list")
print("- Business rules for each code")
print("- Multiplication patterns and formulas")
print("- Tooth number requirements")
print("- Example calculations")

# Create a separate summary for codes requiring special attention
special_attention_file = '/mnt/c/Users/Happyou2/Documents/emminance/CODES_REQUIRING_SPECIAL_ATTENTION.csv'

with open(special_attention_file, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Code', 'Issue', 'Action Required'])
    
    # Codes not on 2025 list
    for code in sorted(claims_analysis.keys()):
        if code not in official_2025_codes and claims_analysis[code]['found_in_claims']:
            writer.writerow([code, 'Not on 2025 official list', 'Verify if code is valid/update pricing'])
    
    # Special multiplication cases
    writer.writerow(['8346', 'Tooth-specific pricing', 'Use tooth lookup table - do NOT multiply by quantity'])
    writer.writerow(['8145', 'Injection-based pricing', 'Multiply 23.50 by number of injections'])
    writer.writerow(['8107', 'X-ray based pricing', 'Multiply 78.90 by number of X-rays'])
    writer.writerow(['8109', 'Dual pricing model', 'Usually 40.00 per visit, sometimes 20.00 per procedure'])

print(f"Special attention codes file created: {special_attention_file}")