/**
 * Claim fields 45-47 (optometry) as the Methealth/QEDI specification (Layout 1.1, sections 33-35) writes them:
 * - 45 reading additions per eye, no spaces: "R3.00L3.75"
 * - 46 the lens prescription, sign always written: "R+01.25-00.50X090L+01.00-00.75X180"
 * - 47 the density of tint per eye, no percent sign: "R35L35"
 * The database fills batch_details with exactly these strings (optometry_claim_fields() in
 * proposals/2026-10-08-optometry.sql); src/utils/billing/claimFile.ts checks them against
 * OPTOMETRY_CLAIM_PATTERNS (claimLine.ts) before they go into the file. The prescription is written as recorded (plus
 * or minus cylinder): the specification does not ask for one form.
 */
import type { EyeRx, Rx } from './prescription';
import type { LabOrderEyes } from './labOrders';

/** "+01.25", "-10.00", "+00.00" */
export const claimDioptre = (value: number): string => `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(2).padStart(5, '0')}`;

const claimEye = (eye: EyeRx): string => {
  // The specification's own example writes "no cylinder" as -00.00 with axis 000
  const cylinder = eye.cylinder ? claimDioptre(eye.cylinder) : '-00.00';
  const axis = eye.cylinder ? String(eye.axis ?? 0).padStart(3, '0') : '000';
  return `${claimDioptre(eye.sphere)}${cylinder}X${axis}`;
};

/** Field 46: both eyes, always. */
export const claimLensPrescription = (rx: Rx): string => `R${claimEye(rx.right)}L${claimEye(rx.left)}`;

/** Field 45: the eyes that have a reading addition; empty when neither has one. */
export const claimReadingAdditions = (rx: Rx): string =>
  `${rx.right.add ? `R${rx.right.add.toFixed(2)}` : ''}${rx.left.add ? `L${rx.left.add.toFixed(2)}` : ''}`;

/** Field 47: the tint of the lenses ordered, per eye ordered; empty without a tint. */
export function claimTintDensity(eyes: LabOrderEyes, percent: number | null): string {
  if (!percent) return '';
  return `${eyes !== 'left' ? `R${percent}` : ''}${eyes !== 'right' ? `L${percent}` : ''}`;
}
