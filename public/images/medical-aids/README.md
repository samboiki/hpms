# Medical Aid Logos - Namibian Healthcare Providers

This directory contains logos for major medical aid providers operating in Namibia.

## Available Logos

### Namibian Medical Aid Providers
- **nmc-logo.png** - Namibia Medical Care (NMC)
- **nhp-logo.png** - Namibia Health Plan (NHP) 
- **nammed-logo.png** - Nammed Medical Aid Fund
- **gemhealth-logo.png** - Gemhealth Medical Aid

### South African Medical Aids (Operating in Namibia)
- **bonitas-logo.png** - Bonitas Medical Fund
- **discovery-logo.png** - Discovery Health
- **old-mutual-logo.png** - Old Mutual Health

### Default/Fallback
- **default-medical-aid.svg** - Generic fallback logo for unknown providers

## Usage

These logos are used in the patient detail view to display medical aid information. The system automatically selects the appropriate logo based on the provider name using the `getMedicalAidLogo()` function in `/src/utils/medicalAidLogos.ts`.

## Logo Sources

- NMC: Downloaded from https://www.nmcfund.com/
- NHP: Downloaded from https://nhp.com.na/
- Bonitas: Downloaded from https://www.bonitas.co.za/
- Nammed: Downloaded from https://www.nammed.com.na/
- Gemhealth: Downloaded from https://www.gemhealthmedical.com.na/

## Common Medical Aid Schemes in Namibia

### Namibia Medical Care (NMC)
- Diamond, Emerald, Gold, Silver, Bronze

### Namibia Health Plan (NHP)  
- Comprehensive, Executive, Standard, Essential

### Discovery Health
- Executive Plan, Comprehensive, Essential, Smart Plan

### Bonitas Medical Fund
- BonComprehensive, BonEssential, BonCap, BonStart

### Nammed
- Comprehensive, Standard, Essential

### Gemhealth
- Premium, Standard, Basic