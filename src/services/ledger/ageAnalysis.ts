import { toCents } from './money';
import { AGE_BANDS, ageBandFor, type AgeBand, type AgingItem, type AgingReport } from './receivables';
import type { AccountFlagKind } from './accountFlags';

// ---------------------------------------------------------------------------------------------
// Age analysis: what is owed per account, patient, fund, administrator or option in the 30-day
// bands current to 180+, split by portion, with the credit not yet allocated next to it.
//
// It is built from buildAgingReport's items, so what an invoice owes is worked out in one place
// (ledger balances once receipts are in use, else the invoice status) and the age analysis always
// adds up to the receivables ledger. An account is whoever pays: a family account's holder with
// every patient they pay for, else the patient alone. All amounts are whole cents.
// ---------------------------------------------------------------------------------------------

export type AgeGrouping = 'account' | 'patient' | 'fund' | 'administrator' | 'option';
/** Whose part of the invoices: both, only what patients owe, or only what medical aids owe */
export type PortionScope = 'both' | 'patient' | 'medical_aid';

export type BandCents = Record<AgeBand, number>;
export const zeroBands = (): BandCents => Object.fromEntries(AGE_BANDS.map(band => [band.key, 0])) as BandCents;

export interface AgeAnalysisRow {
  /** Account holder or patient id, fund, administrator or "fund · option" */
  key: string;
  label: string;
  /** Account and patient rows: the patient file the row belongs to (the account holder for accounts) */
  accountId: string | null;
  /** Owed per band in the chosen portion(s) */
  bands: BandCents;
  medicalAidCents: number;
  patientCents: number;
  /** Owed in the chosen portion(s): the sum of the bands */
  owedCents: number;
  /** Received for these accounts and not allocated to an invoice yet (for funds: suspense) */
  unallocatedCents: number;
  /** owed - unallocated: negative when the account is in credit */
  netCents: number;
  invoiceCount: number;
  /** Days since the oldest invoice still owing; null when that invoice has no date */
  oldestAgeDays: number | null;
  /** The patients in the row with something owed or credit held */
  patientIds: string[];
  /** Flags in force on the row's patients (account flags come from whoever pays) */
  flags: AccountFlagKind[];
}

export interface AgeAnalysisFilter {
  grouping: AgeGrouping;
  portion: PortionScope;
  /** Rows owing less than this (in the chosen portions) are left out; 0 keeps every row */
  minBalanceCents: number;
  /** Only rows owing something at least this many days old (0 = every row) */
  minAgeDays: number;
  /** Only invoices of this practitioner */
  practitionerId: string | null;
  /** Invoices of patients with any of these flags are left out (handed-over accounts are with the collector) */
  excludeFlags: readonly AccountFlagKind[];
  /** Only patients with this flag, e.g. disputes */
  onlyFlag: AccountFlagKind | null;
  search: string;
  /** Keep accounts that owe nothing but hold credit, and funds whose money is not matched yet */
  includeCreditOnly: boolean;
  /** Only patients of this fund as recorded (fundByPatient; PRIVATE_FUND for those without one), e.g. a fund's patients with balances */
  fund?: string | null;
}

export const DEFAULT_AGE_FILTER: AgeAnalysisFilter = {
  grouping: 'account',
  portion: 'both',
  minBalanceCents: 0,
  minAgeDays: 0,
  practitionerId: null,
  excludeFlags: ['handed_over'],
  onlyFlag: null,
  search: '',
  includeCreditOnly: true
};

/**
 * What each account owes itself: the patient portion per account (a family under whoever pays), every flag included.
 * The collections work list, the reminder SMS and the promise limit all use it, so they never disagree, and no patient
 * is asked to pay what their medical aid owes.
 */
export const PATIENT_ACCOUNT_FILTER: AgeAnalysisFilter = {
  ...DEFAULT_AGE_FILTER,
  grouping: 'account',
  portion: 'patient',
  excludeFlags: [],
  includeCreditOnly: false
};

