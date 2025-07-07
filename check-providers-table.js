import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProvidersTable() {
  console.log('=== CHECKING MEDICAL AID PROVIDERS TABLE ===\n');
  
  // Try to select with wildcard to see what columns exist
  const { data, error } = await supabase
    .from('medical_aid_providers')
    .select('*')
    .limit(5);
  
  if (error) {
    console.log('medical_aid_providers error:', error.message);
    console.log('\nTrying alternative table names...\n');
    
    const alternatives = ['medical_aid_provider', 'medical_aids', 'providers', 'medical_aid'];
    
    for (const tableName of alternatives) {
      console.log(`Checking table: ${tableName}`);
      const { data: altData, error: altError } = await supabase
        .from(tableName)
        .select('*')
        .limit(3);
      
      if (!altError && altData) {
        console.log(`✅ Found table: ${tableName}`);
        if (altData.length > 0) {
          console.log('Columns:', Object.keys(altData[0]));
          console.log('Sample data:');
          altData.forEach((row, index) => {
            console.log(`\nRecord ${index + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              console.log(`  ${key}: ${value}`);
            });
          });
        } else {
          console.log('Table exists but is empty');
        }
        console.log(''); // blank line
        break;
      } else {
        console.log(`❌ ${tableName}: ${altError?.message || 'not found'}`);
      }
    }
  } else {
    console.log('✅ medical_aid_providers table found!');
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('\nAll providers:');
      data.forEach((row, index) => {
        console.log(`\nProvider ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('Table exists but is empty');
    }
  }
  
  // Check if images exist in public folder
  console.log('\n=== CHECKING IMAGE FILES ===');
  console.log('Looking for medical aid logos in /home/happy/projects/hpms/public/images/medical-aids/');
  
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const imagesDir = '/home/happy/projects/hpms/public/images/medical-aids';
    const files = fs.readdirSync(imagesDir);
    
    console.log(`Found ${files.length} files:`);
    files.forEach(file => {
      console.log(`  - ${file}`);
    });
  } catch (error) {
    console.log('Error reading images directory:', error.message);
  }
}

checkProvidersTable();