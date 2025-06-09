#!/usr/bin/env node

// Simple Dental Migration Execution
// Uses direct SQL approach with proper error handling

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeDentalMigration() {
  console.log('🚀 EXECUTING DENTAL MIGRATION VIA SUPABASE CLIENT\n')
  
  try {
    // Read the complete dental codes data
    console.log('📋 Reading dental codes analysis...')
    const analysisData = JSON.parse(fs.readFileSync('/home/happy/projects/hpms/dental_codes_complete_analysis.json', 'utf8'))
    const complete179Codes = analysisData.complete_data
    
    console.log(`✅ Loaded ${complete179Codes.length} codes from analysis file`)
    
    // Step 1: Clear existing data
    console.log('\n🧹 Clearing existing tariff data...')
    const { error: deleteError } = await supabase
      .from('practice_tariffs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records
    
    if (deleteError) {
      console.log('⚠️  Delete warning:', deleteError.message)
    } else {
      console.log('✅ Existing data cleared')
    }
    
    // Step 2: Insert all 179 codes in batches
    console.log('\n📊 Inserting all 179 codes...')
    
    const batchSize = 20
    let totalInserted = 0
    
    for (let i = 0; i < complete179Codes.length; i += batchSize) {
      const batch = complete179Codes.slice(i, i + batchSize)
      
      const transformedBatch = batch.map(item => {
        // Handle special pricing for code 8346
        let price = parseFloat(item['Official 2025 Price (NAD)'])
        if (item['Official 2025 Price (NAD)'] === 'VARIES') {
          price = 50.84 // Default to tooth 11 price
        }
        
        return {
          code: parseInt(item.Code),
          description: item.Description,
          official_2025_price_nad: price,
          on_2025_list: item['On 2025 List'],
          found_in_claims: item['Found in Claims'],
          requires_tooth_number: item['Requires Tooth Number'],
          can_be_multiplied: item['Can Be Multiplied'],
          business_rule_formula: item['Business Rule/Formula'],
          example_calculation: item['Example Calculation'],
          notes: item.Notes || '',
          practice_type: 'dental'
        }
      })
      
      const { data, error } = await supabase
        .from('practice_tariffs')
        .insert(transformedBatch)
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message)
        console.error('Error details:', error)
      } else {
        totalInserted += transformedBatch.length
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${transformedBatch.length} codes inserted (Total: ${totalInserted})`)
      }
    }
    
    // Step 3: Verification
    console.log('\n🔍 Verifying import...')
    
    const { data: countData, error: countError } = await supabase
      .from('practice_tariffs')
      .select('*', { count: 'exact', head: true })
    
    if (!countError) {
      console.log(`✅ Total codes in database: ${countData?.length || 'unknown'}`)
    }
    
    // Sample verification
    const { data: sampleData, error: sampleError } = await supabase
      .from('practice_tariffs')
      .select('code, description, official_2025_price_nad, can_be_multiplied')
      .order('code')
      .limit(10)
    
    if (!sampleError && sampleData) {
      console.log('\n📋 Sample imported codes:')
      sampleData.forEach(code => {
        console.log(`   • ${code.code}: ${code.description.substring(0, 50)}... - N$${code.official_2025_price_nad}`)
      })
    }
    
    // Special case verification
    const { data: toothSpecific, error: toothError } = await supabase
      .from('practice_tariffs')
      .select('*')
      .eq('code', 8346)
      .single()
    
    if (!toothError && toothSpecific) {
      console.log(`\n✅ Tooth-specific code 8346 verified: ${toothSpecific.description}`)
    }
    
    console.log('\n🎉 MIGRATION COMPLETE!')
    console.log('===============================')
    console.log(`✅ Total codes processed: ${totalInserted}`)
    console.log(`✅ Expected: 179`)
    console.log(`✅ Success: ${totalInserted === 179 ? 'YES' : 'PARTIAL'}`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('Full error:', error)
  }
}

// Execute migration
executeDentalMigration()