/**
 * Names and lookups. Fund names in fundByPatient and creditByFund must be spelled the same way
 * (the screens pass both through the same fund-name clean-up), or a fund's suspense money would
 * not land on its row.
 */
export interface AgeAnalysisContext {
  patientNames: Readonly<Record<string, string>>;
  /** Medical aid fund per patient (medical_aid_details.provider) */
  fundByPatient: Readonly<Record<string, string>>;
  /** Plan option per patient (medical_aid_details.plan_type) */
  optionByPatient?: Readonly<Record<string, string>>;
  /** Account holder per patient on a family account (patients who pay for themselves are absent) */
  holderByPatient?: Readonly<Record<string, string>>;
  /** The administrator of a fund (e.g. Methealth for PSEMAS) */
  administratorOf?: (fund: string) => string;
  /** Flags in force per patient, account flags included from whoever pays (flagKindsByPatient) */
  flagsByPatient?: Readonly<Record<string, readonly AccountFlagKind[]>>;
  /** Unallocated credit per patient, cents */
  creditByPatient?: Readonly<Record<string, number>>;
  /** Unallocated fund money (suspense) per fund name, cents */
  creditByFund?: Readonly<Record<string, number>>;
  /**
   * Invoices billed to a company or fund account, by invoice id (parity A14, A19): the account pays all of each, so in
   * every grouping they sit on the account's own row (key payerRowKey), never on a patient's, a family's or a fund's
   */
  payerByInvoice?: Readonly<Record<string, { accountId: string; name: string }>>;
}

/** Rows of payer accounts start with this, so they never mix with patient ids or fund names */
export const PAYER_ROW_PREFIX = 'payer:';
export const payerRowKey = (accountId: string): string => `${PAYER_ROW_PREFIX}${accountId}`;
export const accountIdOfRowKey = (key: string): string | null => (key.startsWith(PAYER_ROW_PREFIX) ? key.slice(PAYER_ROW_PREFIX.length) : null);

export interface AgeAnalysisTotals {
  bands: BandCents;
  medicalAidCents: number;
  patientCents: number;
  owedCents: number;
  unallocatedCents: number;
  netCents: number;
  invoiceCount: number;
  rowCount: number;
}

export interface AgeAnalysis {
  asOfKey: string;
  rows: AgeAnalysisRow[];
  totals: AgeAnalysisTotals;
}

export const NO_PATIENT_KEY = '__no_patient__';
export const PRIVATE_FUND = 'No medical aid (private)';
export const UNKNOWN_ADMINISTRATOR = 'Administrator not known';
export const UNKNOWN_OPTION = 'Option not recorded';

interface Group {
  key: string;
  label: string;
  accountId: string | null;
  /** A company or fund account's row (payerByInvoice) */
  payer?: boolean;
  funds: Set<string>;
  patientIds: Set<string>;
  bands: BandCents;
  medicalAidCents: number;
  patientCents: number;
  invoiceCount: number;
  oldestAgeDays: number | null;
  undated: boolean;
}

/** Fund of a patient as grouped: the recorded fund, else private */
const fundOf = (patientId: string | null, context: AgeAnalysisContext): string =>
  (patientId && context.fundByPatient[patientId]?.trim()) || PRIVATE_FUND;

const nameOf = (patientId: string | null, context: AgeAnalysisContext): string =>
  (patientId && context.patientNames[patientId]) || (patientId ? 'Unknown patient' : 'No patient on the invoice');

