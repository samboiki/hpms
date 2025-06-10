import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Medical Aid Provider structure (JSDoc type comment)
/**
 * @typedef {Object} MedicalAidProvider
 * @property {string} id
 * @property {string} name
 * @property {string} short_name
 * @property {string} logo_url
 * @property {string} contact_number
 * @property {string} email
 * @property {string} website
 * @property {string} address
 * @property {string} medical_aid_reference
 * @property {string} created_at
 * @property {string} updated_at
 */

// Fetch all medical aid providers from database
async function getMedicalAidProviders() {
  try {
    const { data, error } = await supabase
      .from('medical_aid_providers')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching medical aid providers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching medical aid providers:', error);
    return [];
  }
}

// Get logo URL for a medical aid provider
async function getProviderLogo(providerName) {
  try {
    const providers = await getMedicalAidProviders();
    
    // Try exact match first
    let matchedProvider = providers.find(p => 
      p.name.toLowerCase() === providerName.toLowerCase()
    );

    // Try short name match
    if (!matchedProvider) {
      matchedProvider = providers.find(p => 
        p.short_name.toLowerCase() === providerName.toLowerCase()
      );
    }

    // Try medical aid reference match
    if (!matchedProvider) {
      matchedProvider = providers.find(p => 
        p.medical_aid_reference.toLowerCase() === providerName.toLowerCase()
      );
    }

    // Try partial match
    if (!matchedProvider) {
      matchedProvider = providers.find(p => 
        p.name.toLowerCase().includes(providerName.toLowerCase()) ||
        providerName.toLowerCase().includes(p.name.toLowerCase()) ||
        p.short_name.toLowerCase().includes(providerName.toLowerCase()) ||
        providerName.toLowerCase().includes(p.short_name.toLowerCase())
      );
    }

    // Return database logo URL if matched
    if (matchedProvider) {
      return {
        provider: matchedProvider,
        logo: matchedProvider.logo_url,
        matchType: 'database'
      };
    }

    // Fallback to local images based on common providers
    const localLogos = {
      'discovery': '/images/medical-aids/discovery-logo.png',
      'bonitas': '/images/medical-aids/bonitas-logo.png',
      'old mutual': '/images/medical-aids/old-mutual-logo.png',
      'gemhealth': '/images/medical-aids/gemhealth-logo.png',
      'nmc': '/images/medical-aids/nmc-logo.png',
      'namibia medical care': '/images/medical-aids/nmc-logo.png',
      'nhp': '/images/medical-aids/nhp-logo.png',
      'namibia health plan': '/images/medical-aids/nhp-logo.png',
      'nammed': '/images/medical-aids/nammed-logo.png',
    };

    const lowerProvider = providerName.toLowerCase();
    for (const [key, logo] of Object.entries(localLogos)) {
      if (lowerProvider.includes(key) || key.includes(lowerProvider)) {
        return {
          provider: null,
          logo: logo,
          matchType: 'local'
        };
      }
    }

    return {
      provider: null,
      logo: '/images/medical-aids/default-medical-aid.svg',
      matchType: 'default'
    };

  } catch (error) {
    console.error('Error getting provider logo:', error);
    return {
      provider: null,
      logo: '/images/medical-aids/default-medical-aid.svg',
      matchType: 'error'
    };
  }
}

async function testMedicalAidLogos() {
  console.log('=== TESTING MEDICAL AID LOGO MATCHING ===\n');

  // Get sample providers from the database
  const { data: patientProviders, error } = await supabase
    .from('medical_aid_details')
    .select('provider')
    .not('provider', 'is', null);

  if (error) {
    console.error('Error fetching patient providers:', error);
    return;
  }

  // Get unique providers
  const uniqueProviders = [...new Set(patientProviders.map(p => p.provider))];
  
  console.log(`Testing logo matching for ${uniqueProviders.length} unique providers:\n`);

  for (const providerName of uniqueProviders) {
    const result = await getProviderLogo(providerName);
    
    console.log(`Provider: "${providerName}"`);
    console.log(`  Match Type: ${result.matchType}`);
    console.log(`  Logo URL: ${result.logo}`);
    if (result.provider) {
      console.log(`  Database Match: ${result.provider.name} (${result.provider.short_name})`);
      console.log(`  Reference: ${result.provider.medical_aid_reference}`);
    }
    console.log('');
  }

  // Test some additional cases
  console.log('\n=== TESTING ADDITIONAL CASES ===\n');
  
  const testCases = [
    'NMC',
    'NHP', 
    'NAMM',
    'Discovery Health',
    'Bonitas',
    'Unknown Provider'
  ];

  for (const testCase of testCases) {
    const result = await getProviderLogo(testCase);
    console.log(`Test: "${testCase}" → ${result.matchType} → ${result.logo}`);
  }
  
  console.log('\n✅ Logo matching test complete!');
}

testMedicalAidLogos();