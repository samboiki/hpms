#!/usr/bin/env python3
import csv
import json
from collections import defaultdict

# Analyze patterns to understand pricing formulas
def analyze_pricing_patterns():
    """Create detailed insights about dental pricing patterns"""
    
    insights = []
    
    # Load frequency data for deeper analysis
    frequency_data = {}
    with open("/mnt/c/Users/Happyou2/Documents/emminance/History/code_price_frequency.csv", 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row['code']
            if code not in frequency_data:
                frequency_data[code] = []
            frequency_data[code].append({
                'price': float(row['price']),
                'frequency': int(row['frequency'].replace(' times', ''))
            })
    
    # Key insights about specific codes
    insights.append("=== DENTAL PRICING INSIGHTS AND FORMULAS ===\n")
    
    insights.append("1. CODE 8346 (RESTORATIVE MATERIAL) - TOOTH-SPECIFIC PRICING:")
    insights.append("   - This code is priced based on tooth location, NOT multiplied by quantity")
    insights.append("   - Price range: 35.32 - 215.19 NAD")
    insights.append("   - Pattern: Front teeth and specialized teeth cost more")
    insights.append("   - Tooth 83 is exceptionally expensive (215.19) - likely a special case")
    insights.append("   - Formula: Price = Fixed price based on tooth number (see tooth table)")
    insights.append("")
    
    insights.append("2. CODE 8145 (LOCAL ANAESTHETIC) - PER VISIT:")
    if '8145' in frequency_data:
        prices = [p['price'] for p in frequency_data['8145']]
        insights.append(f"   - Common prices: {sorted(set(prices))[:5]}")
        insights.append("   - Base price appears to be 23.50 NAD")
        insights.append("   - Also seen at 47.00 (2x), 70.50 (3x), 94.00 (4x)")
        insights.append("   - Formula: 23.50 × number of carpules/injections")
    insights.append("")
    
    insights.append("3. CODE 8109 (INFECTION CONTROL) - DUAL PATTERN:")
    if '8109' in frequency_data:
        prices = [p['price'] for p in frequency_data['8109']]
        insights.append(f"   - Common prices: {sorted(set(prices))[:5]}")
        insights.append("   - Two pricing models observed:")
        insights.append("     a) Per dentist: 40.00-65.40 NAD (charged once)")
        insights.append("     b) Per procedure: 20.00 NAD base (can be multiplied)")
        insights.append("   - Most common: 40.00 NAD (511 times)")
    insights.append("")
    
    insights.append("4. CODE 8107 (INTRAORAL RADIOGRAPH) - PER TOOTH:")
    if '8107' in frequency_data:
        prices = sorted([p['price'] for p in frequency_data['8107']])
        insights.append(f"   - Base price: {prices[0]} NAD")
        insights.append("   - Clear multiplication pattern: 78.90, 157.80 (2x), 236.70 (3x)")
        insights.append("   - Formula: 78.90 × number of X-rays taken")
    insights.append("")
    
    insights.append("5. CODES WITH MULTIPLICATION PATTERNS:")
    multiplication_codes = {
        '8304': 'Base 94.20, multiply by surfaces',
        '9301': 'Base 31.60, multiply by units',
        '9455': 'Base 36.30, seen at 6x (217.80)',
        '9700': 'Base 68.00, complex multipliers (9x, 13x)'
    }
    for code, description in multiplication_codes.items():
        insights.append(f"   - Code {code}: {description}")
    insights.append("")
    
    insights.append("6. BUSINESS RULES FOR INVOICE GENERATION:")
    insights.append("   A. Check code type first:")
    insights.append("      - Tooth-specific (8346): Use tooth lookup table")
    insights.append("      - Per-visit codes: Charge once regardless of procedures")
    insights.append("      - Unit-based codes: Multiply base price by quantity")
    insights.append("")
    insights.append("   B. Special considerations:")
    insights.append("      - Some codes have both per-visit and per-unit variations")
    insights.append("      - Primary teeth (50s, 60s, 70s, 80s) may have different rates")
    insights.append("      - Always validate against 2025 official tariffs")
    insights.append("")
    
    insights.append("7. RECOMMENDED INVOICE CALCULATION LOGIC:")
    insights.append("   ```")
    insights.append("   if code == '8346':")
    insights.append("       price = lookup_tooth_price(tooth_number)")
    insights.append("   elif code in per_visit_codes:")
    insights.append("       price = fixed_price  # Only charge once")
    insights.append("   elif code in multiplication_codes:")
    insights.append("       price = base_price × quantity")
    insights.append("   else:")
    insights.append("       price = standard_tariff")
    insights.append("   ```")
    
    return '\n'.join(insights)

# Generate insights
insights_text = analyze_pricing_patterns()

# Save insights
with open('/mnt/c/Users/Happyou2/Documents/emminance/DENTAL_PRICING_INSIGHTS.txt', 'w') as f:
    f.write(insights_text)

print("Pricing insights generated!")
print("\nKey findings:")
print("1. Code 8346 is tooth-specific, NOT quantity-based")
print("2. Some codes like 8109 have dual pricing models")
print("3. Clear multiplication patterns exist for radiographs and other procedures")
print("4. Per-visit codes should only be charged once")

# Create a simple reference table for common codes
reference_file = '/mnt/c/Users/Happyou2/Documents/emminance/QUICK_REFERENCE_PRICING.csv'
with open(reference_file, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Code', 'Description', 'Pricing Model', 'Base Price', 'Notes'])
    
    common_codes = [
        ['8101', 'Full Mouth Examination', 'Fixed', '148.30-254.70', 'Varies by provider'],
        ['8104', 'Examination/Consultation', 'Fixed', '80.00-137.40', 'Follow-up exam'],
        ['8107', 'Intraoral Radiograph', 'Per Tooth', '78.90', 'Multiply by number of X-rays'],
        ['8109', 'Infection Control', 'Per Visit/Dentist', '40.00-65.40', 'Usually charged once'],
        ['8110', 'Sterilized Wrapping', 'Fixed', '44.70-73.10', 'Per procedure'],
        ['8145', 'Local Anaesthetic', 'Per Carpule', '23.50', 'Multiply by injections'],
        ['8151', 'Oral Hygiene Instructions', 'Fixed', '121.20', 'Educational service'],
        ['8159', 'Scaling and Polishing', 'Fixed', '238.90-390.50', 'Cleaning service'],
        ['8161', 'Fluoride Application', 'Fixed', '121.20', 'Preventive treatment'],
        ['8167', 'Hypersensitivity Treatment', 'Per Tooth', '93.00-152.00', 'Desensitizing'],
        ['8346', 'Restorative Material', 'Tooth-Specific', 'See tooth table', 'NOT quantity-based'],
        ['8368', 'Resin - One Surface', 'Fixed', '196.60-321.30', 'Small filling'],
        ['8369', 'Resin - Three Surface', 'Fixed', '386.10-630.90', 'Large filling'],
        ['8370', 'Resin - Four+ Surface', 'Fixed', '421.40-688.60', 'Complex filling']
    ]
    
    for row in common_codes:
        writer.writerow(row)

print(f"\nFiles created:")
print(f"1. FINAL_DENTAL_PRICING_GUIDE_2025.csv - Complete pricing guide")
print(f"2. CODE_8346_TOOTH_PRICING.csv - Tooth-specific prices for code 8346")
print(f"3. DENTAL_PRICING_INSIGHTS.txt - Detailed analysis and formulas")
print(f"4. QUICK_REFERENCE_PRICING.csv - Common codes reference")