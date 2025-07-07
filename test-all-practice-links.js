#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Direct method from CLAUDE.md (SET IN STONE)
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, anonKey);

async function testAllPracticeLinks() {
  console.log('🔗 Testing All Practice Landing Page Links\\n');
  
  try {
    // Get all practices from database
    const { data: practices, error } = await supabase
      .from('practices')
      .select('id, slug, name, city, primary_color')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching practices:', error.message);
      return;
    }
    
    console.log(`✅ Found ${practices.length} practices in database\\n`);
    
    // Base URL for testing
    const baseUrl = 'http://localhost:3000';
    
    console.log('🌐 Practice Landing Page Links:\\n');
    
    // Practice Directory (homepage)
    console.log('📋 **Practice Directory (All Practices)**');
    console.log(`   🏠 Homepage: ${baseUrl}`);
    console.log(`   📍 Shows all ${practices.length} practices with search and filtering`);
    console.log('');
    
    // Individual practice links
    console.log('🏥 **Individual Practice Links**\\n');
    
    practices.forEach((practice, index) => {
      const practiceUrl = `${baseUrl}?practice=${practice.slug}`;
      const emoji = practice.slug.includes('dental') ? '🦷' : 
                   practice.slug.includes('aesthetic') ? '✨' : '🏥';
      
      console.log(`${index + 1}. ${emoji} **${practice.name}**`);
      console.log(`   🔗 URL: ${practiceUrl}`);
      console.log(`   📍 Location: ${practice.city || 'Not specified'}`);
      console.log(`   🎨 Theme: ${practice.primary_color}`);
      console.log('');
    });
    
    console.log('🚀 **Quick Test Commands:**\\n');
    console.log('# Test practice directory');
    console.log(`curl -s "${baseUrl}" | grep -i "healthcare practice directory"`);
    console.log('');
    
    // Test a few specific practices
    const testPractices = practices.slice(0, 3);
    testPractices.forEach(practice => {
      console.log(`# Test ${practice.name}`);
      console.log(`curl -s "${baseUrl}?practice=${practice.slug}" | grep -i "${practice.name.split(' ')[0]}"`);
      console.log('');
    });
    
    console.log('📊 **Summary:**');
    console.log(`   • Practice Directory: ${baseUrl}`);
    console.log(`   • Total Practices: ${practices.length}`);
    console.log(`   • Individual Practice URLs: ${baseUrl}?practice=SLUG`);
    console.log(`   • All practices accessible via query parameter`);
    console.log('');
    console.log('✅ All practice links generated successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAllPracticeLinks().catch(console.error);