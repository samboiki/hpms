/**
 * Finance shows each medical aid's logo where it names the fund, the same picture as the Patients page. Patient
 * files write a fund many ways ("NHP", "Namibia Health Plan", "PSEMAS"...) and the funds table keys PSEMAS by its
 * claim code MAG1, so the logo is found through the fund, not the spelling; and a fund with no logo gets a plain
 * shield, never a placeholder that looks like a logo or, worse, another fund's logo on a claim.
 */
import { describe, expect, it } from 'vitest';
import { resolveMedicalAidLogo, type FundLogoEntry } from '../medicalAidLogos';

const STORAGE = 'https://files.example.test/storage/v1/object/public/medical-aid-logos';
const FUNDS: FundLogoEntry[] = [
  { name: 'Public Service Employees Medical Aid Scheme', shortName: 'PSEMAS', reference: 'MAG1', logoUrl: `${STORAGE}/psemas.png` },
  { name: 'Namibia Health Plan', shortName: 'NHP', reference: 'NHPM', logoUrl: `${STORAGE}//nhp.png` },
  { name: 'Namibia Medical Care', shortName: 'NMC', reference: 'NMC1', logoUrl: null },
  { name: 'Renaissance Health Medical Aid Fund', shortName: 'Renaissance', reference: null, logoUrl: `${STORAGE}/renaissance.png` }
];

describe('resolveMedicalAidLogo', () => {
  it('finds PSEMAS by its claim code, however the patient file spells the fund', () => {
    for (const written of ['PSEMAS', 'psemas', 'Public Service Employees Medical Aid Scheme', 'MAG1']) {
      expect(resolveMedicalAidLogo(written, FUNDS)).toBe(`${STORAGE}/psemas.png`);
    }
  });

  it("shows the same NHP logo for 'NHP' and the Debtors spelling 'Namibia Health Plan (NHP)', repairing the stored double slash", () => {
    expect(resolveMedicalAidLogo('NHP', FUNDS)).toBe(`${STORAGE}/nhp.png`);
    expect(resolveMedicalAidLogo('Namibia Health Plan (NHP)', FUNDS)).toBe(`${STORAGE}/nhp.png`);
  });

  it("uses the app's own image of a well-known fund when the funds table has no logo for it (or cannot be read)", () => {
    expect(resolveMedicalAidLogo('Namibia Medical Care (NMC)', FUNDS)).toBe('/images/medical-aids/nmc-logo.png');
    expect(resolveMedicalAidLogo('Bonitas Medical Fund', [])).toBe('/images/medical-aids/bonitas-logo.png');
    // Claims and remittance screens name the fund by its claim file code
    expect(resolveMedicalAidLogo('NHPM', [])).toBe('/images/medical-aids/nhp-logo.png');
    expect(resolveMedicalAidLogo('NAMM', [])).toBe('/images/medical-aids/nammed-logo.png');
    expect(resolveMedicalAidLogo('MAG1', [])).toBeNull(); // no PSEMAS image ships with the app: a plain shield
  });

  it('matches a fund outside the known Namibian codes by its name or short name', () => {
    expect(resolveMedicalAidLogo('renaissance', FUNDS)).toBe(`${STORAGE}/renaissance.png`);
  });

  it('gives no logo (a plain shield) for an unknown fund, a placeholder-only fund or a scrap of text, never a wrong one', () => {
    expect(resolveMedicalAidLogo('Unheard Of Fund', FUNDS)).toBeNull();
    expect(resolveMedicalAidLogo('Methealth', [])).toBeNull(); // only the generic placeholder is bundled
    expect(resolveMedicalAidLogo('nm', FUNDS)).toBeNull();
    expect(resolveMedicalAidLogo('', FUNDS)).toBeNull();
    expect(resolveMedicalAidLogo(null, FUNDS)).toBeNull();
  });
});