function groupKeyOf(patientId: string | null, fund: string, grouping: AgeGrouping, context: AgeAnalysisContext): { key: string; label: string; accountId: string | null } {
  switch (grouping) {
    case 'account': {
      const accountId = patientId ? context.holderByPatient?.[patientId] ?? patientId : null;
      return { key: accountId ?? NO_PATIENT_KEY, label: nameOf(accountId, context), accountId };
    }
    case 'patient':
      return { key: patientId ?? NO_PATIENT_KEY, label: nameOf(patientId, context), accountId: patientId };
    case 'fund':
      return { key: fund, label: fund, accountId: null };
    case 'administrator': {
      const administrator = fund === PRIVATE_FUND ? PRIVATE_FUND : context.administratorOf?.(fund) || UNKNOWN_ADMINISTRATOR;
      return { key: administrator, label: administrator, accountId: null };
    }
    case 'option': {
      if (fund === PRIVATE_FUND) return { key: fund, label: fund, accountId: null };
      const option = (patientId && context.optionByPatient?.[patientId]?.trim()) || UNKNOWN_OPTION;
      return { key: `${fund} · ${option}`, label: `${fund} · ${option}`, accountId: null };
    }
  }
}

const inScope = (item: { medicalAidCents: number; patientCents: number }, portion: PortionScope): number =>
  portion === 'medical_aid' ? item.medicalAidCents : portion === 'patient' ? item.patientCents : item.medicalAidCents + item.patientCents;

const flagsOf = (patientIds: Iterable<string>, context: AgeAnalysisContext): AccountFlagKind[] => {
  const flags = new Set<AccountFlagKind>();
  for (const patientId of patientIds) for (const flag of context.flagsByPatient?.[patientId] ?? []) flags.add(flag);
  return [...flags].sort();
};

const sumOf = (values: Iterable<number>): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/**
 * The unallocated credit of a row: account and patient rows hold their patients' credit; fund and
 * administrator rows hold the fund money not matched to claims yet; option rows hold none (a
 * fund's payment is not made per option).
 */
function creditOf(group: Group, grouping: AgeGrouping, context: AgeAnalysisContext): number {
  if (grouping === 'account' || grouping === 'patient') {
    return sumOf([...group.patientIds].map(patientId => Math.max(context.creditByPatient?.[patientId] ?? 0, 0)));
  }
  if (grouping === 'fund' || grouping === 'administrator') {
    return sumOf([...group.funds].map(fund => Math.max(context.creditByFund?.[fund] ?? 0, 0)));
  }
  return 0;
}

/** True when the row owes something in a band at least as old as `minAgeDays` */
export function owesAtLeast(bands: BandCents, minAgeDays: number): boolean {
  if (minAgeDays <= 0) return true;
  const from = AGE_BANDS.findIndex(band => band.key === ageBandFor(minAgeDays));
  return AGE_BANDS.slice(from).some(band => bands[band.key] > 0);
}

const matchesSearch = (row: Pick<AgeAnalysisRow, 'label' | 'patientIds'>, search: string, context: AgeAnalysisContext): boolean => {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  if (row.label.toLowerCase().includes(term)) return true;
  return row.patientIds.some(patientId => (context.patientNames[patientId] ?? '').toLowerCase().includes(term));
};

/**
 * The age analysis as at the aging report's date. Rows are sorted oldest debt first, then by the
 * amount owed. Filters work as Eminance's: portion, minimum balance, "older than", practitioner,
 * flags (handed-over accounts are left out by default) and a name search.
 */
