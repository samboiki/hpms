/**
 * "How did you hear about us?" (owner's decision, 13 Oct 2026; parity R26): an optional answer at registration,
 * editable on the patient file, counted per month in Finance > Reports > Demographics. Stored in
 * patients.referral_source (one of the keys below) and patients.referral_source_other (the words typed for "Other"),
 * proposals/2026-10-13-patient-photo-and-referral-source.sql. The keys are the database's check list: change both.
 */

export const REFERRAL_SOURCES = [
  'doctor_referral',
  'friend_family',
  'medical_aid',
  'internet',
  'social_media',
  'walk_in',
  'radio_newspaper',
  'other'
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_SOURCE_LABELS: Readonly<Record<ReferralSource, string>> = {
  doctor_referral: 'Referral by a doctor',
  friend_family: 'Friend or family',
  medical_aid: 'Medical aid',
  internet: 'Google or the internet',
  social_media: 'Social media',
  walk_in: 'Walk-in or signage',
  radio_newspaper: 'Radio or newspaper',
  other: 'Other'
};

/** The longest "Other" answer kept (the database checks the same length) */
export const REFERRAL_OTHER_MAX_LENGTH = 80;

export const isReferralSource = (value: unknown): value is ReferralSource =>
  typeof value === 'string' && (REFERRAL_SOURCES as readonly string[]).includes(value);

/** The answer as the form holds it: '' when not asked or skipped */
export interface ReferralAnswer {
  source: ReferralSource | '';
  other: string;
}

export const NO_REFERRAL_ANSWER: ReferralAnswer = { source: '', other: '' };

/** What the file holds, read back into the form (an unknown stored value is shown as not answered) */
export function referralAnswerFrom(row: { referral_source?: string | null; referral_source_other?: string | null } | null | undefined): ReferralAnswer {
  const source = isReferralSource(row?.referral_source) ? row.referral_source : '';
  return { source, other: source === 'other' ? (row?.referral_source_other ?? '').trim() : '' };
}

/**
 * The columns to save. Skipping the question saves nothing (null); the typed words are kept only for "Other", trimmed
 * to the length the database accepts, so a changed answer never leaves stale "Other" words behind.
 */
export function referralColumns(answer: ReferralAnswer): { referral_source: ReferralSource | null; referral_source_other: string | null } {
  const source = isReferralSource(answer.source) ? answer.source : null;
  const other = source === 'other' ? answer.other.replace(/\s+/g, ' ').trim().slice(0, REFERRAL_OTHER_MAX_LENGTH) : '';
  return { referral_source: source, referral_source_other: other || null };
}

/** The answer in words, for lists and reports ("Other: church notice board"); null when not answered */
export function describeReferralAnswer(answer: ReferralAnswer): string | null {
  if (!answer.source) return null;
  const label = REFERRAL_SOURCE_LABELS[answer.source];
  return answer.source === 'other' && answer.other.trim() ? `${label}: ${answer.other.trim()}` : label;
}
