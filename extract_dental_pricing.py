#!/usr/bin/env python3
"""
Dental Pricing PDF Extractor
This script extracts pricing information from dental practitioners PDF files
and creates a structured CSV for easy import into invoicing systems.
"""

import PyPDF2
import pandas as pd
import re
import csv
from pathlib import Path
import argparse
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DentalPricingExtractor:
    def __init__(self, pdf_path):
        self.pdf_path = Path(pdf_path)
        self.pricing_data = []
        self.categories = set()
        self.special_conditions = []
        
    def read_pdf(self):
        """Read and extract text from PDF file"""
        try:
            with open(self.pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                
                logger.info(f"Processing {len(pdf_reader.pages)} pages...")
                
                for page_num, page in enumerate(pdf_reader.pages, 1):
                    page_text = page.extract_text()
                    text += f"\n--- PAGE {page_num} ---\n" + page_text
                    
                return text
        except Exception as e:
            logger.error(f"Error reading PDF: {e}")
            return None
    
    def extract_table_of_contents(self, text):
        """Extract table of contents or section structure"""
        toc_patterns = [
            r'CONTENTS?\s*\n(.*?)(?=\n[A-Z])',
            r'TABLE OF CONTENTS\s*\n(.*?)(?=\n[A-Z])',
            r'INDEX\s*\n(.*?)(?=\n[A-Z])',
        ]
        
        for pattern in toc_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        # Look for section headers
        section_pattern = r'^([A-Z][A-Z\s]+)(?=\n)'
        sections = re.findall(section_pattern, text, re.MULTILINE)
        return "\n".join(sections[:20]) if sections else "No clear table of contents found"
    
    def extract_pricing_patterns(self, text):
        """Extract pricing information using various patterns"""
        
        # Common pricing patterns for dental services
        patterns = [
            # Pattern 1: Code - Description - Price
            r'([A-Z]?\d{3,5})\s*[-–]\s*([^$\n]+?)\s*[-–]?\s*[$]?(\d+[.,]\d{2})',
            
            # Pattern 2: Description followed by price
            r'([A-Z][^$\n]*?)\s+[$](\d+[.,]\d{2})',
            
            # Pattern 3: Table format with codes
            r'(\d{3,5})\s+([^$\n]+?)\s+(\d+[.,]\d{2})',
            
            # Pattern 4: Code Description Price on same line
            r'([A-Z]?\d{3,5})\s+([A-Z][^$\n]+?)\s+[$]?(\d+[.,]\d{2})',
        ]
        
        extracted_items = []
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                if len(match) == 3:
                    code, description, price = match
                    # Clean up the data
                    code = code.strip()
                    description = re.sub(r'\s+', ' ', description.strip())
                    price = price.replace(',', '.')
                    
                    # Skip if description is too short or price is unrealistic
                    if len(description) > 5 and 1 <= float(price) <= 50000:
                        extracted_items.append({
                            'code': code,
                            'description': description,
                            'price': float(price),
                            'category': self.determine_category(description)
                        })
        
        return extracted_items
    
    def determine_category(self, description):
        """Categorize dental services based on description"""
        categories = {
            'Consultation': ['consult', 'examination', 'exam', 'assessment', 'evaluation'],
            'Cleaning': ['clean', 'polish', 'hygiene', 'prophylaxis', 'scale'],
            'Fillings': ['filling', 'composite', 'amalgam', 'restoration'],
            'Extractions': ['extract', 'removal', 'surgical removal'],
            'Root Canal': ['root canal', 'endodontic', 'pulp'],
            'Crowns': ['crown', 'cap'],
            'Bridges': ['bridge'],
            'Dentures': ['denture', 'partial', 'complete'],
            'Implants': ['implant'],
            'Orthodontics': ['orthodontic', 'braces', 'bracket'],
            'Periodontics': ['gum', 'periodontal', 'gingivitis'],
            'Surgery': ['surgery', 'surgical'],
            'X-rays': ['x-ray', 'radiograph', 'bitewing', 'panoramic'],
            'Emergency': ['emergency', 'urgent'],
            'Cosmetic': ['whitening', 'bleach', 'veneer', 'cosmetic'],
        }
        
        description_lower = description.lower()
        
        for category, keywords in categories.items():
            if any(keyword in description_lower for keyword in keywords):
                return category
        
        return 'Other'
    
    def find_special_conditions(self, text):
        """Find special pricing conditions and notes"""
        condition_patterns = [
            r'(?:Note|Special|Condition|Important)[:*]?\s*([^\n]+)',
            r'(?:Additional|Extra|Surcharge)[:*]?\s*([^\n]+)',
            r'(?:Package|Bundle)[:*]?\s*([^\n]+)',
        ]
        
        conditions = []
        for pattern in condition_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            conditions.extend([match.strip() for match in matches])
        
        return conditions
    
    def save_to_csv(self, output_path):
        """Save extracted pricing data to CSV"""
        if not self.pricing_data:
            logger.warning("No pricing data to save")
            return
        
        # Sort by category and then by price
        self.pricing_data.sort(key=lambda x: (x['category'], x['price']))
        
        df = pd.DataFrame(self.pricing_data)
        
        # Add additional columns for invoicing
        df['selected'] = False
        df['quantity'] = 1
        df['total'] = df['price']
        df['notes'] = ''
        
        # Reorder columns for better usability
        column_order = [
            'category', 'code', 'description', 'price', 
            'selected', 'quantity', 'total', 'notes'
        ]
        df = df[column_order]
        
        df.to_csv(output_path, index=False)
        logger.info(f"Pricing data saved to {output_path}")
        
        # Save summary statistics
        summary_path = output_path.replace('.csv', '_summary.txt')
        with open(summary_path, 'w') as f:
            f.write("DENTAL PRICING EXTRACTION SUMMARY\n")
            f.write("=" * 40 + "\n\n")
            f.write(f"Total services extracted: {len(self.pricing_data)}\n")
            f.write(f"Categories found: {len(df['category'].unique())}\n\n")
            
            f.write("Services by Category:\n")
            category_counts = df['category'].value_counts()
            for category, count in category_counts.items():
                f.write(f"  {category}: {count} services\n")
            
            f.write(f"\nPrice Range:\n")
            f.write(f"  Minimum: ${df['price'].min():.2f}\n")
            f.write(f"  Maximum: ${df['price'].max():.2f}\n")
            f.write(f"  Average: ${df['price'].mean():.2f}\n")
            
            if self.special_conditions:
                f.write(f"\nSpecial Conditions Found:\n")
                for condition in self.special_conditions[:10]:  # Show first 10
                    f.write(f"  - {condition}\n")
        
        logger.info(f"Summary saved to {summary_path}")
    
    def process_pdf(self, output_path):
        """Main processing function"""
        logger.info(f"Processing PDF: {self.pdf_path}")
        
        # Read PDF text
        text = self.read_pdf()
        if not text:
            return False
        
        # Extract table of contents
        toc = self.extract_table_of_contents(text)
        logger.info("Table of Contents/Structure:")
        logger.info(toc)
        
        # Extract pricing data
        self.pricing_data = self.extract_pricing_patterns(text)
        logger.info(f"Extracted {len(self.pricing_data)} pricing items")
        
        # Find special conditions
        self.special_conditions = self.find_special_conditions(text)
        logger.info(f"Found {len(self.special_conditions)} special conditions")
        
        # Save sample for review
        if self.pricing_data:
            logger.info("\nSample of extracted pricing data:")
            for item in self.pricing_data[:5]:
                logger.info(f"  {item['code']} - {item['description']} - ${item['price']:.2f} ({item['category']})")
        
        # Save to CSV
        self.save_to_csv(output_path)
        
        return True

def main():
    parser = argparse.ArgumentParser(description='Extract pricing data from dental practitioners PDF')
    parser.add_argument('pdf_path', help='Path to the PDF file')
    parser.add_argument('--output', '-o', default='2025_Dental_Pricing_Table.csv', 
                       help='Output CSV file path')
    
    args = parser.parse_args()
    
    # Validate input file
    if not Path(args.pdf_path).exists():
        logger.error(f"PDF file not found: {args.pdf_path}")
        return 1
    
    # Create extractor and process
    extractor = DentalPricingExtractor(args.pdf_path)
    success = extractor.process_pdf(args.output)
    
    if success:
        logger.info("Processing completed successfully!")
        return 0
    else:
        logger.error("Processing failed!")
        return 1

if __name__ == "__main__":
    exit(main())