#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function checkVitalsSchema() {
  console.log('🔍 Checking vitals table structure...');
  
  try {
    const { data: vitals, error } = await supabase
      .from('vitals')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error accessing vitals table:', error.message);
      return;
    }
    
    if (vitals && vitals.length > 0) {
      console.log('✅ Vitals table structure:');
      console.log('📋 Available columns:', Object.keys(vitals[0]));
    } else {
      console.log('⚠️  No existing vitals found, checking table structure differently');
      
      // Try inserting a minimal record to see what columns are required
      const { error: insertError } = await supabase
        .from('vitals')
        .insert([{ visit_id: 'test' }]);
      
      if (insertError) {
        console.log('Schema hint from insert error:', insertError.message);
      }
    }
  } catch (error) {
    console.log('❌ Error checking vitals:', error.message);
  }
}

checkVitalsSchema();