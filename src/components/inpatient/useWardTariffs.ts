import { useQuery } from '@tanstack/react-query';
import { loadPracticeNamaf, loadWardDayTariffs } from '../../services/namafTariffService';
import type { NamafTariff } from '../../utils/billing/namafTariffs';
import type { TariffForBilling } from '../../utils/inpatient/inpatientRules';

/** A code as the ward screens show and bill it */
type CodeRow = { id: string; code: string; description?: string | null; price: unknown; can_be_multiplied?: string | null };

/**
 * The tariff a ward code bills as: the practice's own tariff list first (the shared list of its type), then the NAMAF
 * benchmark of its discipline, then the private hospital's ward fees per day (so a GP practice with beds can bill
 * 001 "surgical cases: per day"). The first list that has the code wins, so the hint on the ward setup always names
 * what the stay bill will use.
 */
export function wardTariffLookup(...lists: ReadonlyArray<readonly CodeRow[]>): (code: string) => TariffForBilling | undefined {
  const byCode = new Map<string, TariffForBilling>();
  lists.forEach(list =>
    list.forEach(row => {
      const code = row.code.trim().toUpperCase();
      const price = Number(row.price);
      if (!code || byCode.has(code)) return;
      byCode.set(code, { id: row.id, code, description: row.description?.trim() ?? '', price: Number.isFinite(price) ? price : 0, can_be_multiplied: row.can_be_multiplied ?? null });
    })
  );
  return code => byCode.get(code.trim().toUpperCase());
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
