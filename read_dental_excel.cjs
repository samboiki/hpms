#!/usr/bin/env node
/**
 * Script to read and analyze dental practice codes from Excel file
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function analyzeDentalExcel(filePath) {
    try {
        console.log(`Reading Excel file: ${filePath}`);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found at ${filePath}`);
            return null;
        }
        
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        
        console.log(`\nSheet names in the Excel file:`);
        workbook.SheetNames.forEach((sheetName, index) => {
            console.log(`  ${index + 1}. ${sheetName}`);
        });
        
        const allSheetsData = {};
        
        // Analyze each sheet
        workbook.SheetNames.forEach(sheetName => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`ANALYZING SHEET: ${sheetName}`);
            console.log(`${'='.repeat(60)}`);
            
            try {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length === 0) {
                    console.log('Sheet is empty');
                    return;
                }
                
                // Get headers (first row)
                const headers = jsonData[0] || [];
                const dataRows = jsonData.slice(1);
                
                console.log(`Shape: ${dataRows.length} rows, ${headers.length} columns`);
                
                console.log(`\nColumn names:`);
                headers.forEach((header, index) => {
                    console.log(`  ${index + 1}. ${header || `Column_${index + 1}`}`);
                });
                
                // Convert to proper JSON format
                const properJsonData = XLSX.utils.sheet_to_json(worksheet);
                
                console.log(`\nFirst 5 rows of data:`);
                console.log(JSON.stringify(properJsonData.slice(0, 5), null, 2));
                
                // Analyze data types and content
                console.log(`\nData analysis:`);
                headers.forEach((header, index) => {
                    if (!header) return;
                    
                    const columnData = properJsonData.map(row => row[header]).filter(val => val !== undefined && val !== null && val !== '');
                    const uniqueValues = [...new Set(columnData)].length;
                    
                    console.log(`  ${header}:`);
                    console.log(`    - Non-empty values: ${columnData.length}`);
                    console.log(`    - Unique values: ${uniqueValues}`);
                    
                    // Show sample values
                    if (uniqueValues <= 10 && uniqueValues > 0) {
                        console.log(`    - All unique values: ${[...new Set(columnData)].slice(0, 10).join(', ')}`);
                    } else if (columnData.length > 0) {
                        console.log(`    - Sample values: ${columnData.slice(0, 3).join(', ')}`);
                    }
                    
                    // Check data types
                    const sampleValue = columnData[0];
                    if (sampleValue !== undefined) {
                        const dataType = typeof sampleValue;
                        const isNumeric = !isNaN(parseFloat(sampleValue)) && isFinite(sampleValue);
                        console.log(`    - Data type: ${dataType} ${isNumeric ? '(numeric)' : ''}`);
                    }
                });
                
                allSheetsData[sheetName] = properJsonData;
                
                // Export to CSV for easier analysis
                const safeSheetName = sheetName.replace(/[^a-zA-Z0-9]/g, '_');
                const csvPath = path.join(__dirname, `dental_codes_${safeSheetName}.csv`);
                
                if (properJsonData.length > 0) {
                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                    fs.writeFileSync(csvPath, csv);
                    console.log(`\nExported to CSV: ${csvPath}`);
                }
                
            } catch (error) {
                console.error(`Error processing sheet '${sheetName}':`, error.message);
            }
        });
        
        return allSheetsData;
        
    } catch (error) {
        console.error('Error reading Excel file:', error.message);
        return null;
    }
}

function generateDatabaseSchema(data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('DATABASE SCHEMA RECOMMENDATIONS');
    console.log(`${'='.repeat(60)}`);
    
    Object.entries(data).forEach(([sheetName, sheetData]) => {
        if (sheetData.length === 0) return;
        
        console.log(`\nTable suggestion for sheet: ${sheetName}`);
        console.log('-'.repeat(40));
        
        const sampleRow = sheetData[0];
        const columns = Object.keys(sampleRow);
        
        console.log('CREATE TABLE dental_tariffs (');
        console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        
        columns.forEach(col => {
            const columnData = sheetData.map(row => row[col]).filter(val => val !== undefined && val !== null && val !== '');
            
            if (columnData.length === 0) return;
            
            const sampleValue = columnData[0];
            const isNumeric = !isNaN(parseFloat(sampleValue)) && isFinite(sampleValue);
            const maxLength = Math.max(...columnData.map(val => String(val).length));
            
            let sqlType = 'TEXT';
            if (isNumeric) {
                const hasDecimals = columnData.some(val => String(val).includes('.'));
                sqlType = hasDecimals ? 'DECIMAL(10,2)' : 'INTEGER';
            } else if (maxLength <= 10) {
                sqlType = 'VARCHAR(10)';
            } else if (maxLength <= 50) {
                sqlType = 'VARCHAR(50)';
            } else if (maxLength <= 255) {
                sqlType = 'VARCHAR(255)';
            }
            
            const safeColumnName = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
            console.log(`  ${safeColumnName} ${sqlType},`);
        });
        
        console.log('  created_at TIMESTAMP DEFAULT NOW(),');
        console.log('  updated_at TIMESTAMP DEFAULT NOW()');
        console.log(');');
    });
}

function main() {
    const filePath = '/mnt/c/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';
    
    console.log('Dental Practice Codes Excel File Analyzer');
    console.log('='.repeat(50));
    
    const data = analyzeDentalExcel(filePath);
    
    if (data) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('SUMMARY');
        console.log(`${'='.repeat(60)}`);
        console.log(`Total sheets analyzed: ${Object.keys(data).length}`);
        
        Object.entries(data).forEach(([sheetName, sheetData]) => {
            const columns = sheetData.length > 0 ? Object.keys(sheetData[0]).length : 0;
            console.log(`  - ${sheetName}: ${sheetData.length} rows, ${columns} columns`);
        });
        
        // Generate database schema recommendations
        generateDatabaseSchema(data);
        
    } else {
        console.log('Failed to read Excel file');
    }
}

if (require.main === module) {
    main();
}