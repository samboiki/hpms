/**
 * A practice's discipline (dental, medical/GP, optometry, ...). It is stored twice on practices: practice_type, the
 * text every discipline rule reads (isDentalPractice / isOptometryPractice in src/utils/billing/tariffRules.ts, the
 * tariff list by practice_types.name), and practice_type_id, the link to practice_types. The two disagreed for most
 * practices because no screen wrote either, so a change always writes both from one practice_types row.
 */

export interface PracticeTypeOption {
  id: string;
  /** practice_types.name, e.g. 'dental': the value practices.practice_type must hold */
  name: string;
  /** What staff read */
  label: string;
}

/** Plain names for the practice_types rows (an unknown name is shown capitalised). */
const LABELS: Readonly<Record<string, string>> = {
  medical: 'Medical practice (GP)',
  dental: 'Dental',
  optometry: 'Optometry',
  physiotherapy: 'Physiotherapy',
  psychology: 'Psychology',
  nursing: 'Nursing',
  dermatology: 'Dermatology',
  ent: 'Ear, nose and throat (ENT)',
  gynecology: 'Gynaecology',
  pediatrics: 'Paediatrics',
  cardiology: 'Cardiology',
  orthopedics: 'Orthopaedics',
  ophthalmology: 'Ophthalmology',
  neurology: 'Neurology',
  radiology: 'Radiology',
  pathology: 'Pathology',
  pharmacy: 'Pharmacy',
  aesthetic: 'Aesthetic practice',
  // The disciplines added with proposals/2026-10-14-practice-type-disciplines.sql (each bills from its NAMAF list)
  anesthesiology: 'Anaesthetics',
  internal_medicine: 'Internal medicine (specialist physician)',
  psychiatry: 'Psychiatry',
  general_surgery: 'General surgery',
  urology: 'Urology',
  occupational_therapy: 'Occupational therapy',
  speech_therapy: 'Speech therapy and audiology',
  dietetics: 'Dietetics',
  biokinetics: 'Biokinetics',
  private_hospital: 'Private hospital',
  day_clinic: 'Day clinic'
};

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** The database's default type for a new practice; no tariff list is called 'general' */
const GENERAL = 'general';

/**
 * Owner decision 13 Oct 2026: a practice whose type is 'general' (or not set) matches no price list, so Settings >
 * Practice asks an administrator to choose the type, and the price-list screens point there.
 */
export function needsPracticeTypeChoice(practiceType: unknown): boolean {
  const key = clean(practiceType);
  return !key || key === GENERAL;
}

export function practiceTypeLabel(name: string | null | undefined): string {
  const key = clean(name);
  if (!key) return 'Not chosen yet';
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/** The practice_types rows a practice can choose from: active ones with a name, the most common disciplines first. */
export function practiceTypeOptions(rows: readonly unknown[]): PracticeTypeOption[] {
  const order = Object.keys(LABELS);
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  return rows
    .flatMap(row => {
      const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof r?.id === 'string' ? r.id : '';
      const name = clean(r?.name);
      // 'general' matches no price list, so it is never offered (owner, 13 Oct 2026: the practice chooses its type)
      if (!id || !name || name === GENERAL || r?.is_active === false) return [];
      return [{ id, name, label: practiceTypeLabel(name) }];
    })
    .sort((a, b) => rank(a.name) - rank(b.name) || a.label.localeCompare(b.label));
}

export interface PracticeTypeState {
  /** The type the app works with now (practices.practice_type), or null when none of the options ('general' default) */
  current: PracticeTypeOption | null;
  /** The type practice_type_id links to, when it differs from `current` (the two copies disagree) */
  linkedElsewhere: PracticeTypeOption | null;
  /** What the chooser starts on: the current type, else the linked one (one tap to make both agree) */
  suggested: PracticeTypeOption | null;
}

export function practiceTypeState(practice: { practice_type?: unknown; practice_type_id?: unknown }, options: readonly PracticeTypeOption[]): PracticeTypeState {
  const current = options.find(option => option.name === clean(practice.practice_type)) ?? null;
  const linked = options.find(option => option.id === practice.practice_type_id) ?? null;
  const linkedElsewhere = linked && linked.id !== current?.id ? linked : null;
  return { current, linkedElsewhere, suggested: current ?? linked };
}

/** Saving `choice` changes something: either copy differs from it. */
export const practiceTypeChanged = (practice: { practice_type?: unknown; practice_type_id?: unknown }, choice: PracticeTypeOption): boolean =>
  clean(practice.practice_type) !== choice.name || practice.practice_type_id !== choice.id;

/** Both columns from one row, so the text the app reads and the directory's link can never disagree again. */
export const practiceTypeUpdate = (choice: PracticeTypeOption): { practice_type: string; practice_type_id: string } => ({
  practice_type: choice.name,
  practice_type_id: choice.id
});
