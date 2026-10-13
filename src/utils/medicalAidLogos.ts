// Medical Aid Logo Mapping for Namibian Medical Aid Providers
import { identifyFund } from './remittance/funds';

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

/** A fund as medical_aid_providers holds it (name, short name, fund code, logo) */
export interface FundLogoEntry {
  name: string;
  shortName: string | null;
  reference: string | null;
  logoUrl: string | null;
}

// Some stored logo links have a double slash after the bucket name
const cleanLogoUrl = (url: string): string =>
  url.trim().replace('/storage/v1/object/public/medical-aid-logos//', '/storage/v1/object/public/medical-aid-logos/');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The app's own image of a well-known fund: the name itself, or the name as a whole word ("Bonitas Medical Fund") */
function bundledLogo(text: string): string | null {
  const lower = text.toLowerCase();
  const specific = Object.entries(medicalAidLogos).filter(([, logo]) => logo !== defaultMedicalAidLogo);
  const hit = specific.find(([key]) => key.toLowerCase() === lower)
    ?? specific.find(([key]) => key.length >= 3 && new RegExp(`(^|[^a-z0-9])${escapeRegExp(key.toLowerCase())}([^a-z0-9]|$)`).test(lower));
  return hit ? hit[1] : null;
}

/**
 * The logo of a medical aid as named on a patient file or in Finance ("NHP", "Namibia Health Plan (NHP)", "PSEMAS"),
 * the same picture the Patients page shows: the fund's logo from medical_aid_providers, matched by fund code where the
 * fund is known (MAG1 is PSEMAS: utils/remittance/funds.ts), else by name; else the app's own image of a well-known
 * fund. Null when there is no real logo: the caller shows a plain shield, never a placeholder or another fund's logo.
 */
export function resolveMedicalAidLogo(name: string | null | undefined, funds: readonly FundLogoEntry[]): string | null {
  const text = (name ?? '').trim();
  if (text.length < 2) return null;
  const lower = text.toLowerCase();
  const withLogo = funds.filter(fund => fund.logoUrl?.trim());
  const known = identifyFund(text);
  const match = (known ? withLogo.find(fund => identifyFund(fund.reference, fund.shortName, fund.name) === known) : undefined)
    ?? withLogo.find(fund => [fund.name, fund.shortName, fund.reference].some(value => value?.trim().toLowerCase() === lower));
  if (match?.logoUrl) return cleanLogoUrl(match.logoUrl);
  // A claim file's code ("NHPM") finds the app's own image through the fund's name
  return bundledLogo(text) ?? (known ? bundledLogo(known.label) : null);
}