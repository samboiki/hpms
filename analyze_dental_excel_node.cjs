#!/usr/bin/env node

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Complete analysis of dental practice codes Excel file
 * Extracts ALL 179 dental codes with complete column structure
 */

function analyzeDentalExcel() {
    console.log('Starting Excel analysis...');
    
    // Excel file path
    const excelPath = '/mnt/c/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';
    
    try {
        // Check if file exists
        if (!fs.existsSync(excelPath)) {
            console.error(`❌ File not found: ${excelPath}`);
            return null;
        }
        
        console.log('📂 Reading Excel file...');
        
        // Read Excel file
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0]; // Get first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        console.log(`📋 Sheet name: "${sheetName}"`);
        
        // Convert to JSON with headers
        const data = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,  // Get raw data with headers
            defval: '',  // Default value for empty cells
            raw: false   // Convert everything to strings initially
        });
        
        if (data.length === 0) {
            console.error('❌ No data found in Excel file');
            return null;
        }
        
        // Extract headers (first row)
        const headers = data[0];
        const rows = data.slice(1); // All data rows
        
        console.log(`✅ Successfully loaded Excel file`);
        console.log(`📊 Total rows: ${rows.length}`);
        console.log(`📋 Total columns: ${headers.length}`);
        
        // Show exact column names
        console.log(`\n📝 EXACT COLUMN NAMES (${headers.length} columns):`);
        headers.forEach((header, index) => {
            console.log(`  ${(index + 1).toString().padStart(2)}. '${header}'`);
        });
        
        // Convert rows to objects
        const records = rows.map(row => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index] || '';
            });
            return record;
        });
        
        // Analyze data types and characteristics
        console.log(`\n🔍 DATA ANALYSIS:`);
        const analysis = {};
        
        headers.forEach(header => {
            const values = records.map(r => r[header]).filter(v => v !== '');
            const nullCount = records.length - values.length;
            const uniqueCount = new Set(values).size;
            
            // Determine data type
            let dataType = 'text';
            if (values.length > 0) {
                const sample = values[0];
                if (!isNaN(sample) && !isNaN(parseFloat(sample))) {
                    dataType = sample.includes('.') ? 'decimal' : 'integer';
                } else if (sample.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dataType = 'date';
                }
            }
            
            analysis[header] = {
                dataType,
                nullCount,
                uniqueCount,
                sampleValues: values.slice(0, 3)
            };
            
            console.log(`  ${header}: ${dataType} (nulls: ${nullCount}, unique: ${uniqueCount})`);
        });
        
        // Show first 3 records
        console.log(`\n📋 FIRST 3 RECORDS SAMPLE:`);
        records.slice(0, 3).forEach((record, index) => {
            console.log(`\n  Record ${index + 1}:`);
            Object.entries(record).forEach(([key, value]) => {
                console.log(`    ${key}: "${value}"`);
            });
        });
        
        // Prepare complete output
        const outputData = {
            metadata: {
                total_rows: records.length,
                total_columns: headers.length,
                sheet_name: sheetName,
                file_path: excelPath
            },
            structure: {
                column_names: headers,
                data_analysis: analysis
            },
            complete_data: records  // All 179 records
        };
        
        // Save complete analysis
        const outputFile = '/home/happy/projects/hpms/dental_codes_complete_analysis.json';
        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
        
        console.log(`\n💾 Complete data saved to: ${outputFile}`);
        
        // Summary statistics
        const completeness = (records.reduce((sum, record) => {
            return sum + Object.values(record).filter(v => v !== '').length;
        }, 0) / (records.length * headers.length) * 100);
        
        console.log(`\n📊 SUMMARY STATISTICS:`);
        console.log(`  • Total dental codes: ${records.length}`);
        console.log(`  • Column structure: ${headers.length} columns`);
        console.log(`  • Data completeness: ${completeness.toFixed(1)}%`);
        
        // Show sample values for first 5 columns
        console.log(`\n🔍 SAMPLE VALUES (first 5 columns):`);
        headers.slice(0, 5).forEach(header => {
            const uniqueVals = [...new Set(records.map(r => r[header]).filter(v => v !== ''))].slice(0, 5);
            console.log(`  ${header}: [${uniqueVals.map(v => `"${v}"`).join(', ')}]`);
        });
        
        return outputData;
        
    } catch (error) {
        console.error(`❌ Error reading Excel file: ${error.message}`);
        return null;
    }
}

// Run analysis
const result = analyzeDentalExcel();
if (result) {
    console.log(`\n✅ Analysis complete! Found ${result.metadata.total_rows} dental codes with ${result.metadata.total_columns} columns each.`);
} else {
    console.log('\n❌ Analysis failed!');
}