export function buildAgeAnalysis(report: AgingReport, filter: AgeAnalysisFilter, context: AgeAnalysisContext): AgeAnalysis {
  const groups = new Map<string, Group>();
  const groupFor = (patientId: string | null, fund = fundOf(patientId, context)): Group => {
    const { key, label, accountId } = groupKeyOf(patientId, fund, filter.grouping, context);
    let group = groups.get(key);
    if (!group) {
      group = { key, label, accountId, funds: new Set(), patientIds: new Set(), bands: zeroBands(), medicalAidCents: 0, patientCents: 0, invoiceCount: 0, oldestAgeDays: null, undated: false };
      groups.set(key, group);
    }
    if (patientId) group.patientIds.add(patientId);
    group.funds.add(fund);
    return group;
  };
  const payerGroupFor = (payer: { accountId: string; name: string }, patientId: string | null): Group => {
    const key = payerRowKey(payer.accountId);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: payer.name, accountId: null, payer: true, funds: new Set(), patientIds: new Set(), bands: zeroBands(), medicalAidCents: 0, patientCents: 0, invoiceCount: 0, oldestAgeDays: null, undated: false };
      groups.set(key, group);
    }
    if (patientId) group.patientIds.add(patientId);
    return group;
  };

  // Flags filter invoices before grouping (they are per patient, account flags inherited from whoever
  // pays), so a fund row keeps its other members when one member's account is handed over
  const excluded = (patientId: string | null): boolean => {
    // A fund's patients: the fund as recorded on the patient, the same fund their rows are grouped under
    if (filter.fund && fundOf(patientId, context) !== filter.fund) return true;
    const flags = (patientId && context.flagsByPatient?.[patientId]) || [];
    if (flags.some(flag => filter.excludeFlags.includes(flag))) return true;
    return filter.onlyFlag !== null && !flags.includes(filter.onlyFlag);
  };

  for (const item of report.items as readonly AgingItem[]) {
    if (filter.practitionerId && item.invoice.practitionerId !== filter.practitionerId) continue;
    const payer = context.payerByInvoice?.[item.invoice.id];
    // An account's invoice is not its patient's: neither a fund's patients nor a patient's flags select it
    if (payer ? Boolean(filter.fund) || filter.onlyFlag !== null : excluded(item.invoice.patientId)) continue;
    const portions = { medicalAidCents: toCents(item.medicalAid), patientCents: toCents(item.patient) };
    const owed = inScope(portions, filter.portion);
    // A credit invoice (negative total) reduces what the account owes, as in the aging report
    if (owed === 0) continue;
    const group = payer ? payerGroupFor(payer, item.invoice.patientId) : groupFor(item.invoice.patientId);
    group.bands[item.ageBand] += owed;
    if (filter.portion !== 'patient') group.medicalAidCents += portions.medicalAidCents;
    if (filter.portion !== 'medical_aid') group.patientCents += portions.patientCents;
    group.invoiceCount += 1;
    if (item.ageDays === null) group.undated = true;
    else group.oldestAgeDays = Math.max(group.oldestAgeDays ?? item.ageDays, item.ageDays);
  }

  // Accounts that owe nothing but hold credit, and funds whose money is not matched yet, still
  // belong on the age analysis: that money is what the unallocated column is for
  if (filter.includeCreditOnly && (filter.grouping === 'account' || filter.grouping === 'patient') && filter.portion !== 'medical_aid') {
    for (const [patientId, cents] of Object.entries(context.creditByPatient ?? {})) {
      if (cents > 0 && !excluded(patientId)) groupFor(patientId);
    }
  }
  if (filter.includeCreditOnly && (filter.grouping === 'fund' || filter.grouping === 'administrator') && filter.portion !== 'patient' && filter.onlyFlag === null) {
    for (const [fund, cents] of Object.entries(context.creditByFund ?? {})) {
      if (cents > 0 && (!filter.fund || fund === filter.fund)) groupFor(null, fund);
    }
  }

  const rows: AgeAnalysisRow[] = [];
  for (const group of groups.values()) {
    const owedCents = sumOf(Object.values(group.bands));
    // The patients' credit is theirs, not the account's (an account's payments are allocated on its own sheet)
    const unallocatedCents = group.payer ? 0 : creditOf(group, filter.grouping, context);
    const patientIds = [...group.patientIds].sort();
    const row: AgeAnalysisRow = {
      key: group.key,
      label: group.label,
      accountId: group.accountId,
      bands: group.bands,
      medicalAidCents: group.medicalAidCents,
      patientCents: group.patientCents,
      owedCents,
      unallocatedCents,
      netCents: owedCents - unallocatedCents,
      invoiceCount: group.invoiceCount,
      // An undated invoice cannot be shown to be recent: the row's oldest age is unknown
      oldestAgeDays: group.undated ? null : group.oldestAgeDays,
      patientIds,
      flags: group.payer ? [] : flagsOf(group.accountId ? [group.accountId, ...patientIds] : patientIds, context)
    };
    if (owedCents === 0 && unallocatedCents <= 0) continue;
    if (filter.minBalanceCents > 0 && owedCents < filter.minBalanceCents) continue;
    if (!owesAtLeast(row.bands, filter.minAgeDays)) continue;
    if (!matchesSearch(row, filter.search, context)) continue;
    rows.push(row);
  }

  const ageRank = (row: AgeAnalysisRow) => (row.invoiceCount > 0 && row.oldestAgeDays === null ? Infinity : row.oldestAgeDays ?? -1);
  rows.sort((a, b) => ageRank(b) - ageRank(a) || b.owedCents - a.owedCents || a.label.localeCompare(b.label));

  const totals: AgeAnalysisTotals = {
    bands: zeroBands(),
    medicalAidCents: 0,
    patientCents: 0,
    owedCents: 0,
    unallocatedCents: 0,
    netCents: 0,
    invoiceCount: 0,
    rowCount: rows.length
  };
  for (const row of rows) {
    for (const band of AGE_BANDS) totals.bands[band.key] += row.bands[band.key];
    totals.medicalAidCents += row.medicalAidCents;
    totals.patientCents += row.patientCents;
    totals.owedCents += row.owedCents;
    totals.unallocatedCents += row.unallocatedCents;
    totals.netCents += row.netCents;
    totals.invoiceCount += row.invoiceCount;
  }
  return { asOfKey: report.asOfKey, rows, totals };
}

