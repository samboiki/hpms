#!/usr/bin/env python3
"""
Manual dental pricing extraction from PDF using string search and patterns
"""

import re
import csv
import subprocess
import os
from pathlib import Path

def extract_text_with_strings(pdf_path):
    """Extract text using the strings command"""
    try:
        result = subprocess.run(['strings', str(pdf_path)], 
                              capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return result.stdout
        else:
            print(f"Error running strings command: {result.stderr}")
            return None
    except Exception as e:
        print(f"Error extracting with strings: {e}")
        return None

def find_dental_pricing_patterns(text):
    """Find dental pricing patterns in extracted text"""
    
    # Common dental procedure patterns with prices
    patterns = [
        # Pattern 1: Description followed by price on same line
        r'([A-Z][a-zA-Z\s\-/(),]{10,80}?)\s+(\d+\.?\d{0,2})\s*$',
        
        # Pattern 2: Code followed by description and price
        r'(\d{3,6})\s+([A-Z][a-zA-Z\s\-/(),]{10,80}?)\s+(\d+\.?\d{0,2})',
        
        # Pattern 3: Multi-word procedure with price
        r'([A-Z][a-zA-Z\s]{15,100}?)\s+(\d{2,4}\.\d{2})',
        
        # Pattern 4: Dental terms with numeric values
        r'((?:Consultation|Examination|Cleaning|Filling|Extraction|Crown|Bridge|Root\s+Canal|X-ray|Scaling)[a-zA-Z\s\-/(),]{0,50}?)\s+(\d{2,4}\.?\d{0,2})',
    ]
    
    found_items = []
    
    lines = text.split('\n')
    
    for line_num, line in enumerate(lines):
        line = line.strip()
        if len(line) < 10:
            continue
            
        # Try each pattern
        for pattern_num, pattern in enumerate(patterns, 1):
            matches = re.findall(pattern, line, re.IGNORECASE)
            
            for match in matches:
                if len(match) == 2:  # Description and price
                    description, price_str = match
                    code = ""
                elif len(match) == 3:  # Code, description, price
                    code, description, price_str = match
                else:
                    continue
                
                # Clean and validate price
                price_clean = re.sub(r'[^\d.]', '', price_str)
                try:
                    price = float(price_clean)
                    if 10 <= price <= 5000:  # Reasonable price range
                        # Clean description
                        description = re.sub(r'\s+', ' ', description.strip())
                        
                        if len(description) >= 10:
                            found_items.append({
                                'line': line_num + 1,
                                'code': code,
                                'description': description,
                                'price': price,
                                'pattern': pattern_num,
                                'raw_line': line[:100]
                            })
                except ValueError:
                    continue
    
    return found_items

def categorize_dental_service(description):
    """Categorize dental services"""
    
    categories = {
        'Consultation & Examination': [
            'consultation', 'exam', 'assessment', 'evaluation', 'check', 'initial'
        ],
        'Preventive Care': [
            'cleaning', 'prophylaxis', 'scale', 'polish', 'fluoride', 'hygiene'
        ],
        'Restorative': [
            'filling', 'composite', 'amalgam', 'restoration', 'repair', 'inlay', 'onlay'
        ],
        'Oral Surgery': [
            'extraction', 'removal', 'surgical', 'surgery', 'implant', 'oral surgery'
        ],
        'Endodontics': [
            'root canal', 'endodontic', 'pulp', 'nerve', 'apex'
        ],
        'Prosthodontics': [
            'crown', 'bridge', 'denture', 'partial', 'complete', 'prosthetic'
        ],
        'Orthodontics': [
            'braces', 'bracket', 'aligner', 'retainer', 'orthodontic'
        ],
        'Periodontics': [
            'gum', 'periodontal', 'gingivitis', 'pocket', 'perio'
        ],
        'Diagnostic': [
            'x-ray', 'radiograph', 'bitewing', 'panoramic', 'imaging', 'scan'
        ],
        'Cosmetic': [
            'whitening', 'bleach', 'veneer', 'cosmetic', 'aesthetic', 'bonding'
        ]
    }
    
    description_lower = description.lower()
    
    for category, keywords in categories.items():
        if any(keyword in description_lower for keyword in keywords):
            return category
    
    return 'Other'

def create_dental_pricing_table(items, output_path):
    """Create dental pricing table CSV"""
    
    # Remove duplicates and sort
    unique_items = []
    seen = set()
    
    for item in items:
        # Create a key for duplicate detection
        key = (item['description'].lower().strip(), item['price'])
        if key not in seen:
            seen.add(key)
            
            # Add category
            item['category'] = categorize_dental_service(item['description'])
            item['selected'] = False
            item['quantity'] = 1
            item['total'] = item['price']
            item['notes'] = ''
            
            unique_items.append(item)
    
    # Sort by category and price
    unique_items.sort(key=lambda x: (x['category'], x['price']))
    
    # Write CSV
    headers = ['Category', 'Code', 'Description', 'Price', 'Selected', 'Quantity', 'Total', 'Notes']
    
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        
        for item in unique_items:
            writer.writerow([
                item['category'],
                item['code'],
                item['description'],
                f"{item['price']:.2f}",
                item['selected'],
                item['quantity'],
                f"{item['total']:.2f}",
                item['notes']
            ])
    
    return unique_items

def create_summary_report(items, pdf_path, output_path):
    """Create extraction summary report"""
    
    report_path = output_path.replace('.csv', '_extraction_report.txt')
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("DENTAL PRICING EXTRACTION REPORT\n")
        f.write("=" * 40 + "\n\n")
        
        f.write(f"Source PDF: {pdf_path}\n")
        f.write(f"Output CSV: {output_path}\n")
        f.write(f"Report Date: {Path().cwd()}\n\n")
        
        if not items:
            f.write("No pricing items were extracted.\n")
            return
        
        # Statistics
        prices = [item['price'] for item in items]
        categories = {}
        
        for item in items:
            cat = item['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        f.write("EXTRACTION STATISTICS:\n")
        f.write("-" * 25 + "\n")
        f.write(f"Total services extracted: {len(items)}\n")
        f.write(f"Categories found: {len(categories)}\n")
        f.write(f"Price range: ${min(prices):.2f} - ${max(prices):.2f}\n")
        f.write(f"Average price: ${sum(prices)/len(prices):.2f}\n")
        f.write(f"Median price: ${sorted(prices)[len(prices)//2]:.2f}\n\n")
        
        f.write("SERVICES BY CATEGORY:\n")
        f.write("-" * 25 + "\n")
        for category, count in sorted(categories.items()):
            avg_price = sum(item['price'] for item in items if item['category'] == category) / count
            f.write(f"{category}: {count} services (avg: ${avg_price:.2f})\n")
        
        f.write(f"\nSAMPLE EXTRACTED ITEMS:\n")
        f.write("-" * 25 + "\n")
        for i, item in enumerate(items[:10], 1):
            f.write(f"{i}. {item['description']} - ${item['price']:.2f} ({item['category']})\n")
        
        if len(items) > 10:
            f.write(f"... and {len(items) - 10} more items\n")
    
    print(f"Detailed report saved to: {report_path}")

def main():
    pdf_path = "/home/happy/projects/hpms/2025_Dental Practitioners (All).pdf"
    output_path = "/home/happy/projects/hpms/2025_Dental_Pricing_Table.csv"
    
    print(f"Processing dental pricing PDF: {pdf_path}")
    
    # Check if file exists
    if not Path(pdf_path).exists():
        print(f"Error: PDF file not found: {pdf_path}")
        return 1
    
    # Extract text using strings command
    print("Extracting text from PDF...")
    text = extract_text_with_strings(pdf_path)
    
    if not text:
        print("Failed to extract text from PDF")
        return 1
    
    print(f"Extracted {len(text)} characters from PDF")
    
    # Find pricing patterns
    print("Searching for dental pricing patterns...")
    pricing_items = find_dental_pricing_patterns(text)
    
    if not pricing_items:
        print("No dental pricing items found!")
        return 1
    
    print(f"Found {len(pricing_items)} potential pricing items")
    
    # Create pricing table
    print("Creating pricing table...")
    final_items = create_dental_pricing_table(pricing_items, output_path)
    
    # Create summary report
    create_summary_report(final_items, pdf_path, output_path)
    
    # Print results
    categories = {}
    prices = [item['price'] for item in final_items]
    
    for item in final_items:
        cat = item['category']
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n" + "="*50)
    print("EXTRACTION RESULTS SUMMARY")
    print("="*50)
    print(f"✓ Total services extracted: {len(final_items)}")
    print(f"✓ Categories found: {len(categories)}")
    print(f"✓ Price range: ${min(prices):.2f} - ${max(prices):.2f}")
    print(f"✓ Average price: ${sum(prices)/len(prices):.2f}")
    print(f"✓ Files created:")
    print(f"  - {output_path}")
    print(f"  - {output_path.replace('.csv', '_extraction_report.txt')}")
    
    print(f"\nCategories breakdown:")
    for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {category}: {count} services")
    
    return 0

if __name__ == "__main__":
    exit(main())