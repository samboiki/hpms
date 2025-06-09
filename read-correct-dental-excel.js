import XLSX from 'xlsx';
import fs from 'fs';

function readCorrectDentalExcel() {
  try {
    // Try the Windows path first, then fallback to local files
    let excelPath = 'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx';
    
    // Check if the Windows path exists, if not, look for similar files locally
    try {
      const workbook = XLSX.readFile(excelPath);
      console.log(`✅ Successfully reading from: ${excelPath}`);
      processWorkbook(workbook);
    } catch (error) {
      console.log(`❌ Could not read from ${excelPath}, trying local files...`);
      
      // Try to find similar files locally
      const localFiles = [
        './dentalpractice_codes_2025.xlsx',
        './2025_Dental_Pricing_Table.xlsx',
        './dental_codes_2025.xlsx'
      ];
      
      let found = false;
      for (const localPath of localFiles) {
        try {
          const workbook = XLSX.readFile(localPath);
          console.log(`✅ Successfully reading from: ${localPath}`);
          processWorkbook(workbook);
          found = true;
          break;
        } catch (e) {
          console.log(`❌ ${localPath} not found`);
        }
      }
      
      if (!found) {
        console.error('❌ Could not find the dental codes Excel file in any location');
        console.log('Please ensure the file exists at one of these locations:');
        console.log('- c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx');
        console.log('- ./dentalpractice_codes_2025.xlsx');
        console.log('- ./2025_Dental_Pricing_Table.xlsx');
      }
    }
    
  } catch (error) {
    console.error('Error reading Excel file:', error);
  }
}

function processWorkbook(workbook) {
  console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);
  
  // Look for the main sheet with dental codes
  const mainSheet = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('dental') || 
    name.toLowerCase().includes('codes') ||
    name.toLowerCase().includes('sheet1') ||
    workbook.SheetNames.indexOf(name) === 0 // first sheet as fallback
  );
  
  if (!mainSheet) {
    console.error('❌ Could not find the main dental codes sheet');
    return;
  }
  
  console.log(`📋 Reading from sheet: ${mainSheet}`);
  
  const worksheet = workbook.Sheets[mainSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Found ${jsonData.length} rows`);
  
  if (jsonData.length === 0) {
    console.error('❌ No data found in the sheet');
    return;
  }
  
  // Show the columns to verify structure
  console.log(`Columns found: ${Object.keys(jsonData[0]).join(', ')}`);
  
  // Look for the expected columns from your specification
  const expectedColumns = [
    'Code', 'Description', 'Official 2025 Price (NAD)', 'On 2025 List', 
    'Found in Claims', 'Requires Tooth Number', 'Can Be Multiplied', 
    'Business Rule/Formula', 'Example Calculation', 'Notes'
  ];
  
  const firstRow = jsonData[0];
  const foundColumns = Object.keys(firstRow);
  
  console.log('\n=== COLUMN MAPPING ANALYSIS ===');
  expectedColumns.forEach(expected => {
    const found = foundColumns.find(col => 
      col.toLowerCase().includes(expected.toLowerCase()) ||
      expected.toLowerCase().includes(col.toLowerCase())
    );
    console.log(`${expected}: ${found ? '✅ ' + found : '❌ NOT FOUND'}`);
  });
  
  // Filter for codes starting with 8 (dental codes)
  const dentalCodes = jsonData.filter(row => {
    const code = row.Code || row.code || row.CODE;
    return code && code.toString().startsWith('8');
  });
  
  console.log(`\n📋 Found ${dentalCodes.length} dental codes (starting with 8)`);
  
  // Show first 5 rows to verify data
  console.log('\n=== FIRST 5 DENTAL CODES ===');
  console.table(dentalCodes.slice(0, 5));
  
  // Save full data for import
  const outputFile = '/home/happy/projects/hpms/correct_dental_codes_179.json';
  fs.writeFileSync(outputFile, JSON.stringify(dentalCodes, null, 2));
  console.log(`\n💾 Saved ${dentalCodes.length} dental codes to: ${outputFile}`);
  
  // Verify we have the expected 179 codes
  if (dentalCodes.length === 179) {
    console.log('✅ Perfect! Found exactly 179 dental codes as expected');
  } else {
    console.log(`⚠️  Expected 179 codes but found ${dentalCodes.length}`);
  }
}

readCorrectDentalExcel();