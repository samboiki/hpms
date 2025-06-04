#!/usr/bin/env python3
"""
Simple PDF text extractor using pdfplumber if available, or fallback to basic text extraction
"""

import re
import csv
import json
from pathlib import Path
import sys

def extract_text_fallback(pdf_path):
    """Fallback text extraction method"""
    try:
        # Try to use pdftotext if available
        import subprocess
        result = subprocess.run(['pdftotext', str(pdf_path), '-'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout
    except:
        pass
    
    # If no pdftotext, try to read as text (won't work for binary PDF)
    try:
        with open(pdf_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except:
        print("Error: Cannot extract text from PDF. Please install pdftotext or Python PDF libraries.")
        return None

def categorize_service(description):
    """Categorize dental services"""
    categories = {
        'Consultation & Examination': ['consult', 'examination', 'exam', 'assessment', 'evaluation', 'initial', 'check'],
        'Preventive Care': ['clean', 'polish', 'hygiene', 'prophylaxis', 'scale', 'fluoride'],
        'Restorative': ['filling', 'composite', 'amalgam', 'restoration', 'repair'],
        'Oral Surgery': ['extract', 'removal', 'surgical', 'surgery', 'implant'],
        'Endodontics': ['root canal', 'endodontic', 'pulp', 'nerve'],
        'Prosthodontics': ['crown', 'bridge', 'denture', 'partial', 'complete'],
        'Orthodontics': ['orthodontic', 'braces', 'bracket', 'aligner'],
        'Periodontics': ['gum', 'periodontal', 'gingivitis', 'pocket'],
        'Diagnostic': ['x-ray', 'radiograph', 'bitewing', 'panoramic', 'imaging'],
        'Cosmetic': ['whitening', 'bleach', 'veneer', 'cosmetic', 'aesthetic']
    }
    
    description_lower = description.lower()
    for category, keywords in categories.items():
        if any(keyword in description_lower for keyword in keywords):
            return category
    return 'Other'

def extract_pricing_patterns(text):
    """Extract pricing patterns from text"""
    patterns = [
        # Pattern 1: Code - Description - Price
        r'([A-Z]?\d{3,6})\s*[-–]?\s*([^$\n\d]{10,100}?)\s*[-–]?\s*\$?(\d+[.,]\d{2})',
        # Pattern 2: Description followed by price
        r'^([A-Z][^$\n\d]{15,80}?)\s+\$?(\d+[.,]\d{2})(?:\s|$)',
        # Pattern 3: Table format
        r'(\d{3,6})\s*\|\s*([^|$\n]+?)\s*\|\s*\$?(\d+[.,]\d{2})',
    ]
    
    all_items = []
    
    for pattern_num, pattern in enumerate(patterns, 1):
        matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
        print(f"Pattern {pattern_num} found {len(matches)} matches")
        
        for match in matches:
            if len(match) == 2:  # Description and price only
                code, description, price = "", match[0], match[1]
            elif len(match) == 3:  # Code, description, price
                code, description, price = match
            else:
                continue
            
            # Clean up data
            code = re.sub(r'[^\w]', '', code.strip()) if code else ""
            description = re.sub(r'\s+', ' ', description.strip())
            description = re.sub(r'[^\w\s\-/(),.]', '', description)
            
            # Clean price
            price_clean = re.sub(r'[^\d.,]', '', price)
            price_clean = price_clean.replace(',', '.')
            
            try:
                price_float = float(price_clean)
                if 1 <= price_float <= 50000 and len(description) >= 10:
                    category = categorize_service(description)
                    all_items.append({
                        'code': code,
                        'description': description,
                        'price': price_float,
                        'category': category,
                        'selected': False,
                        'quantity': 1,
                        'total': price_float,
                        'notes': ''
                    })
            except ValueError:
                continue
    
    # Remove duplicates
    unique_items = []
    seen_descriptions = set()
    
    for item in all_items:
        normalized = re.sub(r'[^\w\s]', '', item['description'].lower())
        normalized = re.sub(r'\s+', ' ', normalized.strip())
        
        if normalized not in seen_descriptions:
            seen_descriptions.add(normalized)
            unique_items.append(item)
    
    return unique_items

def create_simple_excel_csv(data, output_path):
    """Create CSV that can be easily converted to Excel"""
    headers = ['Category', 'Code', 'Description', 'Price', 'Selected', 'Quantity', 'Total', 'Notes']
    
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=[h.lower().replace(' ', '_') for h in headers])
        
        # Write headers as first row
        writer.writerow({h.lower().replace(' ', '_'): h for h in headers})
        
        # Sort by category and price
        sorted_data = sorted(data, key=lambda x: (x['category'], x['price']))
        
        for item in sorted_data:
            writer.writerow({
                'category': item['category'],
                'code': item['code'],
                'description': item['description'],
                'price': f"{item['price']:.2f}",
                'selected': item['selected'],
                'quantity': item['quantity'],
                'total': f"{item['total']:.2f}",
                'notes': item['notes']
            })

def generate_summary_report(data, pdf_path, output_path):
    """Generate a summary report"""
    if not data:
        return
    
    report_path = output_path.replace('.csv', '_summary_report.txt')
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("DENTAL PRICING EXTRACTION SUMMARY REPORT\n")
        f.write("=" * 50 + "\n\n")
        
        f.write(f"Source PDF: {pdf_path}\n")
        f.write(f"Output CSV: {output_path}\n\n")
        
        # Statistics
        f.write("EXTRACTION RESULTS:\n")
        f.write("-" * 20 + "\n")
        f.write(f"Total services extracted: {len(data)}\n")
        
        # Category breakdown
        categories = {}
        prices = [item['price'] for item in data]
        
        for item in data:
            category = item['category']
            if category not in categories:
                categories[category] = 0
            categories[category] += 1
        
        f.write(f"Categories found: {len(categories)}\n")
        f.write(f"Price range: ${min(prices):.2f} - ${max(prices):.2f}\n")
        f.write(f"Average price: ${sum(prices)/len(prices):.2f}\n\n")
        
        f.write("SERVICES BY CATEGORY:\n")
        f.write("-" * 25 + "\n")
        for category, count in sorted(categories.items()):
            f.write(f"{category}: {count} services\n")
        
        f.write(f"\nSample entries:\n")
        f.write("-" * 15 + "\n")
        for i, item in enumerate(data[:5], 1):
            f.write(f"{i}. {item['description']} - ${item['price']:.2f}\n")
    
    print(f"Summary report saved to: {report_path}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 simple_pdf_extractor.py <pdf_path> [output_csv]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "2025_Dental_Pricing_Table.csv"
    
    print(f"Processing PDF: {pdf_path}")
    
    # Extract text
    text = extract_text_fallback(pdf_path)
    if not text:
        print("Failed to extract text from PDF")
        sys.exit(1)
    
    print(f"Extracted {len(text)} characters of text")
    
    # Extract pricing data
    pricing_data = extract_pricing_patterns(text)
    
    if not pricing_data:
        print("No pricing data found!")
        sys.exit(1)
    
    print(f"Found {len(pricing_data)} pricing items")
    
    # Create CSV output
    create_simple_excel_csv(pricing_data, output_path)
    print(f"CSV saved to: {output_path}")
    
    # Generate summary report
    generate_summary_report(pricing_data, pdf_path, output_path)
    
    # Print summary
    categories = {}
    prices = [item['price'] for item in pricing_data]
    
    for item in pricing_data:
        category = item['category']
        categories[category] = categories.get(category, 0) + 1
    
    print("\nEXTRACTION SUMMARY:")
    print(f"- Total services extracted: {len(pricing_data)}")
    print(f"- Categories found: {len(categories)}")
    print(f"- Price range: ${min(prices):.2f} - ${max(prices):.2f}")
    print(f"- Average price: ${sum(prices)/len(prices):.2f}")
    print(f"- Categories: {', '.join(categories.keys())}")

if __name__ == "__main__":
    main()