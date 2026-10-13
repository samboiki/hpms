/**
 * Who may raise an invoice, and who treated the patient.
 *
 * Business rules (practice owner: "reception must be able to bill"):
 * - Raising an invoice is billing work. Any active staff member with billing rights may do it: administrators,
 *   doctors, nurses and receptionists (every staff role a practice uses). Until now only doctors could, so the
 *   front desk had to wait for the practitioner.
 * - The TREATING practitioner is a different person: the clinician who did the work. The medical aid claim carries
 *   that practitioner's HPCNA number, so the invoice records the treating practitioner (per invoice and per line),
 *   never simply the person who typed it.
 * - Default treating practitioner: the visit's practitioner; otherwise the person raising the invoice when they are
 *   a clinician; otherwise nobody, and staff choose one.
 * - A clinician without an HPCNA number can be chosen, but the claim stops at batch review (claimValidation), so
 *   the picker says so before the invoice is saved.
 *
 * Pure (no database), so the rules are tested directly.
 */
import { formatDoctorName } from '../formatDoctorName.ts';

export const BILLING_ROLES = ['admin', 'doctor', 'nurse', 'receptionist'] as const;
export type BillingRole = (typeof BILLING_ROLES)[number];

/** Staff roles that treat patients and may appear on a claim as the treating practitioner. */
export const CLINICAL_ROLES = ['doctor', 'nurse'] as const;

export interface StaffMember {
  id: string;
  role?: string | null;
  is_active?: boolean | null;
  full_name?: string | null;
  hpcsa_number?: string | null;
}

const normalRole = (role: string | null | undefined): string => (role ?? '').trim().toLowerCase();

const isBillingRole = (role: string): role is BillingRole => (BILLING_ROLES as readonly string[]).includes(role);

/** Why this user cannot raise invoices, in plain words; null when they can. */
export function billingRightsProblem(user: Pick<StaffMember, 'role' | 'is_active'> | null | undefined): string | null {
  if (!user) return 'Sign in again to create invoices.';
  if (user.is_active === false) return 'Your account is switched off, so you cannot create invoices. Ask the practice administrator.';
  const role = normalRole(user.role);
  if (!isBillingRole(role)) {
    return `Your role (${role || 'not set'}) cannot create invoices. Administrators, doctors, nurses and receptionists can.`;
  }
  return null;
}

export const canRaiseInvoices = (user: Pick<StaffMember, 'role' | 'is_active'> | null | undefined): boolean =>
  billingRightsProblem(user) === null;

/**
 * Why this user cannot invoice and take the payment in one step ("Invoice and take payment" on a visit); null when
 * they can. Raising the invoice follows the rule above; recording the receipt follows what the database enforces in
 * ar_post_receipt (ar_assert_member): staff of the practice the money is for, by their own practice. Someone who
 * may invoice but not receive money there is not offered the step, so it never ends in a refusal after the save.
 */
export function takePaymentProblem(
  user: (Pick<StaffMember, 'role' | 'is_active'> & { practice_id?: string | null }) | null | undefined,
  practiceId: string | null | undefined
): string | null {
  const billing = billingRightsProblem(user);
  if (billing) return billing;
  if (!practiceId?.trim() || user?.practice_id !== practiceId) return 'Payments are recorded by staff of the practice the patient is seen at.';
  return null;
}

export const canInvoiceAndTakePayment = (
  user: Parameters<typeof takePaymentProblem>[0],
  practiceId: string | null | undefined
): boolean => takePaymentProblem(user, practiceId) === null;

/** True for an active doctor or nurse. */
export function isClinician(member: Pick<StaffMember, 'role' | 'is_active'> | null | undefined): boolean {
  if (!member || member.is_active === false) return false;
  return (CLINICAL_ROLES as readonly string[]).includes(normalRole(member.role));
}

export interface TreatingPractitionerOption {
  id: string;
  /** The name as staff know it ("Dr. A. Nghipondoka" for a doctor, the plain name for a nurse) */
  label: string;
  hpcnaNumber: string | null;
  /** Shown next to the name: the claim needs the number */
  warning: string | null;
  /** Their own practice number, when their lines bill under it (practitionerBilling.ts); null: the practice's */
  ownPracticeNumber?: string | null;
  /** Their rate, a percentage of the practice's price list; null: the list */
  ratePercent?: number | null;
}

const hasText = (value: string | null | undefined): value is string => Boolean(value?.trim());

/** Doctors with one "Dr." (formatDoctorName), others by their plain name. */
export function practitionerLabel(member: Pick<StaffMember, 'role' | 'full_name'>): string {
  const name = (member.full_name ?? '').trim();
  if (!name) return 'Unnamed practitioner';
  return normalRole(member.role) === 'doctor' ? formatDoctorName(name, name) : name;
}

/**
 * The practitioners staff can choose as the treating practitioner: active doctors, then active nurses, by name.
 * `keepIds` (for example the visit's practitioner who has since left) are listed even when inactive, so an older
 * visit still shows who treated the patient.
 */
export function treatingPractitionerOptions(
  staff: readonly StaffMember[],
  keepIds: readonly (string | null | undefined)[] = []
): TreatingPractitionerOption[] {
  const keep = new Set(keepIds.filter(hasText));
  const rank = (member: StaffMember): number => (normalRole(member.role) === 'doctor' ? 0 : 1);
  const seen = new Set<string>();
  return staff
    .filter(member => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return isClinician(member) || keep.has(member.id);
    })
    .sort((a, b) => rank(a) - rank(b) || practitionerLabel(a).localeCompare(practitionerLabel(b)))
    .map(member => {
      const hpcnaNumber = hasText(member.hpcsa_number) ? member.hpcsa_number.trim() : null;
      return {
        id: member.id,
        label: practitionerLabel(member),
        hpcnaNumber,
        warning: hpcnaNumber ? null : 'No HPCNA number on record: a medical aid claim for this practitioner will be stopped until it is added.'
      };
    });
}

/**
 * The treating practitioner an invoice starts with: the visit's practitioner, else the person raising it when they
 * are a clinician, else null (staff choose one).
 */
export function defaultTreatingPractitionerId(params: {
  visitPractitionerId?: string | null;
  raiser?: Pick<StaffMember, 'id' | 'role' | 'is_active'> | null;
}): string | null {
  if (hasText(params.visitPractitionerId)) return params.visitPractitionerId.trim();
  if (params.raiser && isClinician(params.raiser)) return params.raiser.id;
  return null;
}
