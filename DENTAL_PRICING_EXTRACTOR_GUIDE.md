# Dental Pricing PDF Extractor - Usage Guide

## Overview
This tool extracts pricing information from dental practitioners PDF files and creates structured data suitable for invoicing systems. It provides both basic and enhanced extraction capabilities.

## Files Created

### 1. Basic Extractor (`extract_dental_pricing.py`)
- Simple PDF text extraction
- Basic pricing pattern matching
- CSV output with essential columns

### 2. Enhanced Extractor (`enhanced_dental_extractor.py`)
- Advanced PDF analysis
- Multiple extraction strategies
- Comprehensive categorization
- Excel output with multiple sheets
- Detailed analysis reports

### 3. Requirements (`requirements_dental_extractor.txt`)
- Python package dependencies
- PyPDF2 for PDF reading
- pandas for data manipulation
- openpyxl for Excel creation

### 4. Windows Batch File (`extract_dental_pricing.bat`)
- Automated installation and execution
- Windows-specific convenience script

## Installation

### Step 1: Install Python Dependencies
```bash
pip install -r requirements_dental_extractor.txt
```

### Step 2: Place Your PDF File
Ensure your PDF file is accessible at the specified path:
`c:\Users\Happyou2\Documents\emminance\2025_Dental Practitioners (All).pdf`

## Usage Options

### Option A: Windows Batch File (Easiest)
1. Double-click `extract_dental_pricing.bat`
2. The script will automatically:
   - Install dependencies
   - Extract pricing data
   - Create output files
   - Display completion message

### Option B: Command Line - Basic Extractor
```bash
python extract_dental_pricing.py "path/to/your/pdf.pdf" --output "output_filename.csv"
```

### Option C: Command Line - Enhanced Extractor
```bash
python enhanced_dental_extractor.py "path/to/your/pdf.pdf" --output "output_filename.csv"
```

## Output Files

### CSV File Structure
The main output CSV contains these columns:

| Column | Description | Example |
|--------|-------------|---------|
| category | Main service category | "Restorative" |
| subcategory | Specific subcategory | "Fillings" |
| code | Procedure code | "221" |
| description | Service description | "Composite filling one surface" |
| price | Fee amount | 145.00 |
| complexity | Procedure complexity | "Simple" |
| selected | For invoice selection | FALSE |
| quantity | Number of procedures | 1 |
| total | Calculated total | 145.00 |
| notes | Additional notes | "" |

### Enhanced Output (Excel)
The enhanced extractor creates an Excel file with multiple sheets:

1. **Pricing Table** - Main pricing data with filtering and formatting
2. **Category Summary** - Statistics by category
3. **Invoice Template** - Ready-to-use invoice format
4. **Metadata** - PDF information and extraction statistics

### Additional Files
- `*_summary.txt` - Extraction statistics and category breakdown
- `*_analysis_report.txt` - Detailed analysis (enhanced version only)

## Categories Extracted

### Medical Categories
- **Consultation & Examination** (Initial, Follow-up, Emergency, Specialist)
- **Preventive Care** (Cleaning, Scaling, Fluoride)
- **Restorative** (Fillings, Inlays/Onlays, Repairs)
- **Oral Surgery** (Extractions, Surgical, Implants)
- **Endodontics** (Root Canal Therapy, Retreatment)
- **Prosthodontics** (Crowns, Bridges, Dentures)
- **Orthodontics** (Traditional Braces, Clear Aligners, Retainers)
- **Periodontics** (Non-surgical, Surgical)
- **Diagnostic** (Intraoral X-rays, Extraoral X-rays, Advanced Imaging)
- **Cosmetic** (Whitening, Veneers, Bonding)

### Complexity Levels
- **Simple** - Basic, routine procedures
- **Moderate** - Multiple steps or moderate difficulty
- **Complex** - Surgical or extensive procedures

## Using the Output for Invoicing

### 1. Excel Method (Recommended)
- Open the generated Excel file
- Use the "Pricing Table" sheet
- Filter by category to find services
- Mark "selected" column as TRUE for chosen services
- Update "quantity" as needed
- Use "Invoice Template" sheet for final invoice

### 2. CSV Method
- Import CSV into your invoicing software
- Use category and description for service lookup
- Price column provides fee amounts
- Code column for procedure codes

### 3. Database Import
The CSV format is suitable for importing into:
- Practice management systems
- Accounting software
- Custom invoicing applications

## Troubleshooting

### Common Issues

1. **PDF Not Found**
   - Verify the file path is correct
   - Check file permissions
   - Ensure PDF is not password protected

2. **No Data Extracted**
   - PDF may be image-based (requires OCR)
   - Unusual formatting not recognized
   - Try enhanced extractor for better results

3. **Incomplete Extraction**
   - Some items may be in unrecognized formats
   - Manual review recommended
   - Enhanced extractor provides analysis report

### Improving Results

1. **PDF Quality**
   - Text-based PDFs work better than scanned images
   - Clear, consistent formatting improves accuracy
   - Remove unnecessary pages before processing

2. **Manual Review**
   - Always review extracted data for accuracy
   - Check price ranges for reasonableness
   - Verify category assignments

3. **Customization**
   - Modify category patterns in the code
   - Adjust price validation ranges
   - Add new extraction patterns for specific formats

## Sample Output Preview

See `sample_dental_pricing_output.csv` for an example of the expected output format with typical dental procedures and pricing.

## Technical Details

### Extraction Patterns
The tool uses multiple regex patterns to identify:
- Procedure codes (3-6 digits)
- Service descriptions
- Price amounts ($X.XX format)
- Category keywords

### Data Validation
- Price range validation (1-50,000)
- Description length requirements
- Duplicate removal
- Format consistency checks

### Performance
- Processes typical dental fee schedules in under 30 seconds
- Handles PDFs up to 100 pages
- Memory efficient for large documents

## Support

For issues or improvements:
1. Check the analysis report for extraction details
2. Review the PDF structure for format compatibility
3. Consider manual cleanup for critical missing items
4. Modify extraction patterns for specific PDF formats

## License
This tool is provided as-is for dental practice management purposes.