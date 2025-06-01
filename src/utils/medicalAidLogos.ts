// Medical Aid Logo Mapping for Namibian Medical Aid Providers
export const medicalAidLogos: Record<string, string> = {
  // Namibian Medical Aid Providers
  'Namibia Medical Care': '/images/medical-aids/nmc-logo.png',
  'NMC': '/images/medical-aids/nmc-logo.png',
  'Namibia Health Plan': '/images/medical-aids/nhp-logo.png',
  'NHP': '/images/medical-aids/nhp-logo.png',
  'Nammed Medical Aid Fund': '/images/medical-aids/nammed-logo.png',
  'Nammed': '/images/medical-aids/nammed-logo.png',
  'Gemhealth Medical Aid': '/images/medical-aids/gemhealth-logo.png',
  'Gemhealth': '/images/medical-aids/gemhealth-logo.png',
  'GemHealth': '/images/medical-aids/gemhealth-logo.png',
  
  // South African Medical Aids operating in Namibia
  'Bonitas Medical Fund': '/images/medical-aids/bonitas-logo.png',
  'Bonitas': '/images/medical-aids/bonitas-logo.png',
  'Discovery Health': '/images/medical-aids/discovery-logo.png',
  'Discovery': '/images/medical-aids/discovery-logo.png',
  'Old Mutual Health': '/images/medical-aids/old-mutual-logo.png',
  'Old Mutual': '/images/medical-aids/old-mutual-logo.png',
  
  // Additional providers (using generic fallback)
  'Momentum Health': '/images/medical-aids/momentum-logo.png',
  'Momentum': '/images/medical-aids/momentum-logo.png',
  'Medshield': '/images/medical-aids/medshield-logo.png',
  'Renaissance Health': '/images/medical-aids/renaissance-logo.png',
  'Heritage Health': '/images/medical-aids/heritage-logo.png',
  'Napotel': '/images/medical-aids/napotel-logo.png',
  'Namdeb Medical Scheme': '/images/medical-aids/namdeb-logo.png',
  'Prosperity Health': '/images/medical-aids/prosperity-logo.png',
};

// Fallback logo for unknown medical aids
export const defaultMedicalAidLogo = '/images/medical-aids/default-medical-aid.svg';

// Function to get medical aid logo
export const getMedicalAidLogo = (provider: string): string => {
  // Try exact match first
  if (medicalAidLogos[provider]) {
    return medicalAidLogos[provider];
  }
  
  // Try case-insensitive partial match
  const lowerProvider = provider.toLowerCase();
  for (const [key, logo] of Object.entries(medicalAidLogos)) {
    if (key.toLowerCase().includes(lowerProvider) || lowerProvider.includes(key.toLowerCase())) {
      return logo;
    }
  }
  
  return defaultMedicalAidLogo;
};

// Common Namibian Medical Aid Schemes/Options
export const commonMedicalAidSchemes: Record<string, string[]> = {
  'Namibia Medical Care': ['Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze'],
  'NMC': ['Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze'],
  'Namibia Health Plan': ['Comprehensive', 'Executive', 'Standard', 'Essential'],
  'NHP': ['Comprehensive', 'Executive', 'Standard', 'Essential'],
  'Discovery Health': ['Executive Plan', 'Comprehensive', 'Essential', 'Smart Plan'],
  'Bonitas Medical Fund': ['BonComprehensive', 'BonEssential', 'BonCap', 'BonStart'],
  'Nammed': ['Comprehensive', 'Standard', 'Essential'],
  'Gemhealth': ['Premium', 'Standard', 'Basic'],
};

// Function to get schemes for a provider
export const getSchemesForProvider = (provider: string): string[] => {
  return commonMedicalAidSchemes[provider] || ['Standard', 'Comprehensive', 'Essential'];
};