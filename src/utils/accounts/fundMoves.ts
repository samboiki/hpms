/**
 * Moving many patients from one fund or option to another in one step (parity A21): which funds and options the
 * practice's patients are on (as recorded, spellings grouped), who a choice moves (with simple filters), the checks,
 * and what apply_fund_move receives (proposals/2026-10-13-fund-moves.sql). The database moves only patients whose
 * medical aid is still as the preview showed it, and never touches claims already sent.
 */
import { identifyFund } from '../remittance/funds';
import { isMainMemberRelationship } from '../patients/medicalAidMember';

/** One patient's medical aid row as the move reads it (no membership numbers: the move does not need them) */
export interface FundMemberRow {
  medicalAidId: string;
  patientId: string;
  patientName: string;
  /** medical_aid_details.provider as stored */
  provider: string;
  scheme: string;
  /** medical_aid_details.plan_type: the option */
  planType: string;
  providerId: string | null;
  relationship: string | null;
}

/** A fund the practice can move patients to (medical_aid_providers) */
export interface FundProvider {
  id: string;
  name: string;
  /** The claim code, e.g. NMC1 */
  reference: string | null;
}

export const OPTION_NOT_RECORDED = 'Option not recorded';
export const FUND_NOT_RECORDED = 'Fund not recorded';

const oneLine = (value: string | null | undefined): string => (value ?? '').trim().replace(/\s+/g, ' ');

/** Options compare without case and extra spaces ("Gold ", "gold" are one option) */
export const optionKey = (planType: string | null | undefined): string => oneLine(planType).toLowerCase();

/** The fund a row is on: the linked fund when the row names one (what claims use), else the name as written */
export function fundKeyOf(row: Pick<FundMemberRow, 'provider' | 'providerId'>, providers: readonly FundProvider[]): string {
  if (row.providerId && providers.some(provider => provider.id === row.providerId)) return `id:${row.providerId}`;
  const identity = identifyFund(row.provider);
  const named = identity ? providers.find(provider => identifyFund(provider.reference, provider.name) === identity) : undefined;
  if (named) return `id:${named.id}`;
  const text = oneLine(row.provider);
  return text ? `name:${(identity?.label ?? text).toLowerCase()}` : 'name:';
}

export interface FundOption {
  key: string;
  label: string;
  count: number;
}

export interface FundGroup {
  key: string;
  label: string;
  /** The claim code when the fund is a linked one */
  reference: string | null;
  count: number;
  options: FundOption[];
  /** How the fund is written on the files of this group, when not one way */
  spellings: string[];
}

