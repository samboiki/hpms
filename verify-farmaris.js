import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function verifyFarmaris() {
  console.log('🔍 Verifying Farmaris practice in database...\n');

  try {
    // Use the standard Supabase client query instead of raw SQL
    const { data, error } = await supabase
      .from('practices')
      .select('id, slug, name, domain, contact_email, contact_phone, city, country, hero_title, hero_subtitle, created_at')
      .eq('slug', 'farmaris')
      .single();

    if (error) {
      console.error('❌ Error querying practice:', error);
      return;
    }

    if (data) {
      console.log('🎉 SUCCESS! Farmaris practice found in database!');
      console.log('\n📊 Practice Details:');
      console.log(`- ✅ Practice ID: ${data.id}`);
      console.log(`- ✅ Slug: ${data.slug}`);
      console.log(`- ✅ Name: ${data.name}`);
      console.log(`- ✅ Domain: ${data.domain}`);
      console.log(`- ✅ Contact Email: ${data.contact_email}`);
      console.log(`- ✅ Contact Phone: ${data.contact_phone}`);
      console.log(`- ✅ Location: ${data.city}, ${data.country}`);
      console.log(`- ✅ Hero Title: ${data.hero_title}`);
      console.log(`- ✅ Hero Subtitle: ${data.hero_subtitle}`);
      console.log(`- ✅ Created: ${data.created_at}`);
      console.log('\n🌟 The practice is ready for the grand opening event!');
    } else {
      console.log('⚠️ Farmaris practice not found in database');
    }
  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

verifyFarmaris();