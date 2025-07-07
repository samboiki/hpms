import { supabase } from './supabase';

export interface Practice {
  id: string;
  slug: string;
  name: string;
  domain: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  business_hours: {
    [key: string]: {
      open?: string;
      close?: string;
      closed?: boolean;
    };
  };
  features: {
    online_booking: boolean;
    telemedicine: boolean;
    lab_results: boolean;
    online_payments: boolean;
  };
  settings: Record<string, any>;
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
  about_text?: string;
  services: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export async function getPracticeByDomain(domain: string, searchParams?: URLSearchParams): Promise<Practice | null> {
  try {
    // 🚀 NEW: Multi-method practice selection for flexibility
    
    // Method 1: Query parameter override (highest priority)
    const practiceParam = searchParams?.get('practice');
    if (practiceParam) {
      console.log('🎯 Using practice from query parameter:', practiceParam);
      return await getPracticeBySlug(practiceParam);
    }
    
    // Method 2: Environment variable override (only if set)
    const envPractice = process.env.NEXT_PUBLIC_PRACTICE;
    if (envPractice && envPractice.trim() !== '') {
      console.log('🌍 Using practice from environment:', envPractice);
      return await getPracticeBySlug(envPractice);
    }
    
    // Method 3: Port-based mapping (backward compatibility)
    const domainMap: Record<string, string> = {
      'localhost:3000': 'cityclinic.vercel.app',
      'localhost:3001': 'coastalmed.vercel.app', 
      'localhost:3002': 'drpolina.vercel.app',
      'localhost:3003': 'newcharm.vercel.app',
      'dr-polina-landing.vercel.app': 'drpolina.vercel.app',
      'dr-polina-landing-onehealth.vercel.app': 'drpolina.vercel.app',
      'dr-polina-landing-28jdhmv7l-onehealth.vercel.app': 'drpolina.vercel.app',
      'healthpractice.vercel.app': 'drpolina.vercel.app',
      'newcharm.vercel.app': 'newcharm.vercel.app',
      'newcharm-dental.vercel.app': 'newcharm.vercel.app',
      'newcharmdentalpractice.com': 'newcharm.vercel.app',
      'www.newcharmdentalpractice.com': 'newcharm.vercel.app',
    };

    // Method 4: Use domain mapping or return null for practice directory
    let mappedDomain = domainMap[domain];
    
    // Handle Vercel preview deployments
    if (!mappedDomain && domain.includes('vercel.app')) {
      // Check for NewCharm preview deployments
      if (domain.includes('newcharm')) {
        console.log('🔍 Detected NewCharm preview deployment');
        return await getPracticeBySlug('newcharm-dental');
      }
      // Check for Dr. Polina preview deployments
      if (domain.includes('dr-polina') || domain.includes('drpolina')) {
        console.log('🔍 Detected Dr. Polina preview deployment');
        return await getPracticeBySlug('dr-polina-aesthetics');
      }
    }
    
    if (!mappedDomain && domain.includes('localhost')) {
      console.log('🏥 No specific practice mapping - will show practice directory');
      return null;
    } else {
      mappedDomain = mappedDomain || domain;
    }
    
    console.log('Looking for practice with domain:', mappedDomain);

    const { data, error } = await supabase
      .from('practices')
      .select('*')
      .eq('domain', mappedDomain)
      .single();

    if (error) {
      console.error('Error fetching practice:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      
      // Check if it's a table not found error
      if (error.code === '42P01') {
        console.error('❌ The practices table does not exist. Please run the migration first!');
        console.error('Run this SQL in your Supabase dashboard:');
        console.error('https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/sql/new');
      }
      
      // If domain not found, try fallback for Dr. Polina
      if (error.code === 'PGRST116' && (domain.includes('dr-polina') || domain.includes('healthpractice'))) {
        console.log('Falling back to Dr. Polina by slug...');
        return await getPracticeBySlug('dr-polina-aesthetics');
      }
      
      // If domain not found, try fallback for NewCharm
      if (error.code === 'PGRST116' && (domain.includes('newcharm'))) {
        console.log('Falling back to NewCharm by slug...');
        return await getPracticeBySlug('newcharm-dental');
      }
      
      return null;
    }

    if (!data) {
      if (domain.includes('dr-polina') || domain.includes('healthpractice')) {
        console.log('No practice found for domain, trying fallback for Dr. Polina...');
        return await getPracticeBySlug('dr-polina-aesthetics');
      }
      if (domain.includes('newcharm')) {
        console.log('No practice found for domain, trying fallback for NewCharm...');
        return await getPracticeBySlug('newcharm-dental');
      }
    }

    console.log('Practice found:', data?.name);
    return data;
  } catch (error) {
    console.error('Error in getPracticeByDomain:', error);
    
    // Final fallback for known domains
    if (domain.includes('dr-polina') || domain.includes('healthpractice')) {
      console.log('Exception fallback for Dr. Polina...');
      return await getPracticeBySlug('dr-polina-aesthetics');
    }
    if (domain.includes('newcharm')) {
      console.log('Exception fallback for NewCharm...');
      return await getPracticeBySlug('newcharm-dental');
    }
    
    return null;
  }
}

export async function getPracticeBySlug(slug: string): Promise<Practice | null> {
  try {
    const { data, error } = await supabase
      .from('practices')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching practice by slug:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getPracticeBySlug:', error);
    return null;
  }
}

export async function getPracticeDoctors(practiceId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('practice_id', practiceId)
      .in('user_metadata->>role', ['doctor', 'admin']);

    if (error) {
      console.error('Error fetching doctors:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPracticeDoctors:', error);
    return [];
  }
}