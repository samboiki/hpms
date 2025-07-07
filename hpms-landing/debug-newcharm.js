import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1NjcxNzQsImV4cCI6MjA0NzE0MzE3NH0.DdoMZCO7JIETSfKGvDXaMDdxCGqKhkyW0DGh0BTIZUY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugNewCharm() {
  console.log('🔍 Debugging NewCharm Practice...\n');
  
  // Check all practices
  const { data: practices, error: practicesError } = await supabase
    .from('practices')
    .select('id, slug, name, domain');
  
  if (practicesError) {
    console.error('❌ Error fetching practices:', practicesError);
  } else {
    console.log('📋 All practices in database:');
    practices?.forEach(p => {
      console.log(`   - ${p.name} (slug: ${p.slug}, domain: ${p.domain})`);
    });
  }
  
  console.log('\n🔍 Looking for NewCharm by slug...');
  const { data: newcharmBySlug, error: slugError } = await supabase
    .from('practices')
    .select('*')
    .eq('slug', 'newcharm-dental')
    .single();
  
  if (slugError) {
    console.error('❌ Error finding NewCharm by slug:', slugError);
  } else {
    console.log('✅ Found NewCharm by slug:', newcharmBySlug?.name);
    console.log('   Domain:', newcharmBySlug?.domain);
  }
  
  console.log('\n🔍 Looking for NewCharm by domains...');
  const domains = ['newcharm.vercel.app', 'www.newcharmdentalpractice.com', 'newcharmdentalpractice.com'];
  
  for (const domain of domains) {
    const { data, error } = await supabase
      .from('practices')
      .select('name, slug, domain')
      .eq('domain', domain)
      .single();
    
    if (error) {
      console.log(`   ❌ ${domain}: Not found`);
    } else {
      console.log(`   ✅ ${domain}: Found - ${data.name}`);
    }
  }
}

debugNewCharm();