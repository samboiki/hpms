#!/usr/bin/env node

/**
 * Test Script for Improved PDF Extraction Edge Function
 * 
 * This script tests the updated extract-text edge function that uses
 * native pdf-parse instead of OCR.space API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testImprovedPDFExtraction(testFileUrl, supabaseUrl, supabaseAnonKey) {
  try {
    console.log('🔍 Testing improved PDF extraction edge function...');
    console.log('📄 Test file URL:', testFileUrl);
    
    // Call the updated edge function
    console.log('🤖 Calling extract-text edge function...');
    const response = await fetch(`${supabaseUrl}/functions/v1/extract-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: testFileUrl,
        fileType: 'application/pdf'
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge function error response:', errorText);
      throw new Error(`Edge function failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Edge function response received');
    console.log('📊 Response structure:', Object.keys(result));

    if (result.error) {
      console.error('❌ Edge function returned error:', result.error);
      console.error('💬 Error message:', result.message);
      console.error('🔍 Error details:', result.details);
      return false;
    }

    if (result.results && Array.isArray(result.results)) {
      console.log('🧪 Extracted lab results:');
      console.table(result.results);
      
      if (result.results.length === 0) {
        console.warn('⚠️ No lab results were extracted from the PDF');
        return false;
      }
      
      // Validate the structure of extracted results
      const validResults = result.results.every(r => 
        typeof r.testName === 'string' && 
        typeof r.value === 'string' && 
        typeof r.status === 'string'
      );
      
      if (!validResults) {
        console.error('❌ Invalid result structure detected');
        return false;
      }
      
      console.log('✅ All results have valid structure');
      return true;
    } else {
      console.error('❌ Expected results array not found in response');
      console.log('📄 Full response:', JSON.stringify(result, null, 2));
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Full error:', error);
    return false;
  }
}

async function testImageExtraction(testImageUrl, supabaseUrl, supabaseAnonKey) {
  try {
    console.log('🖼️ Testing image extraction (for comparison)...');
    
    const response = await fetch(`${supabaseUrl}/functions/v1/extract-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: testImageUrl,
        fileType: 'image/jpeg'
      })
    });

    if (!response.ok) {
      console.warn('⚠️ Image test failed, but this is expected if no test image is available');
      return false;
    }

    const result = await response.json();
    console.log('✅ Image extraction also working');
    return true;
    
  } catch (error) {
    console.warn('⚠️ Image test failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node test-improved-pdf-extraction.js <pdf-url> <supabase-url> <supabase-anon-key> [image-url]');
    console.log('');
    console.log('Examples:');
    console.log('  node test-improved-pdf-extraction.js https://example.com/lab-results.pdf https://xyz.supabase.co sk-xxx');
    console.log('  node test-improved-pdf-extraction.js https://example.com/lab-results.pdf https://xyz.supabase.co sk-xxx https://example.com/image.jpg');
    console.log('');
    console.log('This tests the improved PDF extraction that uses native pdf-parse instead of OCR.space API.');
    process.exit(1);
  }
  
  const pdfUrl = args[0];
  const supabaseUrl = args[1];
  const supabaseAnonKey = args[2];
  const imageUrl = args[3];
  
  console.log('🚀 Starting improved PDF extraction tests...');
  console.log('🏥 Supabase URL:', supabaseUrl);
  console.log('📄 PDF URL:', pdfUrl);
  if (imageUrl) {
    console.log('🖼️ Image URL:', imageUrl);
  }
  console.log('');
  
  try {
    // Test PDF extraction
    const pdfTestPassed = await testImprovedPDFExtraction(pdfUrl, supabaseUrl, supabaseAnonKey);
    
    // Test image extraction if URL provided
    let imageTestPassed = true;
    if (imageUrl) {
      imageTestPassed = await testImageExtraction(imageUrl, supabaseUrl, supabaseAnonKey);
    }
    
    console.log('');
    console.log('📋 Test Results Summary:');
    console.log(`📄 PDF Extraction: ${pdfTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    if (imageUrl) {
      console.log(`🖼️ Image Extraction: ${imageTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    if (pdfTestPassed && imageTestPassed) {
      console.log('🎉 All tests passed! The improved edge function is working correctly.');
    } else {
      console.log('💥 Some tests failed. Check the edge function logs for more details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testImprovedPDFExtraction, testImageExtraction };