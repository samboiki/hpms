/**
 * Pure helpers for the Tariffs page (pages/admin/TariffManagement.tsx): fund choices, schedule versions and the
 * rows an import saves. The pricing itself is fundPricing.ts; the import reading is tariffImport.ts.
 */
import { compareTariffCodes } from '../../utils/billing/pricing';
import { toDateKey } from '../../utils/billing/dates';
import type { PlannedImportRow } from '../../utils/billing/tariffImport';
import type { FundTariffRecord, NewFundTariff, NewPracticeTariff } from '../../services/fundPricingService';

export interface FundOption {
  reference: string;
  label: string;
}

/** Funds that can have a schedule: providers with a fund code (claims use the same code), plus codes already used. */
export function fundOptions(
  providers: readonly { name: string | null; short_name?: string | null; medical_aid_reference: string | null }[],
  rows: readonly { fund_reference: string | null }[]
): FundOption[] {
  const byReference = new Map<string, string>();
  providers.forEach(provider => {
    const reference = (provider.medical_aid_reference ?? '').trim().toUpperCase();
    if (!reference || byReference.has(reference)) return;
    byReference.set(reference, `${provider.name?.trim() || provider.short_name?.trim() || reference} (${reference})`);
  });
  rows.forEach(row => {
    const reference = (row.fund_reference ?? '').trim().toUpperCase();
    if (reference && !byReference.has(reference)) byReference.set(reference, reference);
  });
  return [...byReference.entries()].map(([reference, label]) => ({ reference, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** One imported or entered set of prices: the rows of one fund, plan option, scope and date range. */
export interface ScheduleVersion {
  key: string;
  fundReference: string;
  planOption: string | null;
  /** null: shared by every practice of the type */
  practiceId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string | null;
  codeCount: number;
  ids: string[];
}

/** Groups fund price rows into the versions staff imported, newest first. */
export function scheduleVersions(rows: readonly FundTariffRecord[]): ScheduleVersion[] {
  const versions = new Map<string, ScheduleVersion>();
  rows.forEach(row => {
    if (row.is_active === false) return;
    const fundReference = (row.fund_reference ?? '').trim().toUpperCase();
    const effectiveFrom = toDateKey(row.effective_from ?? null) ?? '';
    const effectiveTo = row.effective_to ? toDateKey(row.effective_to) : null;
    const planOption = row.plan_option?.trim() || null;
    const practiceId = row.practice_id ?? null;
    const key = [fundReference, planOption ?? '', practiceId ?? '', effectiveFrom, effectiveTo ?? '', row.source ?? ''].join('|');
    const version = versions.get(key) ?? { key, fundReference, planOption, practiceId, effectiveFrom, effectiveTo, source: row.source ?? null, codeCount: 0, ids: [] };
    version.codeCount += 1;
    version.ids.push(row.id);
    versions.set(key, version);
  });
  return [...versions.values()].sort(
    (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || a.fundReference.localeCompare(b.fundReference) || (a.planOption ?? '').localeCompare(b.planOption ?? '')
  );
}

/** The fund price rows an import saves: new codes and changed prices from the start date. */
export function fundTariffRowsToSave(
  plan: readonly PlannedImportRow[],
  target: {
    practiceTypeId: string;
    practiceId: string | null;
    fundReference: string;
    planOption: string | null;
    startDate: string;
    endDate: string | null;
    source: string;
  }
): NewFundTariff[] {
  return plan
    .filter(row => (row.status === 'new' || row.status === 'changed') && row.price !== null)
    .map(row => ({
      practice_type_id: target.practiceTypeId,
      practice_id: target.practiceId,
      fund_reference: target.fundReference.trim().toUpperCase(),
      plan_option: target.planOption?.trim() || null,
      code: row.code,
      description: row.description || null,
      unit_price: row.price as number,
      effective_from: target.startDate,
      effective_to: target.endDate,
      source: target.source
    }));
}

/** A practice_tariffs row as the page loads it (the fields a new version copies). */
export interface PracticeTariffRecord {
  id: string | null;
  code: string | null;
  description?: string | null;
  price: number | string | null;
  unit?: string | null;
  is_active?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  can_be_multiplied?: string | null;
  requires_tooth_number?: string | null;
  business_rule_formula?: string | null;
  example_calculation?: string | null;
  notes?: string | null;
}

/**
 * The practice tariff rows a NAMAF import saves: a new version of each new or changed code from the start date. A
 * code keeps the quantity rule, tooth flag and notes of its latest version, so a yearly update changes prices and
 * nothing else; a code new to the list is billed once per line and without a tooth until an administrator sets it.
 */
export function practiceTariffRowsToSave(
  plan: readonly PlannedImportRow[],
  existing: readonly PracticeTariffRecord[],
  target: { practiceTypeId: string; startDate: string; endDate: string | null }
): NewPracticeTariff[] {
  const latestByCode = new Map<string, PracticeTariffRecord>();
  [...existing]
    .filter(row => row.code)
    .sort((a, b) => (toDateKey(a.effective_from ?? null) ?? '').localeCompare(toDateKey(b.effective_from ?? null) ?? ''))
    .forEach(row => latestByCode.set((row.code ?? '').trim().toUpperCase(), row));
  return plan
    .filter(row => (row.status === 'new' || row.status === 'changed') && row.price !== null)
    .map(row => {
      const previous = latestByCode.get(row.code);
      return {
        practice_type_id: target.practiceTypeId,
        code: row.code,
        description: row.description || previous?.description || null,
        price: row.price as number,
        unit: previous?.unit ?? null,
        is_active: true,
        effective_from: target.startDate,
        effective_to: target.endDate,
        can_be_multiplied: previous?.can_be_multiplied ?? 'NO',
        requires_tooth_number: previous?.requires_tooth_number ?? 'NO',
        business_rule_formula: previous?.business_rule_formula ?? null,
        example_calculation: previous?.example_calculation ?? null,
        notes: previous?.notes ?? null
      };
    })
    .sort((a, b) => compareTariffCodes(a, b));
}
