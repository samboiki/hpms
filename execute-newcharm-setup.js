#!/usr/bin/env node

// Direct execution script for NewCharm setup
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSetup() {
  console.log('🚀 Executing NewCharm setup directly...\n');

  try {
    // Step 1: Check if practices table exists
    console.log('📋 Checking database structure...');
    const { data: practices, error: practicesError } = await supabase
      .from('practices')
      .select('*')
      .limit(1);

    if (practicesError) {
      console.error('❌ Error accessing practices table:', practicesError.message);
      console.log('🔧 Need to run migration first. The table might not exist yet.');
      return;
    }

    console.log('✅ Practices table exists');

    // Step 2: Create storage bucket
    console.log('📁 Creating storage bucket...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'practice-images');

    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket('practice-images', {
        public: true,
        fileSizeLimit: 52428800
      });

      if (bucketError) {
        console.error('❌ Error creating bucket:', bucketError.message);
      } else {
        console.log('✅ Storage bucket created');
      }
    } else {
      console.log('✅ Storage bucket already exists');
    }

    // Step 3: Insert NewCharm practice
    console.log('🦷 Setting up NewCharm practice...');
    
    const newcharmData = {
      slug: 'newcharm-dental',
      name: 'NewCharm Dental Practice',
      domain: 'newcharm.vercel.app',
      logo_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      primary_color: '#00BCD4',
      secondary_color: '#0097A7',
      contact_email: 'info@newcharmdental.na',
      contact_phone: '+264 61 234 567',
      address: '123 Independence Avenue',
      city: 'Windhoek',
      country: 'Namibia',
      postal_code: '10001',
      business_hours: {
        monday: { open: "08:00", close: "17:00" },
        tuesday: { open: "08:00", close: "17:00" },
        wednesday: { open: "08:00", close: "17:00" },
        thursday: { open: "08:00", close: "17:00" },
        friday: { open: "08:00", close: "16:00" },
        saturday: { open: "09:00", close: "13:00" },
        sunday: { closed: true }
      },
      features: {
        online_booking: true,
        telemedicine: true,
        lab_results: false,
        online_payments: true,
        emergency_care: true,
        digital_xrays: true,
        laser_dentistry: true
      },
      hero_title: 'Your Smile, Our Passion',
      hero_subtitle: 'Modern dental care with a personal touch. Experience comfort, quality, and the latest in dental technology at NewCharm Dental Practice.',
      hero_image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      about_text: 'At NewCharm Dental Practice, we believe that everyone deserves a healthy, beautiful smile. Our state-of-the-art facility in the heart of Windhoek combines cutting-edge dental technology with compassionate, personalized care.',
      services: [
        {
          id: "general-dentistry",
          name: "General Dentistry",
          description: "Comprehensive dental care for your entire family",
          icon: "Shield"
        },
        {
          id: "cosmetic-dentistry",
          name: "Cosmetic Dentistry", 
          description: "Enhance your smile with our advanced cosmetic procedures",
          icon: "Sparkles"
        },
        {
          id: "orthodontics",
          name: "Orthodontics",
          description: "Straighten your teeth with modern orthodontic solutions",
          icon: "Smile"
        },
        {
          id: "oral-surgery",
          name: "Oral Surgery",
          description: "Specialized surgical procedures for complex dental needs",
          icon: "Activity"
        },
        {
          id: "emergency-care",
          name: "Emergency Dental Care",
          description: "Immediate dental care when you need it most",
          icon: "AlertTriangle"
        },
        {
          id: "preventive-care",
          name: "Preventive Care",
          description: "Proactive care to maintain optimal oral health",
          icon: "Heart"
        }
      ],
      testimonials: [
        {
          author: "Sarah Williams",
          rating: 5,
          text: "I had my teeth whitened at NewCharm and the results were amazing! The staff was so professional and made me feel comfortable throughout the entire process. My smile has never looked better!",
          date: "2024-12-01",
          treatment: "Teeth Whitening"
        },
        {
          author: "Michael Johnson",
          rating: 5,
          text: "Dr. Smith and the team at NewCharm saved my tooth with an excellent root canal treatment. What I expected to be painful was actually quite comfortable. Their technology and skill are impressive.",
          date: "2024-11-28",
          treatment: "Root Canal Treatment"
        }
      ],
      metadata: {
        before_after_gallery: [
          {
            id: "1",
            before: "https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
            after: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
            title: "Complete Smile Makeover",
            treatment: "Veneers & Teeth Whitening",
            duration: "3 weeks"
          }
        ],
        gallery_images: [
          "https://images.unsplash.com/photo-1579684385127-1ef15d508118?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
        ]
      }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('practices')
      .upsert(newcharmData, { onConflict: 'slug' })
      .select();

    if (insertError) {
      console.error('❌ Error inserting NewCharm:', insertError.message);
    } else {
      console.log('✅ NewCharm practice created/updated successfully!');
    }

    console.log('\n🎉 Setup complete! Try visiting:');
    console.log('   • http://localhost:3000?practice=newcharm-dental');
    console.log('   • http://localhost:3000 (if env var is set)');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

executeSetup();