#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Apply billing migration using Supabase client
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function applyBillingMigration() {
  console.log('📋 Applying Billing System Migration...\n');
  
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250608000000_billing_system_tables.sql', 'utf8');
    
    // Split into individual statements (basic approach)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Executing ${statements.length} migration statements...\n`);
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.trim() === '') {
        continue;
      }
      
      try {
        console.log(`${i + 1}/${statements.length}: Executing...`);
        
        const { error } = await supabase.rpc('sql', { 
          sql: statement + ';' 
        });
        
        if (error) {
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`   ⚠️  Skipped (already exists): ${error.message.substring(0, 60)}...`);
            skipCount++;
          } else {
            console.log(`   ❌ Error: ${error.message.substring(0, 80)}...`);
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message.substring(0, 80)}...`);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Skipped: ${skipCount}`);
    console.log(`   📊 Total: ${statements.length}`);
    
    // Verify the tables were created
    console.log('\n🔍 Verifying billing tables...');
    
    const tables = [
      'invoices_enhanced',
      'invoice_items_enhanced',
      'visit_services',
      'medical_aid_coverage',
      'payment_records',
      'practice_billing_settings'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: Available`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

applyBillingMigration().catch(console.error);