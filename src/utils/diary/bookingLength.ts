/**
 * How long a booking takes. visits.duration_minutes stores the length chosen in the booking form
 * (proposals/2026-10-07-diary-2.sql). A booking without one, made before lengths were stored or
 * outside the diary, takes the practice's default for its visit type (diary_settings.type_lengths),
 * else 30 minutes: the length every booking had before. The diary grids, the clash check, "Next free
 * slot" and the time picker all read lengths from here.
 */

/** The visit types the visits table accepts (its CHECK constraint) */
export const VISIT_TYPES = ['consultation', 'follow-up', 'procedure', 'emergency'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export type TypeLengths = Record<VisitType, number>;

/** A booking with no stored length when the practice defaults are unknown: the old fixed length */
export const FALLBACK_BOOKING_LENGTH = 30;

/**
 * The starting set (the SQL column default is the same; a test compares them). Consultations keep the
 * 30 minutes the diary always used and follow-ups take 15, so no existing booking grows overnight.
 * Each practice changes them in Diary settings.
 */
export const DEFAULT_TYPE_LENGTHS: TypeLengths = { consultation: 30, 'follow-up': 15, procedure: 30, emergency: 30 };

/** Same limits as the CHECK constraint on visits.duration_minutes */
export const BOOKING_LENGTH_MIN = 5;
export const BOOKING_LENGTH_MAX = 480;

/** The lengths offered in Diary settings */
export const TYPE_LENGTH_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  procedure: 'Procedure',
  emergency: 'Emergency'
};

export const isVisitType = (value: unknown): value is VisitType =>
  typeof value === 'string' && (VISIT_TYPES as readonly string[]).includes(value);

/** A whole number of minutes the database accepts as a booking length. */
export function isValidBookingLength(minutes: unknown): minutes is number {
  return typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= BOOKING_LENGTH_MIN && minutes <= BOOKING_LENGTH_MAX;
}

/** diary_settings.type_lengths as stored, with the starting set for anything missing or invalid. */
export function normalizeTypeLengths(raw: unknown): TypeLengths {
  const lengths: TypeLengths = { ...DEFAULT_TYPE_LENGTHS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return lengths;
  for (const type of VISIT_TYPES) {
    const value = (raw as Record<string, unknown>)[type];
    const minutes = typeof value === 'string' ? Number(value) : value;
    if (isValidBookingLength(minutes)) lengths[type] = minutes;
  }
  return lengths;
}

/** The practice's default length for a visit type (consultation's for an unknown type). */
export function defaultLengthFor(visitType: string | null | undefined, lengths?: TypeLengths | null): number {
  const table = lengths ?? DEFAULT_TYPE_LENGTHS;
  return isVisitType(visitType) ? table[visitType] : table.consultation;
}

export interface LengthSource {
  duration_minutes?: number | string | null;
  visit_type?: string | null;
}

/**
 * The length of one booking: its stored length, else its type's default. Without the practice's
 * lengths (a legacy caller) a booking without a stored length keeps the old 30 minutes.
 */
export function resolveBookingLength(visit: LengthSource, lengths?: TypeLengths | null): number {
  const stored = typeof visit.duration_minutes === 'string' ? Number(visit.duration_minutes) : visit.duration_minutes;
  if (isValidBookingLength(stored)) return stored;
  return lengths ? defaultLengthFor(visit.visit_type, lengths) : FALLBACK_BOOKING_LENGTH;
}

/** "15 min", "1 hour", "1 h 30 min" */
export function formatBookingLength(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} h ${rest} min`;
}

export type TypeLengthsValidation = { ok: true; lengths: TypeLengths } | { ok: false; errors: string[] };

/** Checks the Diary settings form in plain words. Mirrors save_diary_settings in the SQL. */
export function validateTypeLengths(input: Record<string, unknown>): TypeLengthsValidation {
  const errors: string[] = [];
  const lengths: TypeLengths = { ...DEFAULT_TYPE_LENGTHS };
  for (const type of VISIT_TYPES) {
    const value = Number(input[type]);
    if (!isValidBookingLength(value)) {
      errors.push(`${VISIT_TYPE_LABELS[type]}: choose ${BOOKING_LENGTH_MIN} to ${BOOKING_LENGTH_MAX} minutes.`);
    } else {
      lengths[type] = value;
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, lengths };
}
