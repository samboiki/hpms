/**
 * Optical benefits differ per fund and option and change every year, so OneHealth keeps no benefit tables of its own:
 * the practice writes its note per fund (optionally per option) with, if it wants, the limit and the benefit cycle it
 * works with. The note for the patient's fund shows where spectacles and lenses are chosen (the Eyes tab and the lab
 * order). Pure; tested in __tests__/fundNotes.test.ts.
 */
import { formatNad, fromCents, toCents } from '../billing/money';
import { parseAmountText } from '../stock/items';

export interface FundNote {
  id: string;
  /** The fund's claim code, e.g. MAG1 (PSEMAS), NMC1, NHPM */
  fundReference: string;
  /** Empty for the whole fund */
  planOption: string | null;
  note: string;
  limitCents: number | null;
  cycleMonths: number | null;
}

export interface PatientFundRef {
  reference: string | null;
  planOptions: readonly string[];
}

const key = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase();

/** The note for the patient's fund: the one for their option if the practice wrote one, else the fund's own. */
export function noteForFund(notes: readonly FundNote[], fund: PatientFundRef | null): FundNote | null {
  const reference = key(fund?.reference);
  if (!fund || !reference) return null;
  const ofFund = notes.filter(note => key(note.fundReference) === reference);
  const options = new Set(fund.planOptions.map(key).filter(Boolean));
  return ofFund.find(note => note.planOption && options.has(key(note.planOption))) ?? ofFund.find(note => !key(note.planOption)) ?? null;
}

/** "Limit N$ 1,500.00 every 24 months" (empty when the practice gave neither). */
export function describeLimit(note: Pick<FundNote, 'limitCents' | 'cycleMonths'>): string {
  const limit = note.limitCents !== null ? `Limit ${formatNad(fromCents(note.limitCents))}` : '';
  const cycle = note.cycleMonths ? `every ${note.cycleMonths} month${note.cycleMonths === 1 ? '' : 's'}` : '';
  if (limit && cycle) return `${limit} ${cycle}`;
  return limit || (cycle ? `Benefit cycle: ${cycle}` : '');
}

export interface FundNoteDraft {
  id?: string;
  fundReference: string;
  planOption: string;
  note: string;
  limit: string;
  cycleMonths: string;
}

export type FundNoteDraftErrors = Partial<Record<keyof FundNoteDraft, string>>;

export const CYCLE_MONTH_LIMITS = { min: 1, max: 60 } as const;

export function validateFundNoteDraft(draft: FundNoteDraft): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: FundNoteDraftErrors } {
  const errors: FundNoteDraftErrors = {};
  const reference = key(draft.fundReference);
  if (!/^[A-Z0-9]{2,10}$/.test(reference)) errors.fundReference = 'Choose the fund.';
  const option = draft.planOption.trim();
  if (option.length > 60) errors.planOption = 'Keep the option name to 60 characters.';
  const note = draft.note.trim();
  if (!note) errors.note = 'Write the note staff should see, e.g. what the fund pays for and how often.';
  else if (note.length > 500) errors.note = 'Keep the note to 500 characters.';
  // "1 500" is how many people write N$ 1,500
  const limit = draft.limit.trim() === '' ? null : parseAmountText(draft.limit.replace(/\s+/g, ''));
  if (draft.limit.trim() !== '' && (limit === null || limit > 1_000_000)) errors.limit = 'An amount in N$, e.g. 1500.';
  const cycleText = draft.cycleMonths.trim();
  const cycle = cycleText === '' ? null : /^\d{1,2}$/.test(cycleText) ? Number(cycleText) : Number.NaN;
  if (cycle !== null && !(cycle >= CYCLE_MONTH_LIMITS.min && cycle <= CYCLE_MONTH_LIMITS.max)) {
    errors.cycleMonths = `Months: ${CYCLE_MONTH_LIMITS.min} to ${CYCLE_MONTH_LIMITS.max}.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      id: draft.id ?? null,
      fund_reference: reference,
      plan_option: option || null,
      note,
      limit_amount: limit === null ? null : fromCents(toCents(limit)),
      cycle_months: cycle
    }
  };
}