/**
 * One account's own part of its debt (PATIENT_ACCOUNT_FILTER): netCents is what a reminder or a promise may ask for
 * (the patient portion still owed, less money the account paid that is not allocated yet), oldestAgeDays how old it
 * is. null when the account owes nothing itself, for example when only its medical aid's part is open.
 */
export function patientAccountRow(report: AgingReport, accountId: string, context: AgeAnalysisContext): AgeAnalysisRow | null {
  return buildAgeAnalysis(report, PATIENT_ACCOUNT_FILTER, context).rows.find(row => row.accountId === accountId) ?? null;
}

/** The patients behind an account row with what each owes, for the drill-down */
export function accountPatientRows(report: AgingReport, row: Pick<AgeAnalysisRow, 'patientIds'>, portion: PortionScope, context: AgeAnalysisContext): AgeAnalysisRow[] {
  const wanted = new Set(row.patientIds);
  const items = report.items.filter(item => item.invoice.patientId !== null && wanted.has(item.invoice.patientId));
  return buildAgeAnalysis({ ...report, items }, { ...DEFAULT_AGE_FILTER, grouping: 'patient', portion, excludeFlags: [] }, {
    ...context,
    creditByPatient: Object.fromEntries(Object.entries(context.creditByPatient ?? {}).filter(([patientId]) => wanted.has(patientId)))
  }).rows;
}

/** Unallocated credit of effective receipts per patient and per fund (suspense), cents */
export function creditByPayer(receipts: ReadonlyArray<{ payerType: string; patientId: string | null; fundName: string | null; unallocatedCents: number; reversal: unknown }>): {
  byPatient: Record<string, number>;
  byFund: Record<string, number>;
} {
  const byPatient: Record<string, number> = {};
  const byFund: Record<string, number> = {};
  for (const receipt of receipts) {
    if (receipt.reversal || receipt.unallocatedCents <= 0) continue;
    if (receipt.payerType === 'medical_aid') {
      const fund = receipt.fundName?.trim() || 'Medical aid';
      byFund[fund] = (byFund[fund] ?? 0) + receipt.unallocatedCents;
    } else if (receipt.patientId) {
      byPatient[receipt.patientId] = (byPatient[receipt.patientId] ?? 0) + receipt.unallocatedCents;
    }
  }
  return { byPatient, byFund };
}
