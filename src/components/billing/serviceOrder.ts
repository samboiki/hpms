/**
 * The order in which the visit screens offer codes, for every discipline: the practice's most used codes first, then
 * by code; while searching, the best match first (searchTariffs: the exact code, then codes that start with the text).
 * 8346 is never offered: the restorative material line comes with its restoration (as in quotes and bundles).
 */
import { compareTariffCodes, searchTariffs } from '../../utils/billing/pricing';
import { MATERIAL_FACTOR_CODE } from '../../utils/billing/tariffRules';
import { normalizeCode } from '../quotes/billingLines';
import type { VisitTariff } from '../visits/visitBillingLines';

/** How often the practice billed a code (usage counts are keyed by the code as billed). */
export const usesOf = (usage: Readonly<Record<string, number>>, code: string): number => usage[normalizeCode(code)] ?? usage[code] ?? 0;

export function orderServices<T extends VisitTariff>(tariffs: readonly T[], usage: Readonly<Record<string, number>>, query: string): T[] {
  const offered = tariffs.filter(tariff => normalizeCode(tariff.code) !== MATERIAL_FACTOR_CODE);
  if (query.trim()) {
    return searchTariffs(
      offered.map(tariff => ({ id: tariff.id, code: tariff.code, description: tariff.description?.trim() ?? '', tariff })),
      query
    ).map(match => match.tariff);
  }
  return [...offered].sort((a, b) => usesOf(usage, b.code) - usesOf(usage, a.code) || compareTariffCodes(a, b));
}
