#!/usr/bin/env node

/**
 * Local PDF Extraction Test Script
 * 
 * This script demonstrates how to use the OpenAI API directly for PDF processing
 * as implemented in the updated extract-text edge function.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPDFExtraction(pdfPath, openaiApiKey) {
  try {
    console.log('🔍 Testing PDF extraction locally...');
    
    // Check if PDF file exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    // Read PDF file and convert to base64
    console.log('📄 Reading PDF file...');
    const pdfData = fs.readFileSync(pdfPath);
    const base64String = pdfData.toString('base64');
    
    console.log(`📊 PDF size: ${base64String.length} characters (base64)`);
    
    // Call OpenAI API with PDF input
    console.log('🤖 Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a medical lab results analyzer. Extract ALL test results from the provided PDF document. 
            For each result, provide:
            - Test name
            - Value
            - Unit
            - Reference range
            - Status (normal/high/low/critical)
            
            Format each result as a separate JSON object in an array. Example:
            [
              {
                "testName": "Glucose",
                "value": "95",
                "unit": "mg/dL",
                "referenceRange": "70-100",
                "status": "normal"
              }
            ]`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this lab result PDF and extract ALL test results. Return them as a JSON array.'
              },
              {
                type: 'image_url',
                image_url: { 
                  url: `data:application/pdf;base64,${base64String}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('✅ OpenAI API response received');
    console.log('📝 Raw analysis:', analysis);

    // Parse the JSON response
    const jsonMatch = analysis.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const labResults = JSON.parse(jsonMatch[0]);
    
    console.log('🧪 Extracted lab results:');
    console.table(labResults);
    
    return labResults;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node test-pdf-extraction-local.js <pdf-file-path> [openai-api-key]');
    console.log('');
    console.log('Examples:');
    console.log('  node test-pdf-extraction-local.js ./lab-results.pdf');
    console.log('  node test-pdf-extraction-local.js ./lab-results.pdf sk-...');
    console.log('');
    console.log('If OpenAI API key is not provided, it will be read from OPENAI_API_KEY environment variable.');
    process.exit(1);
  }
  
  const pdfPath = args[0];
  const openaiApiKey = args[1] || process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('❌ OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass it as an argument.');
    process.exit(1);
  }
  
  try {
    const results = await testPDFExtraction(pdfPath, openaiApiKey);
    console.log('🎉 PDF extraction test completed successfully!');
  } catch (error) {
    console.error('💥 PDF extraction test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testPDFExtraction };