/** The funds the practice's patients are on, most patients first, each with its options (most patients first) */
export function groupFunds(rows: readonly FundMemberRow[], providers: readonly FundProvider[]): FundGroup[] {
  const groups = new Map<string, { label: string; reference: string | null; count: number; options: Map<string, Map<string, number>>; spellings: Map<string, number> }>();
  const tally = (counts: Map<string, number>, value: string) => counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const row of rows) {
    const key = fundKeyOf(row, providers);
    let group = groups.get(key);
    if (!group) {
      const provider = key.startsWith('id:') ? providers.find(item => item.id === key.slice(3)) : undefined;
      const label = provider?.name ?? (identifyFund(row.provider)?.label || oneLine(row.provider) || FUND_NOT_RECORDED);
      group = { label, reference: provider?.reference ?? null, count: 0, options: new Map(), spellings: new Map() };
      groups.set(key, group);
    }
    group.count += 1;
    if (oneLine(row.provider)) tally(group.spellings, oneLine(row.provider));
    const option = optionKey(row.planType);
    const spellings = group.options.get(option) ?? new Map<string, number>();
    tally(spellings, oneLine(row.planType));
    group.options.set(option, spellings);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      reference: group.reference,
      count: group.count,
      spellings: group.spellings.size > 1 ? mostUsedFirst(group.spellings) : [],
      options: [...group.options.entries()]
        .map(([option, spellings]) => {
          const count = [...spellings.values()].reduce((sum, value) => sum + value, 0);
          // The option as most files write it
          return { key: option, label: option ? mostUsedFirst(spellings)[0] : OPTION_NOT_RECORDED, count };
        })
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Spellings, the most used first; on a tie a capitalised one ("Standard" before "standard") */
function mostUsedFirst(counts: ReadonlyMap<string, number>): string[] {
  const lowerOnly = (value: string) => (value === value.toLowerCase() ? 1 : 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || lowerOnly(a[0]) - lowerOnly(b[0]) || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

export type MemberScope = 'everyone' | 'main' | 'dependants';

export const MEMBER_SCOPE_LABELS: Record<MemberScope, string> = {
  everyone: 'Main members and dependants',
  main: 'Main members only',
  dependants: 'Dependants only'
};

export interface FundMoveFilter {
  fundKey: string;
  /** The options to move; empty: every option of the fund */
  optionKeys: readonly string[];
  scope: MemberScope;
  /** A name to narrow the list by */
  search: string;
}

export interface FundMoveTarget {
  providerId: string;
  /** The option after the move; empty: each patient keeps their option */
  option: string;
}

/** True when the move would change nothing for this row (already on that fund and option) */
export function alreadyThere(row: FundMemberRow, target: FundMoveTarget): boolean {
  if (row.providerId !== target.providerId) return false;
  return !oneLine(target.option) || optionKey(row.planType) === optionKey(target.option);
}

/** Who a choice moves, A to Z by name (rows already on the target are left out) */
export function patientsToMove(rows: readonly FundMemberRow[], providers: readonly FundProvider[], filter: FundMoveFilter, target: FundMoveTarget | null): FundMemberRow[] {
  const search = oneLine(filter.search).toLowerCase();
  return rows
    .filter(row => fundKeyOf(row, providers) === filter.fundKey)
    .filter(row => filter.optionKeys.length === 0 || filter.optionKeys.includes(optionKey(row.planType)))
    .filter(row => {
      if (filter.scope === 'everyone') return true;
      const main = isMainMemberRelationship(row.relationship);
      return filter.scope === 'main' ? main : !main;
    })
    .filter(row => !search || row.patientName.toLowerCase().includes(search))
    .filter(row => !target || !alreadyThere(row, target))
    .sort((a, b) => a.patientName.localeCompare(b.patientName));
}

/** What was chosen, in words, kept with the move: "Namibia Medical Care (NMC), options Standard, Plus; main members only" */
export function describeChoice(group: Pick<FundGroup, 'label' | 'options'>, filter: Pick<FundMoveFilter, 'optionKeys' | 'scope'>): string {
  const options = filter.optionKeys.length === 0
    ? 'every option'
    : `option${filter.optionKeys.length === 1 ? '' : 's'} ${filter.optionKeys.map(key => group.options.find(option => option.key === key)?.label ?? OPTION_NOT_RECORDED).join(', ')}`;
  return `${group.label}, ${options}${filter.scope === 'everyone' ? '' : `; ${MEMBER_SCOPE_LABELS[filter.scope].toLowerCase()}`}`;
}

export const MAX_PATIENTS_PER_MOVE = 2000;

/** Why the move cannot be made as it stands; null when it can */
export function fundMoveProblem(input: { selected: number; target: FundMoveTarget | null; reason: string }): string | null {
  if (input.selected === 0) return 'Choose at least one patient to move';
  if (input.selected > MAX_PATIENTS_PER_MOVE) return `Move at most ${MAX_PATIENTS_PER_MOVE.toLocaleString('en-ZA')} patients at a time`;
  if (!input.target?.providerId) return 'Choose the fund the patients move to';
  if (oneLine(input.target.option).length > 100) return 'The option is too long (at most 100 characters)';
  const reason = input.reason.trim();
  if (reason.length < 3) return "Say why the patients move (it is kept on each patient's file)";
  if (reason.length > 500) return 'The reason is too long (at most 500 characters)';
  return null;
}

/** What apply_fund_move receives: each patient with their medical aid as the preview showed it */
export function fundMovePayload(rows: readonly FundMemberRow[], target: FundMoveTarget, reason: string, fromLabel: string) {
  return {
    reason: reason.trim(),
    from_label: fromLabel,
    to: { provider_id: target.providerId, option: oneLine(target.option) },
    patients: rows.map(row => ({
      patient_id: row.patientId,
      medical_aid_id: row.medicalAidId,
      expected: { provider: row.provider, plan_type: row.planType, medical_aid_provider_id: row.providerId }
    }))
  };
}

/**
 * One medical aid record's change at one moment: how a change history entry finds the fund move it was part of (the
 * move and the record's audit row are written in one transaction, so they carry the same moment)
 */
export const fundMoveKey = (medicalAidId: string, at: string): string => `${medicalAidId}|${Date.parse(at)}`;

export interface FundMoveResult {
  moveId: string | null;
  moved: number;
  skipped: Array<{ patientId: string; why: 'not_found' | 'changed' | 'already' | string }>;
  claimsMoved: number;
}

/** The outcome in a sentence: "12 patients moved; 3 claims not sent yet went with them; 1 changed since the list was made and was left" */
export function describeFundMoveResult(result: FundMoveResult): string {
  const parts = [`${result.moved} ${result.moved === 1 ? 'patient' : 'patients'} moved`];
  if (result.claimsMoved > 0) parts.push(`${result.claimsMoved} ${result.claimsMoved === 1 ? 'claim not sent yet went' : 'claims not sent yet went'} to the new fund's batch`);
  const changed = result.skipped.filter(item => item.why === 'changed').length;
  const already = result.skipped.filter(item => item.why === 'already').length;
  const gone = result.skipped.length - changed - already;
  if (changed > 0) parts.push(`${changed} ${changed === 1 ? 'was' : 'were'} changed since the list was made and left as ${changed === 1 ? 'it is' : 'they are'}`);
  if (already > 0) parts.push(`${already} ${already === 1 ? 'was' : 'were'} already there`);
  if (gone > 0) parts.push(`${gone} could not be found any more`);
  return `${parts.join('; ')}.`;
}
