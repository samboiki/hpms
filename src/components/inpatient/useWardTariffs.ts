import { useQuery } from '@tanstack/react-query';
import { loadPracticeNamaf, loadWardDayTariffs } from '../../services/namafTariffService';
import type { NamafTariff } from '../../utils/billing/namafTariffs';
import type { TariffForBilling } from '../../utils/inpatient/inpatientRules';

/** A code as the ward screens show and bill it */
type CodeRow = {
  id: string;
  code: string;
  description?: string | null;
  price: unknown;
  can_be_multiplied?: string | null;
  /** The day the row's amount starts */
  effective_from?: string | null;
  /** Set on a NAMAF row: the list it is from (NAMAF publishes a new version each year) */
  namaf?: { validFrom: string };
};

/** "NAMAF 2026": the list a NAMAF row is from, by the year it starts */
const listLabel = (row: CodeRow): string | null => (row.namaf ? `NAMAF ${row.namaf.validFrom.slice(0, 4)}` : null);
const startOf = (row: CodeRow): string => (row.namaf?.validFrom ?? row.effective_from ?? '').slice(0, 10);

/**
 * The tariff a ward code bills as: the practice's own tariff list first (the shared list of its type), then the NAMAF
 * benchmark of its discipline, then the private hospital's ward fees per day (so a GP practice with beds can bill
 * 001 "surgical cases: per day"). The first list that has the code wins, so the hint on the ward setup always names
 * what the stay bill will use.
 *
 * With a date (the night being billed), a NAMAF list's version in force that day is used: the latest one that has
 * started, so a stay across New Year takes each year's amount. A night before the first version has no amount (price 0).
 * The price carries where it came from ("NAMAF 2026"); the practice's own list has no label.
 */
export function wardTariffLookup(...lists: ReadonlyArray<readonly CodeRow[]>): (code: string, date?: string) => TariffForBilling | undefined {
  const versions = new Map<string, CodeRow[]>();
  lists.forEach(list => {
    const inThisList = new Map<string, CodeRow[]>();
    list.forEach(row => {
      const code = row.code.trim().toUpperCase();
      if (code && !versions.has(code)) inThisList.set(code, [...(inThisList.get(code) ?? []), row]);
    });
    inThisList.forEach((rows, code) => versions.set(code, rows));
  });
  return (code, date) => {
    const key = code.trim().toUpperCase();
    const rows = versions.get(key);
    if (!rows) return undefined;
    const started = date && rows[0].namaf ? rows.filter(row => startOf(row) <= date) : rows;
    const notYet = started.length === 0;
    // The latest version in force; before every version, the earliest only to name the code (it has no amount that day)
    const row = notYet
      ? rows.reduce((best, item) => (startOf(item) < startOf(best) ? item : best))
      : started.reduce((best, item) => (startOf(item) > startOf(best) ? item : best));
    const price = Number(row.price);
    const source = notYet ? null : listLabel(row);
    return {
      id: row.id,
      code: key,
      description: row.description?.trim() ?? '',
      price: !notYet && Number.isFinite(price) ? price : 0,
      can_be_multiplied: row.can_be_multiplied ?? null,
      ...(source ? { priceSource: source } : {})
    };
  };
}

export interface WardTariffs {
  /** The NAMAF benchmark of the practice's discipline */
  practiceList: NamafTariff[];
  /** The private hospital's ward fees per day (57001 surgical ... 57007 day admission) */
  wardDayCodes: NamafTariff[];
}

/** The NAMAF codes the ward setup and the stay bill use besides the practice's tariff list (none before the list exists). */
export function useWardTariffs(practiceId: string | null, practiceType: string | null) {
  return useQuery<WardTariffs>({
    queryKey: ['inpatient', 'namaf-codes', practiceId, practiceType],
    queryFn: async () => {
      const [namaf, wardDayCodes] = await Promise.all([loadPracticeNamaf(practiceId, practiceType), loadWardDayTariffs().catch(() => [] as NamafTariff[])]);
      return { practiceList: namaf.tariffs, wardDayCodes };
    },
    staleTime: 30 * 60 * 1000
  });
}
