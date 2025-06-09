import fs from 'fs';

function readCSVDentalCodes() {
  try {
    // Try the Windows path first, then fallback to local files
    let csvPath = 'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.csv';
    
    // Check if the Windows path exists, if not, look for similar files locally
    let csvContent;
    try {
      csvContent = fs.readFileSync(csvPath, 'utf8');
      console.log(`✅ Successfully reading from: ${csvPath}`);
    } catch (error) {
      console.log(`❌ Could not read from ${csvPath}, trying local files...`);
      
      // Try to find similar files locally
      const localFiles = [
        './dentalpractice_codes_2025.csv',
        './dental_codes_2025.csv',
        './2025_dental_codes.csv'
      ];
      
      let found = false;
      for (const localPath of localFiles) {
        try {
          csvContent = fs.readFileSync(localPath, 'utf8');
          console.log(`✅ Successfully reading from: ${localPath}`);
          found = true;
          break;
        } catch (e) {
          console.log(`❌ ${localPath} not found`);
        }
      }
      
      if (!found) {
        console.error('❌ Could not find the dental codes CSV file in any location');
        console.log('Please copy the file to one of these locations:');
        console.log('- ./dentalpractice_codes_2025.csv');
        console.log('- ./dental_codes_2025.csv');
        return;
      }
    }
    
    // Parse CSV content
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log(`📊 Found ${lines.length} lines in CSV`);
    
    if (lines.length === 0) {
      console.error('❌ CSV file is empty');
      return;
    }
    
    // Detect delimiter (semicolon vs comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    console.log(`📋 Using delimiter: '${delimiter}'`);
    
    // Get headers
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    console.log('📋 Headers found:', headers);
    
    // Expected headers based on your specification
    const expectedHeaders = [
      'Code', 'Description', 'Official 2025 Price (NAD)', 'On 2025 List', 
      'Found in Claims', 'Requires Tooth Number', 'Can Be Multiplied', 
      'Business Rule/Formula', 'Example Calculation', 'Notes'
    ];
    
    console.log('\n=== COLUMN MAPPING ===');
    expectedHeaders.forEach(expected => {
      const found = headers.find(h => 
        h.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(h.toLowerCase())
      );
      console.log(`${expected}: ${found ? '✅ ' + found : '❌ NOT FOUND'}`);
    });
    
    // Parse data rows
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        // Only include rows with dental codes (starting with 8)
        const code = row.Code || row.code || row.CODE;
        if (code && code.toString().startsWith('8')) {
          dataRows.push(row);
        }
      }
    }
    
    console.log(`\n📋 Found ${dataRows.length} dental codes (starting with 8)`);
    
    if (dataRows.length === 0) {
      console.error('❌ No dental codes found in the CSV');
      return;
    }
    
    // Show first 5 rows
    console.log('\n=== FIRST 5 DENTAL CODES ===');
    console.table(dataRows.slice(0, 5));
    
    // Save the data for import
    const outputFile = '/home/happy/projects/hpms/dental_codes_179_from_csv.json';
    fs.writeFileSync(outputFile, JSON.stringify(dataRows, null, 2));
    console.log(`\n💾 Saved ${dataRows.length} dental codes to: ${outputFile}`);
    
    // Check if we have 179 codes
    if (dataRows.length === 179) {
      console.log('✅ Perfect! Found exactly 179 dental codes as expected');
    } else {
      console.log(`⚠️  Expected 179 codes but found ${dataRows.length}`);
    }
    
    return dataRows;
    
  } catch (error) {
    console.error('Error reading CSV file:', error);
  }
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // Don't forget the last field
  return result;
}

readCSVDentalCodes();