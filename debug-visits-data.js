#!/usr/bin/env node

/**
 * Debug script to test visits data queries directly
 * This will help us understand why the dashboard shows 0 visits
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVisitsQueries() {
  console.log('🧪 Testing visits queries...\n');
  
  // Check current auth state
  console.log('Auth Check:');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  console.log('Current user:', authData.user?.id || 'Not authenticated');
  console.log('Auth error:', authError);
  console.log('');
  
  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
  const monthStart = '2025-06-01';
  const monthEnd = '2025-06-30';
  
  // Test 1: Simple count
  console.log('Test 1: Simple visits count');
  const countResult = await supabase
    .from('visits')
    .select('id', { count: 'exact' })
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd);
  
  console.log('Total visits in June:', countResult.count);
  console.log('Error:', countResult.error);
  console.log('');
  
  // Test 2: Count by practice ID
  console.log('Test 2: Visits by practice ID');
  const practiceCountResult = await supabase
    .from('visits')
    .select('id', { count: 'exact' })
    .eq('practice_id', practiceId)
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd);
  
  console.log('Practice visits in June:', practiceCountResult.count);
  console.log('Error:', practiceCountResult.error);
  console.log('');
  
  // Test 3: Include null practice IDs
  console.log('Test 3: Include null practice IDs');
  const nullIncludedResult = await supabase
    .from('visits')
    .select('id', { count: 'exact' })
    .or(`practice_id.eq.${practiceId},practice_id.is.null`)
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd);
  
  console.log('Visits (practice + null) in June:', nullIncludedResult.count);
  console.log('Error:', nullIncludedResult.error);
  console.log('');
  
  // Test 4: Complex query with patient data
  console.log('Test 4: Complex query with patient data');
  const complexResult = await supabase
    .from('visits')
    .select(`
      id,
      visit_date,
      status,
      scheduled_time,
      practice_id,
      patient:patient_id(
        id,
        first_name,
        last_name,
        date_of_birth,
        gender
      )
    `)
    .or(`practice_id.eq.${practiceId},practice_id.is.null`)
    .gte('visit_date', monthStart)
    .lte('visit_date', monthEnd)
    .limit(10);
  
  console.log('Complex query visits:', complexResult.data?.length || 0);
  console.log('Error:', complexResult.error);
  console.log('Sample:', complexResult.data?.[0]);
  console.log('');
  
  // Test 5: Gender distribution
  if (complexResult.data && complexResult.data.length > 0) {
    console.log('Test 5: Gender distribution analysis');
    const genderCounts = {};
    complexResult.data.forEach(visit => {
      const gender = visit.patient?.gender || 'unknown';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });
    console.log('Gender distribution:', genderCounts);
    console.log('');
  }
  
  console.log('✅ Debug complete!');
}

testVisitsQueries().catch(console.error);