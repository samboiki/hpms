import XLSX from 'xlsx';
import fs from 'fs';

function readDentalExcel() {
  try {
    // Path to the Excel file
    const excelPath = './2025_Dental_Pricing_Table.xlsx';
    
    console.log(`Reading Excel file: ${excelPath}`);
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelPath);
    
    console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Read each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n=== READING SHEET: ${sheetName} ===`);
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`Number of rows: ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        console.log(`Columns: ${Object.keys(jsonData[0]).join(', ')}`);
        
        // Show first few rows
        console.log('\n=== FIRST 3 ROWS ===');
        console.table(jsonData.slice(0, 3));
        
        // Save sample data
        const sampleData = jsonData.slice(0, 10);
        const fileName = `/home/happy/projects/hpms/dental_codes_sample_${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        fs.writeFileSync(fileName, JSON.stringify(sampleData, null, 2));
        console.log(`Sample data saved to: ${fileName}`);
        
        // If this looks like the main data sheet, save full data too
        if (jsonData.length > 50) {
          const fullFileName = `/home/happy/projects/hpms/dental_codes_full_${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
          fs.writeFileSync(fullFileName, JSON.stringify(jsonData, null, 2));
          console.log(`Full data saved to: ${fullFileName}`);
          
          // Analyze data structure for database import
          console.log('\n=== DATA ANALYSIS ===');
          const columns = Object.keys(jsonData[0]);
          console.log('Available columns:');
          columns.forEach(col => {
            const sampleValues = jsonData.slice(0, 5).map(row => row[col]).filter(val => val !== undefined && val !== null && val !== '');
            console.log(`  - ${col}: ${sampleValues.join(', ')}`);
          });
          
          // Look for code and price columns
          const codeColumn = columns.find(col => col.toLowerCase().includes('code') || col.toLowerCase().includes('procedur'));
          const priceColumn = columns.find(col => col.toLowerCase().includes('price') || col.toLowerCase().includes('fee') || col.toLowerCase().includes('tariff'));
          const nameColumn = columns.find(col => col.toLowerCase().includes('name') || col.toLowerCase().includes('description') || col.toLowerCase().includes('procedur'));
          
          console.log('\n=== MAPPED COLUMNS ===');
          console.log(`Code column: ${codeColumn}`);
          console.log(`Price column: ${priceColumn}`);
          console.log(`Name column: ${nameColumn}`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error reading Excel file:', error);
  }
}

readDentalExcel();