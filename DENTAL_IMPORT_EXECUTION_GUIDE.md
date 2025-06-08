# 🦷 Dental Practice Codes Import Guide

This guide provides multiple methods to import dental practice codes from `c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx` into the HPMS practice_tariffs table.

## 📋 Prerequisites

1. **Database Access**: Ensure you have access to the Supabase PostgreSQL database
2. **File Access**: The dental pricing file should be available at the specified path
3. **Node.js Dependencies**: Install required packages with `npm install csv-parser xlsx pg`

## 🚀 Import Methods

### Method 1: Comprehensive Node.js Importer (Recommended)

**File**: `comprehensive_dental_importer.js`

This is the most robust method that:
- Handles both CSV and Excel files
- Creates sample practices if none exist
- Provides comprehensive error handling
- Generates detailed import statistics
- Supports duplicate prevention

```bash
# Execute the comprehensive importer
node comprehensive_dental_importer.js
```

**Features**:
- ✅ Reads from multiple file formats (CSV, Excel)
- ✅ Creates sample dental practices automatically
- ✅ Prevents duplicate entries
- ✅ Provides detailed import statistics
- ✅ Handles errors gracefully
- ✅ Uses direct PostgreSQL connection (bolt.new style)

### Method 2: Direct SQL Script

**File**: `import_dental_tariffs.sql`

For direct database execution via Supabase Dashboard or psql:

```sql
-- Execute in Supabase SQL Editor or via psql
\i import_dental_tariffs.sql
```

**Features**:
- ✅ Direct SQL execution
- ✅ Built-in sample dental codes
- ✅ Creates practices if none exist
- ✅ Comprehensive reporting
- ✅ No dependencies required

### Method 3: Simple Node.js Importer

**File**: `import_dental_tariffs_node.js`

Basic CSV-focused importer:

```bash
# Install dependencies first
npm install csv-parser pg

# Execute the basic importer
node import_dental_tariffs_node.js
```

## 📊 Database Schema

The script imports data into the `practice_tariffs` table with the following structure:

```sql
CREATE TABLE practice_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- e.g., 001, 004, 211, etc.
  price DECIMAL(10,2) NOT NULL,
  namaf_prace_2025 TEXT NOT NULL, -- service name
  practice_type TEXT NOT NULL CHECK (practice_type IN ('dental', 'medical', 'aesthetic', 'specialist', 'general')),
  category TEXT, -- e.g., 'Consultation & Examination', 'Restorative'
  subcategory TEXT, -- e.g., 'Emergency', 'Fillings', 'Crowns'
  full_description TEXT,
  unit TEXT DEFAULT 'per visit',
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(practice_id, code, effective_from)
);
```

## 🏥 Sample Data Categories

The import includes comprehensive dental codes across these categories:

### 1. Consultation & Examination
- **Emergency**: Emergency examinations, after-hours consultations
- **Follow-up**: Post-operative, periodic, problem-focused exams
- **Initial Consultation**: Comprehensive oral examinations
- **Specialist**: Cancer screening, second opinions, specialist consultations

### 2. Cosmetic Procedures
- **Bonding**: Tooth reshaping, cosmetic bonding
- **Veneers**: Composite and porcelain veneers, consultations
- **Whitening**: Professional whitening, take-home kits
- **Digital Services**: Digital smile design

### 3. Restorative Procedures
- **Fillings**: Amalgam and composite fillings (1-3+ surfaces)
- **Crowns**: Porcelain, ceramic, gold, temporary crowns
- **Bridge**: Porcelain and ceramic pontics

### 4. Endodontics
- **Root Canal**: Anterior, premolar, molar treatments
- **Emergency**: Pulpotomy procedures
- **Post Treatment**: Post and core buildup

### 5. Periodontics
- **Cleaning**: Routine prophylaxis, deep cleaning
- **Surgery**: Gingivectomy, periodontal flap surgery

### 6. Oral Surgery
- **Extractions**: Simple, surgical, wisdom teeth
- **Advanced**: Bone grafting, sinus lifts

### 7. Prosthodontics
- **Dentures**: Complete and partial dentures
- **Implants**: Implant placement and crowns

### 8. Orthodontics
- **Consultation**: Orthodontic assessments
- **Treatment**: Metal braces, ceramic braces, Invisalign
- **Appliances**: Retainers and maintenance

### 9. Pediatric Dentistry
- **Preventive**: Child prophylaxis, fluoride, sealants
- **Restorative**: Primary tooth fillings
- **Surgery**: Primary tooth extractions

## 💰 Price Ranges

The dental codes cover a wide range of procedures with prices from:
- **Basic procedures**: N$45 - N$285 (examinations, cleanings, simple fillings)
- **Moderate procedures**: N$285 - N$1,685 (crowns, root canals, extractions)
- **Complex procedures**: N$1,885 - N$28,500 (implants, orthodontics, full treatments)

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```
   Error: connect ENETUNREACH
   ```
   - Verify database credentials in the script
   - Check network connectivity
   - Ensure Supabase instance is running

2. **File Not Found**
   ```
   CSV file not found at: ./2025_Dental_Pricing_Table.csv
   ```
   - Ensure the file exists in the correct location
   - Update the file path in the script
   - Use the comprehensive importer which falls back to sample data

3. **Duplicate Key Errors**
   ```
   duplicate key value violates unique constraint
   ```
   - The scripts handle duplicates with `ON CONFLICT` clauses
   - If issues persist, clear existing data first

4. **Permission Errors**
   ```
   permission denied for table practice_tariffs
   ```
   - Ensure using the correct database credentials
   - Use the direct PostgreSQL connection method

### Manual Verification

After import, verify the data:

```sql
-- Check total imported codes
SELECT COUNT(*) as total_codes FROM practice_tariffs WHERE practice_type = 'dental';

-- Check by category
SELECT category, COUNT(*) as count, AVG(price) as avg_price 
FROM practice_tariffs 
WHERE practice_type = 'dental' 
GROUP BY category;

-- Check practices with dental codes
SELECT p.name, COUNT(pt.id) as tariff_count 
FROM practices p 
JOIN practice_tariffs pt ON pt.practice_id = p.id 
WHERE pt.practice_type = 'dental' 
GROUP BY p.name;
```

## ✅ Success Indicators

A successful import should show:
- ✅ 60+ dental codes imported
- ✅ 9 major categories created
- ✅ All existing dental practices updated
- ✅ Price range from N$45 to N$28,500
- ✅ No duplicate conflicts
- ✅ Proper categorization and subcategorization

## 🔄 Re-running the Import

The scripts are designed to be safely re-run:
- Existing dental tariffs are cleared before import
- `ON CONFLICT` clauses handle any remaining duplicates
- Timestamps are updated appropriately
- No data corruption occurs

## 📈 Next Steps

After successful import:

1. **Verify in OneHealth Admin Dashboard**
   - Check tariff management section
   - Verify categories and prices
   - Test search and filtering

2. **Customize for Individual Practices**
   - Adjust prices based on practice location
   - Add or remove specific procedures
   - Set practice-specific categories

3. **Test Appointment Booking**
   - Verify tariffs appear in booking forms
   - Test price calculations
   - Ensure proper category filtering

4. **Configure SMS Notifications**
   - Set up appointment reminders
   - Include procedure pricing in notifications
   - Test automated messaging

## 🚀 Execution Command

For the recommended comprehensive import:

```bash
cd /home/happy/projects/hpms
npm install csv-parser xlsx pg
node comprehensive_dental_importer.js
```

This will automatically handle file detection, practice creation, and provide comprehensive import statistics.