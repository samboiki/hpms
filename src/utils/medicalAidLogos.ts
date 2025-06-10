// Medical Aid Logo Mapping for Namibian Medical Aid Providers
export const medicalAidLogos: Record<string, string> = {
  // Database providers with available logos
  'Namibia Medical Care': '/images/medical-aids/nmc-logo.png',
  'NMC': '/images/medical-aids/nmc-logo.png',
  'Namibia Health Plan': '/images/medical-aids/nhp-logo.png',
  'NHP': '/images/medical-aids/nhp-logo.png',
  'Nammed Medical Aid Fund': '/images/medical-aids/nammed-logo.png',
  'Nammed': '/images/medical-aids/nammed-logo.png',
  'Gemhealth Medical Aid': '/images/medical-aids/gemhealth-logo.png',
  'Gemhealth': '/images/medical-aids/gemhealth-logo.png',
  'GemHealth': '/images/medical-aids/gemhealth-logo.png',
  
  // Database providers without specific logos (will use default)
  'Renaissance Health Medical Aid Fund': '/images/medical-aids/default-medical-aid.svg',
  'Renaissance': '/images/medical-aids/default-medical-aid.svg',
  'Napotel Medical Aid': '/images/medical-aids/default-medical-aid.svg',
  'Napotel': '/images/medical-aids/default-medical-aid.svg',
  'Bankmed Namibia': '/images/medical-aids/default-medical-aid.svg',
  'Bankmed': '/images/medical-aids/default-medical-aid.svg',
  'Methealth Namibia': '/images/medical-aids/default-medical-aid.svg',
  'Methealth': '/images/medical-aids/default-medical-aid.svg',
  
  // Additional South African Medical Aids (available logos)
  'Bonitas Medical Fund': '/images/medical-aids/bonitas-logo.png',
  'Bonitas': '/images/medical-aids/bonitas-logo.png',
  'Discovery Health': '/images/medical-aids/discovery-logo.png',
  'Discovery': '/images/medical-aids/discovery-logo.png',
  'Old Mutual Health': '/images/medical-aids/old-mutual-logo.png',
  'Old Mutual': '/images/medical-aids/old-mutual-logo.png',
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

// Common Namibian Medical Aid Schemes/Options (based on database migration)
export const commonMedicalAidSchemes: Record<string, string[]> = {
  // NMC schemes from database
  'Namibia Medical Care': ['Diamond', 'Platinum', 'Gold', 'Silver'],
  'NMC': ['Diamond', 'Platinum', 'Gold', 'Silver'],
  
  // NHP schemes from database
  'Namibia Health Plan': ['Executive', 'Comprehensive'],
  'NHP': ['Executive', 'Comprehensive'],
  
  // Standard schemes for other providers
  'Nammed Medical Aid Fund': ['Comprehensive', 'Standard', 'Essential'],
  'Nammed': ['Comprehensive', 'Standard', 'Essential'],
  'Gemhealth Medical Aid': ['Premium', 'Standard', 'Basic'],
  'Gemhealth': ['Premium', 'Standard', 'Basic'],
  
  // Default schemes for providers without specific data
  'Renaissance Health Medical Aid Fund': ['Comprehensive', 'Standard', 'Essential'],
  'Renaissance': ['Comprehensive', 'Standard', 'Essential'],
  'Napotel Medical Aid': ['Premium', 'Standard', 'Basic'],
  'Napotel': ['Premium', 'Standard', 'Basic'],
  'Bankmed Namibia': ['Comprehensive', 'Standard', 'Essential'],
  'Bankmed': ['Comprehensive', 'Standard', 'Essential'],
  'Methealth Namibia': ['Premium', 'Standard', 'Basic'],
  'Methealth': ['Premium', 'Standard', 'Basic'],
  
  // South African schemes
  'Discovery Health': ['Executive Plan', 'Comprehensive', 'Essential', 'Smart Plan'],
  'Bonitas Medical Fund': ['BonComprehensive', 'BonEssential', 'BonCap', 'BonStart'],
  'Old Mutual Health': ['Comprehensive', 'Standard', 'Essential'],
};

// Function to get schemes for a provider
export const getSchemesForProvider = (provider: string): string[] => {
  return commonMedicalAidSchemes[provider] || ['Standard', 'Comprehensive', 'Essential'];
};