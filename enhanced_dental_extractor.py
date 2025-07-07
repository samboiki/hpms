#!/usr/bin/env python3
"""
Enhanced Dental Pricing PDF Extractor with Excel Export
Handles complex PDF structures and creates both CSV and Excel outputs
"""

import PyPDF2
import pandas as pd
import re
import csv
from pathlib import Path
import argparse
import logging
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils.dataframe import dataframe_to_rows

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedDentalPricingExtractor:
    def __init__(self, pdf_path):
        self.pdf_path = Path(pdf_path)
        self.pricing_data = []
        self.categories = {}
        self.special_conditions = []
        self.metadata = {}
        
    def read_pdf_advanced(self):
        """Advanced PDF reading with better text extraction"""
        try:
            with open(self.pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract metadata
                if pdf_reader.metadata:
                    self.metadata = {
                        'title': pdf_reader.metadata.get('/Title', ''),
                        'author': pdf_reader.metadata.get('/Author', ''),
                        'subject': pdf_reader.metadata.get('/Subject', ''),
                        'creator': pdf_reader.metadata.get('/Creator', ''),
                        'pages': len(pdf_reader.pages)
                    }
                
                full_text = ""
                page_texts = []
                
                logger.info(f"Processing {len(pdf_reader.pages)} pages...")
                
                for page_num, page in enumerate(pdf_reader.pages, 1):
                    try:
                        page_text = page.extract_text()
                        page_texts.append({
                            'page': page_num,
                            'text': page_text,
                            'char_count': len(page_text)
                        })
                        full_text += f"\n=== PAGE {page_num} ===\n" + page_text
                        
                        if page_num % 10 == 0:
                            logger.info(f"Processed {page_num} pages...")
                            
                    except Exception as e:
                        logger.warning(f"Error processing page {page_num}: {e}")
                        continue
                
                logger.info(f"Total text extracted: {len(full_text)} characters")
                return full_text, page_texts
                
        except Exception as e:
            logger.error(f"Error reading PDF: {e}")
            return None, None
    
    def analyze_pdf_structure(self, text):
        """Analyze PDF structure to identify sections and patterns"""
        
        # Look for common dental fee schedule patterns
        structure_patterns = {
            'sections': r'^([A-Z][A-Z\s&]+?)(?=\n)',
            'subsections': r'^\s*([A-Z][a-z\s]+?)(?=\n)',
            'page_headers': r'(?:Page\s+\d+|DENTAL|PRACTITIONERS|FEE|SCHEDULE)',
            'table_headers': r'(?:CODE|DESCRIPTION|FEE|AMOUNT|PRICE)',
        }
        
        structure = {}
        
        for pattern_name, pattern in structure_patterns.items():
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            structure[pattern_name] = list(set(matches))[:20]  # Limit to 20 unique matches
        
        return structure
    
    def extract_comprehensive_pricing(self, text):
        """Comprehensive pricing extraction with multiple strategies"""
        
        all_items = []
        
        # Strategy 1: Detailed code-based extraction
        patterns = [
            # Standard dental codes with descriptions and prices
            r'([A-Z]?\d{3,6})\s*[-–]?\s*([^$\n\d]{10,100}?)\s*[-–]?\s*\$?(\d+[.,]\d{2})',
            
            # Table format: Code | Description | Price
            r'(\d{3,6})\s*\|\s*([^|$\n]+?)\s*\|\s*\$?(\d+[.,]\d{2})',
            
            # Spaced format: Code Description Price
            r'([A-Z]?\d{3,6})\s+([A-Z][^$\n\d]+?)\s+\$?(\d+[.,]\d{2})(?:\s|$)',
            
            # Description with price at end
            r'^([A-Z][^$\n\d]{15,80}?)\s+\$?(\d+[.,]\d{2})(?:\s|$)',
            
            # Multi-line format
            r'([A-Z]?\d{3,6})\s*\n\s*([^$\n\d]+?)\s+\$?(\d+[.,]\d{2})',
        ]
        
        for i, pattern in enumerate(patterns, 1):
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            logger.info(f"Pattern {i} found {len(matches)} matches")
            
            for match in matches:
                item = self.process_match(match, pattern_type=i)
                if item and self.validate_item(item):
                    all_items.append(item)
        
        # Remove duplicates based on code and description similarity
        unique_items = self.remove_duplicates(all_items)
        
        logger.info(f"Extracted {len(unique_items)} unique pricing items")
        return unique_items
    
    def process_match(self, match, pattern_type):
        """Process a regex match into a structured item"""
        
        if len(match) == 2:  # Description and price only
            code, description, price = "", match[0], match[1]
        elif len(match) == 3:  # Code, description, price
            code, description, price = match
        else:
            return None
        
        # Clean up the data
        code = re.sub(r'[^\w]', '', code.strip()) if code else ""
        description = re.sub(r'\s+', ' ', description.strip())
        description = re.sub(r'[^\w\s\-/(),.]', '', description)
        
        # Clean price
        price_clean = re.sub(r'[^\d.,]', '', price)
        price_clean = price_clean.replace(',', '.')
        
        try:
            price_float = float(price_clean)
        except ValueError:
            return None
        
        # Validate
        if len(description) < 5 or price_float < 1 or price_float > 50000:
            return None
        
        # Determine category and subcategory
        category, subcategory = self.categorize_service(description)
        
        return {
            'code': code,
            'description': description,
            'price': price_float,
            'category': category,
            'subcategory': subcategory,
            'pattern_type': pattern_type,
            'complexity': self.assess_complexity(description)
        }
    
    def categorize_service(self, description):
        """Enhanced categorization with subcategories"""
        
        categories = {
            'Consultation & Examination': {
                'keywords': ['consult', 'examination', 'exam', 'assessment', 'evaluation', 'initial', 'check'],
                'subcategories': {
                    'Initial Consultation': ['initial', 'first', 'new patient'],
                    'Follow-up': ['follow', 'review', 'subsequent'],
                    'Emergency': ['emergency', 'urgent', 'after hours'],
                    'Specialist': ['specialist', 'referral']
                }
            },
            'Preventive Care': {
                'keywords': ['clean', 'polish', 'hygiene', 'prophylaxis', 'scale', 'fluoride'],
                'subcategories': {
                    'Cleaning': ['clean', 'polish', 'prophylaxis'],
                    'Scaling': ['scale', 'debridement'],
                    'Fluoride': ['fluoride', 'treatment']
                }
            },
            'Restorative': {
                'keywords': ['filling', 'composite', 'amalgam', 'restoration', 'repair'],
                'subcategories': {
                    'Fillings': ['filling', 'composite', 'amalgam'],
                    'Inlays/Onlays': ['inlay', 'onlay'],
                    'Repairs': ['repair', 'replacement']
                }
            },
            'Oral Surgery': {
                'keywords': ['extract', 'removal', 'surgical', 'surgery', 'implant'],
                'subcategories': {
                    'Extractions': ['extract', 'removal'],
                    'Surgical': ['surgical', 'impacted'],
                    'Implants': ['implant', 'placement']
                }
            },
            'Endodontics': {
                'keywords': ['root canal', 'endodontic', 'pulp', 'nerve'],
                'subcategories': {
                    'Root Canal Therapy': ['root canal', 'endodontic'],
                    'Retreatment': ['retreatment', 'revision']
                }
            },
            'Prosthodontics': {
                'keywords': ['crown', 'bridge', 'denture', 'partial', 'complete'],
                'subcategories': {
                    'Crowns': ['crown', 'cap'],
                    'Bridges': ['bridge'],
                    'Dentures': ['denture', 'partial', 'complete']
                }
            },
            'Orthodontics': {
                'keywords': ['orthodontic', 'braces', 'bracket', 'aligner'],
                'subcategories': {
                    'Traditional Braces': ['braces', 'bracket'],
                    'Clear Aligners': ['aligner', 'invisalign'],
                    'Retainers': ['retainer']
                }
            },
            'Periodontics': {
                'keywords': ['gum', 'periodontal', 'gingivitis', 'pocket'],
                'subcategories': {
                    'Non-surgical': ['cleaning', 'scaling'],
                    'Surgical': ['surgery', 'graft']
                }
            },
            'Diagnostic': {
                'keywords': ['x-ray', 'radiograph', 'bitewing', 'panoramic', 'imaging'],
                'subcategories': {
                    'Intraoral X-rays': ['bitewing', 'periapical'],
                    'Extraoral X-rays': ['panoramic', 'cephalometric'],
                    'Advanced Imaging': ['ct', 'cbct', '3d']
                }
            },
            'Cosmetic': {
                'keywords': ['whitening', 'bleach', 'veneer', 'cosmetic', 'aesthetic'],
                'subcategories': {
                    'Whitening': ['whitening', 'bleach'],
                    'Veneers': ['veneer', 'laminate'],
                    'Bonding': ['bonding', 'reshaping']
                }
            }
        }
        
        description_lower = description.lower()
        
        for category, data in categories.items():
            if any(keyword in description_lower for keyword in data['keywords']):
                # Find subcategory
                for subcategory, sub_keywords in data['subcategories'].items():
                    if any(sub_keyword in description_lower for sub_keyword in sub_keywords):
                        return category, subcategory
                return category, 'General'
        
        return 'Other', 'Miscellaneous'
    
    def assess_complexity(self, description):
        """Assess the complexity of a dental procedure"""
        
        complexity_indicators = {
            'Simple': ['simple', 'basic', 'routine', 'single'],
            'Moderate': ['moderate', 'multiple', 'complex'],
            'Complex': ['complex', 'difficult', 'surgical', 'extensive']
        }
        
        description_lower = description.lower()
        
        for complexity, indicators in complexity_indicators.items():
            if any(indicator in description_lower for indicator in indicators):
                return complexity
        
        # Default based on procedure type
        if any(word in description_lower for word in ['surgery', 'surgical', 'implant']):
            return 'Complex'
        elif any(word in description_lower for word in ['root canal', 'crown', 'bridge']):
            return 'Moderate'
        else:
            return 'Simple'
    
    def validate_item(self, item):
        """Validate extracted pricing item"""
        
        # Skip obvious non-medical items
        skip_keywords = [
            'page', 'total', 'subtotal', 'tax', 'gst', 'vat',
            'header', 'footer', 'copyright', 'reserved'
        ]
        
        description_lower = item['description'].lower()
        if any(keyword in description_lower for keyword in skip_keywords):
            return False
        
        # Ensure reasonable price range
        if not (1 <= item['price'] <= 50000):
            return False
        
        # Ensure description is meaningful
        if len(item['description'].strip()) < 10:
            return False
        
        return True
    
    def remove_duplicates(self, items):
        """Remove duplicate items based on similarity"""
        
        unique_items = []
        seen_descriptions = set()
        
        for item in items:
            # Create a normalized version for comparison
            normalized = re.sub(r'[^\w\s]', '', item['description'].lower())
            normalized = re.sub(r'\s+', ' ', normalized.strip())
            
            # Check for exact matches first
            if normalized not in seen_descriptions:
                seen_descriptions.add(normalized)
                unique_items.append(item)
            else:
                # If duplicate, keep the one with more complete information
                existing_index = next(
                    (i for i, existing in enumerate(unique_items) 
                     if re.sub(r'[^\w\s]', '', existing['description'].lower()).strip() == normalized),
                    None
                )
                
                if existing_index is not None:
                    existing = unique_items[existing_index]
                    # Keep item with code or better description
                    if (item['code'] and not existing['code']) or len(item['description']) > len(existing['description']):
                        unique_items[existing_index] = item
        
        return unique_items
    
    def create_excel_output(self, output_path):
        """Create a comprehensive Excel file with multiple sheets"""
        
        wb = Workbook()
        
        # Remove default sheet
        wb.remove(wb.active)
        
        # Create pricing sheet
        pricing_ws = wb.create_sheet("Pricing Table")
        self.create_pricing_sheet(pricing_ws)
        
        # Create category summary sheet
        summary_ws = wb.create_sheet("Category Summary")
        self.create_summary_sheet(summary_ws)
        
        # Create invoice template sheet
        invoice_ws = wb.create_sheet("Invoice Template")
        self.create_invoice_template(invoice_ws)
        
        # Create metadata sheet
        meta_ws = wb.create_sheet("Metadata")
        self.create_metadata_sheet(meta_ws)
        
        # Save workbook
        excel_path = output_path.replace('.csv', '.xlsx')
        wb.save(excel_path)
        logger.info(f"Excel file saved to {excel_path}")
        
        return excel_path
    
    def create_pricing_sheet(self, ws):
        """Create the main pricing table sheet"""
        
        # Headers
        headers = [
            'Category', 'Subcategory', 'Code', 'Description', 
            'Price', 'Complexity', 'Selected', 'Quantity', 'Total', 'Notes'
        ]
        
        # Add headers with formatting
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="366092")
            cell.alignment = Alignment(horizontal="center")
        
        # Add data
        df = pd.DataFrame(self.pricing_data)
        if not df.empty:
            df['selected'] = False
            df['quantity'] = 1
            df['total'] = df['price']
            df['notes'] = ''
            
            # Sort by category and price
            df = df.sort_values(['category', 'subcategory', 'price'])
            
            for row_idx, (_, row) in enumerate(df.iterrows(), 2):
                ws.cell(row=row_idx, column=1, value=row['category'])
                ws.cell(row=row_idx, column=2, value=row['subcategory'])
                ws.cell(row=row_idx, column=3, value=row['code'])
                ws.cell(row=row_idx, column=4, value=row['description'])
                ws.cell(row=row_idx, column=5, value=row['price'])
                ws.cell(row=row_idx, column=6, value=row['complexity'])
                ws.cell(row=row_idx, column=7, value=row['selected'])
                ws.cell(row=row_idx, column=8, value=row['quantity'])
                ws.cell(row=row_idx, column=9, value=row['total'])
                ws.cell(row=row_idx, column=10, value=row['notes'])
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    def create_summary_sheet(self, ws):
        """Create category summary sheet"""
        
        if not self.pricing_data:
            return
        
        df = pd.DataFrame(self.pricing_data)
        
        # Category summary
        category_summary = df.groupby('category').agg({
            'price': ['count', 'min', 'max', 'mean'],
            'complexity': lambda x: x.value_counts().to_dict()
        }).round(2)
        
        # Headers
        ws.cell(row=1, column=1, value="Category Summary").font = Font(bold=True, size=14)
        
        headers = ['Category', 'Count', 'Min Price', 'Max Price', 'Avg Price', 'Complexity Distribution']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=3, column=col, value=header)
            cell.font = Font(bold=True)
        
        # Data
        row_idx = 4
        for category in category_summary.index:
            ws.cell(row=row_idx, column=1, value=category)
            ws.cell(row=row_idx, column=2, value=category_summary.loc[category, ('price', 'count')])
            ws.cell(row=row_idx, column=3, value=category_summary.loc[category, ('price', 'min')])
            ws.cell(row=row_idx, column=4, value=category_summary.loc[category, ('price', 'max')])
            ws.cell(row=row_idx, column=5, value=category_summary.loc[category, ('price', 'mean')])
            
            complexity_dist = category_summary.loc[category, ('complexity', '<lambda>')]
            complexity_str = ', '.join([f"{k}: {v}" for k, v in complexity_dist.items()])
            ws.cell(row=row_idx, column=6, value=complexity_str)
            
            row_idx += 1
    
    def create_invoice_template(self, ws):
        """Create an invoice template sheet"""
        
        # Invoice header
        ws.cell(row=1, column=1, value="DENTAL INVOICE TEMPLATE").font = Font(bold=True, size=16)
        
        # Practice details section
        ws.cell(row=3, column=1, value="Practice Name:").font = Font(bold=True)
        ws.cell(row=4, column=1, value="Address:").font = Font(bold=True)
        ws.cell(row=5, column=1, value="Phone:").font = Font(bold=True)
        ws.cell(row=6, column=1, value="Email:").font = Font(bold=True)
        
        # Patient details section
        ws.cell(row=3, column=4, value="Patient Name:").font = Font(bold=True)
        ws.cell(row=4, column=4, value="Date of Service:").font = Font(bold=True)
        ws.cell(row=5, column=4, value="Invoice Number:").font = Font(bold=True)
        ws.cell(row=6, column=4, value="Medical Aid:").font = Font(bold=True)
        
        # Services table
        headers = ['Code', 'Description', 'Quantity', 'Unit Price', 'Total']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=8, column=col, value=header)
            cell.font = Font(bold=True)
        
        # Add some sample rows
        for row in range(9, 20):
            for col in range(1, 6):
                ws.cell(row=row, column=col, value="")
        
        # Totals section
        ws.cell(row=21, column=4, value="Subtotal:").font = Font(bold=True)
        ws.cell(row=22, column=4, value="Tax:").font = Font(bold=True)
        ws.cell(row=23, column=4, value="Total:").font = Font(bold=True)
    
    def create_metadata_sheet(self, ws):
        """Create metadata information sheet"""
        
        ws.cell(row=1, column=1, value="EXTRACTION METADATA").font = Font(bold=True, size=14)
        
        row_idx = 3
        for key, value in self.metadata.items():
            ws.cell(row=row_idx, column=1, value=f"{key.title()}:").font = Font(bold=True)
            ws.cell(row=row_idx, column=2, value=str(value))
            row_idx += 1
        
        # Extraction statistics
        row_idx += 2
        ws.cell(row=row_idx, column=1, value="EXTRACTION STATISTICS").font = Font(bold=True)
        row_idx += 1
        
        if self.pricing_data:
            stats = [
                ("Total items extracted", len(self.pricing_data)),
                ("Categories found", len(set(item['category'] for item in self.pricing_data))),
                ("Price range", f"${min(item['price'] for item in self.pricing_data):.2f} - ${max(item['price'] for item in self.pricing_data):.2f}"),
                ("Average price", f"${sum(item['price'] for item in self.pricing_data) / len(self.pricing_data):.2f}"),
                ("Special conditions found", len(self.special_conditions))
            ]
            
            for stat_name, stat_value in stats:
                ws.cell(row=row_idx, column=1, value=f"{stat_name}:").font = Font(bold=True)
                ws.cell(row=row_idx, column=2, value=str(stat_value))
                row_idx += 1
    
    def process_pdf(self, output_path):
        """Main processing function"""
        
        logger.info(f"Starting enhanced processing of: {self.pdf_path}")
        
        # Read PDF
        text, page_texts = self.read_pdf_advanced()
        if not text:
            return False
        
        # Analyze structure
        structure = self.analyze_pdf_structure(text)
        logger.info("PDF Structure Analysis:")
        for key, value in structure.items():
            logger.info(f"  {key}: {len(value)} items found")
        
        # Extract pricing data
        self.pricing_data = self.extract_comprehensive_pricing(text)
        
        if not self.pricing_data:
            logger.warning("No pricing data extracted!")
            return False
        
        # Find special conditions
        self.special_conditions = self.find_special_conditions(text)
        
        # Save CSV
        df = pd.DataFrame(self.pricing_data)
        df['selected'] = False
        df['quantity'] = 1
        df['total'] = df['price']
        df['notes'] = ''
        
        df.to_csv(output_path, index=False)
        logger.info(f"CSV saved to {output_path}")
        
        # Create Excel version
        excel_path = self.create_excel_output(output_path)
        
        # Save detailed analysis
        self.save_analysis_report(output_path)
        
        logger.info("Enhanced processing completed successfully!")
        return True
    
    def find_special_conditions(self, text):
        """Enhanced special conditions detection"""
        
        patterns = [
            r'(?:NOTE|NOTES|IMPORTANT|SPECIAL|CONDITION)[:*]?\s*([^\n]{20,200})',
            r'(?:Additional|Extra|Surcharge|Premium)[:*]?\s*([^\n]{10,100})',
            r'(?:Package|Bundle|Discount)[:*]?\s*([^\n]{10,100})',
            r'(?:Age|Years|Under|Over)\s+\d+[:*]?\s*([^\n]{10,100})',
        ]
        
        conditions = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            conditions.extend([match.strip() for match in matches if len(match.strip()) > 10])
        
        return list(set(conditions))  # Remove duplicates
    
    def save_analysis_report(self, output_path):
        """Save detailed analysis report"""
        
        report_path = output_path.replace('.csv', '_analysis_report.txt')
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("ENHANCED DENTAL PRICING EXTRACTION REPORT\n")
            f.write("=" * 50 + "\n\n")
            
            # PDF Metadata
            f.write("PDF METADATA:\n")
            f.write("-" * 20 + "\n")
            for key, value in self.metadata.items():
                f.write(f"{key.title()}: {value}\n")
            f.write("\n")
            
            # Extraction Summary
            f.write("EXTRACTION SUMMARY:\n")
            f.write("-" * 20 + "\n")
            f.write(f"Total services extracted: {len(self.pricing_data)}\n")
            
            if self.pricing_data:
                df = pd.DataFrame(self.pricing_data)
                
                # Category breakdown
                f.write(f"Categories found: {df['category'].nunique()}\n")
                f.write(f"Subcategories found: {df['subcategory'].nunique()}\n\n")
                
                # Category details
                f.write("SERVICES BY CATEGORY:\n")
                for category, group in df.groupby('category'):
                    f.write(f"  {category}: {len(group)} services\n")
                    for subcategory, subgroup in group.groupby('subcategory'):
                        f.write(f"    - {subcategory}: {len(subgroup)} services\n")
                f.write("\n")
                
                # Price analysis
                f.write("PRICE ANALYSIS:\n")
                f.write(f"  Price range: ${df['price'].min():.2f} - ${df['price'].max():.2f}\n")
                f.write(f"  Average price: ${df['price'].mean():.2f}\n")
                f.write(f"  Median price: ${df['price'].median():.2f}\n")
                f.write(f"  Standard deviation: ${df['price'].std():.2f}\n\n")
                
                # Complexity analysis
                f.write("COMPLEXITY BREAKDOWN:\n")
                complexity_counts = df['complexity'].value_counts()
                for complexity, count in complexity_counts.items():
                    f.write(f"  {complexity}: {count} services ({count/len(df)*100:.1f}%)\n")
                f.write("\n")
                
                # Sample items
                f.write("SAMPLE EXTRACTED ITEMS:\n")
                f.write("-" * 30 + "\n")
                sample_items = df.sample(min(10, len(df)))
                for _, item in sample_items.iterrows():
                    f.write(f"Code: {item['code']}\n")
                    f.write(f"Description: {item['description']}\n")
                    f.write(f"Price: ${item['price']:.2f}\n")
                    f.write(f"Category: {item['category']} > {item['subcategory']}\n")
                    f.write(f"Complexity: {item['complexity']}\n")
                    f.write("-" * 30 + "\n")
            
            # Special conditions
            if self.special_conditions:
                f.write(f"\nSPECIAL CONDITIONS FOUND ({len(self.special_conditions)}):\n")
                f.write("-" * 40 + "\n")
                for i, condition in enumerate(self.special_conditions[:20], 1):
                    f.write(f"{i}. {condition}\n")
            
            f.write(f"\nFiles created:\n")
            f.write(f"- {output_path} (CSV format)\n")
            f.write(f"- {output_path.replace('.csv', '.xlsx')} (Excel format)\n")
            f.write(f"- {report_path} (This analysis report)\n")
        
        logger.info(f"Analysis report saved to {report_path}")

def main():
    parser = argparse.ArgumentParser(description='Enhanced dental pricing extractor')
    parser.add_argument('pdf_path', help='Path to the PDF file')
    parser.add_argument('--output', '-o', default='2025_Dental_Pricing_Table.csv',
                       help='Output CSV file path')
    
    args = parser.parse_args()
    
    if not Path(args.pdf_path).exists():
        logger.error(f"PDF file not found: {args.pdf_path}")
        return 1
    
    extractor = EnhancedDentalPricingExtractor(args.pdf_path)
    success = extractor.process_pdf(args.output)
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())