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

export async function getPracticeByDomain(domain: string): Promise<Practice | null> {
  try {
    // For development, map localhost to test domains
    const domainMap: Record<string, string> = {
      'localhost:3000': 'cityclinic.vercel.app',
      'localhost:3001': 'coastalmed.vercel.app',
      'localhost:3002': 'drpolina.vercel.app',
      'dr-polina-landing.vercel.app': 'drpolina.vercel.app',
      'dr-polina-landing-onehealth.vercel.app': 'drpolina.vercel.app',
      'dr-polina-landing-28jdhmv7l-onehealth.vercel.app': 'drpolina.vercel.app',
      'healthpractice.vercel.app': 'drpolina.vercel.app',
    };

    const mappedDomain = domainMap[domain] || domain;
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
      
      return null;
    }

    if (!data) {
      if (domain.includes('dr-polina') || domain.includes('healthpractice')) {
        console.log('No practice found for domain, trying fallback for Dr. Polina...');
        return await getPracticeBySlug('dr-polina-aesthetics');
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