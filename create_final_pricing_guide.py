#!/usr/bin/env python3
import csv
import json
import os

# Load the comprehensive pricing rules
with open('/mnt/c/Users/Happyou2/Documents/emminance/comprehensive_pricing_rules.json', 'r') as f:
    pricing_rules = json.load(f)

# Create a detailed CSV file with all pricing information
output_file = '/mnt/c/Users/Happyou2/Documents/emminance/FINAL_DENTAL_PRICING_GUIDE_2025.csv'

with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    
    # Write header
    writer.writerow([
        'Code', 
        'Description', 
        'Pricing Type', 
        'Base Price (NAD)', 
        'Pricing Rule', 
        'Multipliers/Variations',
        'Special Notes',
        'Example Calculations'
    ])
    
    # Process each pricing rule
    for rule in pricing_rules:
        code = rule['code']
        description = rule.get('description', '')
        rule_type = rule['rule_type']
        base_price = rule.get('base_price', 'Varies')
        pricing_logic = rule.get('pricing_logic', '')
        
        if code == '8346':
            # Special handling for code 8346 - tooth-specific pricing
            writer.writerow([
                code,
                description,
                'Tooth-Specific',
                'Varies by tooth (35.32 - 215.19)',
                'Price depends on tooth location',
                'See tooth pricing table below',
                'Different teeth have different material requirements',
                'Tooth 11: 50.84, Tooth 47: 46.71, Tooth 36: 45.33'
            ])
            
            # Add tooth-specific pricing details
            writer.writerow(['', '', '', '', '', '', '', ''])
            writer.writerow(['TOOTH PRICING TABLE FOR CODE 8346:', '', '', '', '', '', '', ''])
            writer.writerow(['Tooth Number', 'Price (NAD)', '', '', '', '', '', ''])
            
            if 'tooth_pricing' in rule:
                tooth_data = []
                for tooth, data in rule['tooth_pricing'].items():
                    tooth_data.append((tooth, data['average']))
                
                # Sort by tooth number
                for tooth, price in sorted(tooth_data, key=lambda x: int(x[0])):
                    writer.writerow([f'Tooth {tooth}', f'{price:.2f}', '', '', '', '', '', ''])
            
            writer.writerow(['', '', '', '', '', '', '', ''])
            
        elif rule_type == 'per_visit':
            writer.writerow([
                code,
                description,
                'Per Visit',
                f'{base_price:.2f}',
                'Charged once per visit',
                'Fixed price per visit',
                rule.get('notes', ''),
                f'1 visit = {base_price:.2f} NAD (regardless of procedures)'
            ])
            
        elif rule_type == 'multiplication':
            multipliers = rule.get('common_multipliers', [])
            price_variations = rule.get('price_variations', [])
            
            multiplier_str = ', '.join([f'x{m}' for m in multipliers[:5]])
            example_calc = f'Base: {base_price:.2f}'
            if multipliers:
                example_calc += f', 2 units: {base_price * 2:.2f}, 3 units: {base_price * 3:.2f}'
            
            writer.writerow([
                code,
                description,
                'Unit/Tooth Based',
                f'{base_price:.2f}',
                'Price × number of units/teeth',
                multiplier_str,
                f'Common prices: {", ".join([str(p) for p in price_variations[:5]])}',
                example_calc
            ])
    
    # Add summary section
    writer.writerow(['', '', '', '', '', '', '', ''])
    writer.writerow(['PRICING SUMMARY AND BUSINESS RULES:', '', '', '', '', '', '', ''])
    writer.writerow(['', '', '', '', '', '', '', ''])
    
    # Add key findings
    key_findings = [
        ['1. TOOTH-SPECIFIC PRICING (Code 8346):', '', '', '', '', '', '', ''],
        ['', '- Code 8346 (Restorative Material) has different prices for each tooth', '', '', '', '', '', ''],
        ['', '- Prices range from 35.32 to 215.19 NAD depending on tooth location', '', '', '', '', '', ''],
        ['', '- Front teeth generally cost more than back teeth', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['2. PER-VISIT CHARGES:', '', '', '', '', '', '', ''],
        ['', '- Code 8109 (Infection Control): 49.20 NAD per visit', '', '', '', '', '', ''],
        ['', '- Code 8145 (Local Anaesthetic): 34.64 NAD per visit', '', '', '', '', '', ''],
        ['', '- These are charged once regardless of number of procedures', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['3. MULTIPLICATION-BASED PRICING:', '', '', '', '', '', '', ''],
        ['', '- Codes like 8107, 9301, etc. multiply base price by number of units', '', '', '', '', '', ''],
        ['', '- Common multipliers are x2, x3, x4 for multiple teeth/units', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['4. IMPORTANT NOTES FOR INVOICE GENERATION:', '', '', '', '', '', '', ''],
        ['', '- Always check tooth number for code 8346', '', '', '', '', '', ''],
        ['', '- Count number of teeth/units for multiplication codes', '', '', '', '', '', ''],
        ['', '- Per-visit codes should only appear once per invoice', '', '', '', '', '', ''],
        ['', '- Use the 2025 official tariffs as the base for calculations', '', '', '', '', '', '']
    ]
    
    for row in key_findings:
        writer.writerow(row)

print(f"Comprehensive pricing guide created: {output_file}")

# Also create a simplified tooth pricing table for code 8346
tooth_price_file = '/mnt/c/Users/Happyou2/Documents/emminance/CODE_8346_TOOTH_PRICING.csv'
with open(tooth_price_file, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Tooth Number', 'Price (NAD)', 'Tooth Type'])
    
    # Find code 8346 in rules
    for rule in pricing_rules:
        if rule['code'] == '8346' and 'tooth_pricing' in rule:
            tooth_data = []
            for tooth, data in rule['tooth_pricing'].items():
                # Determine tooth type
                tooth_num = int(tooth)
                if tooth_num in [11, 12, 13, 21, 22, 23, 31, 32, 41, 42]:
                    tooth_type = 'Front (Incisor/Canine)'
                elif tooth_num in [14, 15, 24, 25, 34, 35, 44, 45]:
                    tooth_type = 'Premolar'
                elif tooth_num in [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48]:
                    tooth_type = 'Molar'
                else:
                    tooth_type = 'Primary/Other'
                
                tooth_data.append((tooth_num, data['average'], tooth_type))
            
            # Sort by tooth number
            for tooth, price, tooth_type in sorted(tooth_data):
                writer.writerow([tooth, f'{price:.2f}', tooth_type])

print(f"Tooth pricing table created: {tooth_price_file}")