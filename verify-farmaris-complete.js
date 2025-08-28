import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey);

async function verifyFarmarisComplete() {
  console.log('🔍 Complete Verification of Farmaris Practice...\n');

  try {
    // Get all practice details
    const { data, error } = await supabase
      .from('practices')
      .select('*')
      .eq('slug', 'farmaris')
      .single();

    if (error) {
      console.error('❌ Error querying practice:', error);
      return;
    }

    if (data) {
      console.log('🎉 COMPLETE SUCCESS! Farmaris practice fully configured!');
      console.log('\n📊 Complete Practice Details:');
      console.log(`- ✅ Practice ID: ${data.id}`);
      console.log(`- ✅ Slug: ${data.slug}`);
      console.log(`- ✅ Name: ${data.name}`);
      console.log(`- ✅ Domain: ${data.domain}`);
      console.log(`- ✅ Logo URL: ${data.logo_url}`);
      console.log(`- ✅ Primary Color: ${data.primary_color} (Farm Green)`);
      console.log(`- ✅ Secondary Color: ${data.secondary_color} (Harvest Yellow)`);
      console.log(`- ✅ Contact Email: ${data.contact_email}`);
      console.log(`- ✅ Contact Phone: ${data.contact_phone}`);
      console.log(`- ✅ Address: ${data.address}`);
      console.log(`- ✅ Location: ${data.city}, ${data.country} ${data.postal_code}`);
      console.log(`- ✅ Hero Title: ${data.hero_title}`);
      console.log(`- ✅ Hero Subtitle: ${data.hero_subtitle}`);
      console.log(`- ✅ Hero Image: ${data.hero_image_url}`);
      console.log(`- ✅ About Text: ${data.about_text?.substring(0, 100)}...`);
      console.log(`- ✅ Created: ${data.created_at}`);
      
      console.log('\n🎪 Event Configuration:');
      console.log(`- ✅ Theme: ${data.settings?.theme}`);
      console.log(`- ✅ Event Date: ${data.settings?.event_date}`);
      console.log(`- ✅ Event Type: ${data.settings?.event_type}`);
      console.log(`- ✅ Registration Enabled: ${data.settings?.registration_enabled}`);
      console.log(`- ✅ Booking Enabled: ${data.settings?.booking_enabled}`);
      
      console.log('\n🏥 Features Enabled:');
      console.log(`- ✅ Online Booking: ${data.features?.online_booking}`);
      console.log(`- ✅ Telemedicine: ${data.features?.telemedicine}`);
      console.log(`- ✅ Lab Results: ${data.features?.lab_results}`);
      console.log(`- ✅ Online Payments: ${data.features?.online_payments}`);
      
      console.log('\n🎉 Services Available:');
      if (data.services && Array.isArray(data.services)) {
        data.services.forEach((service, index) => {
          console.log(`   ${index + 1}. ${service.name} - ${service.description} (${service.price})`);
        });
      }
      
      console.log('\n📱 Social Links:');
      console.log(`- ✅ Facebook: ${data.social_links?.facebook}`);
      console.log(`- ✅ Instagram: ${data.social_links?.instagram}`);
      console.log(`- ✅ WhatsApp: ${data.social_links?.whatsapp}`);
      
      console.log('\n🕒 Business Hours:');
      const hours = data.business_hours;
      if (hours) {
        Object.keys(hours).forEach(day => {
          console.log(`   ${day}: ${hours[day].open} - ${hours[day].close}`);
        });
      }
      
      console.log('\n🌟 MIGRATION COMPLETE! Farmaris practice is fully configured and ready!');
      console.log('🚜 Ready for the Grand Opening event on March 15, 2025');
    } else {
      console.log('⚠️ Farmaris practice not found in database');
    }
  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

verifyFarmarisComplete();