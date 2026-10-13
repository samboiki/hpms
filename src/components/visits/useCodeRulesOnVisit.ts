import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { ServiceSelection } from '../../types/billing';
import type { LineAuthorisation } from '../../utils/billing/authorisations';
import { codeKey, describePlaceOfService, lineRuleNotices, placeOfServiceFor, type CodeRules } from '../../utils/billing/codeRules';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { addLinkedLines, describeAddedLinks, type RuledVisitTariff } from './linkedCodeLines';
import type { VisitClaimDetailsState } from './useVisitClaimDetails';

export interface CodeRulesOnVisit {
  /** Per line: what it still needs because of its code's rules (the fund's authorisation number, the lab slip, the time) */
  lineNotices: Map<string, string[]>;
}

/**
 * The practice's rules per code on a visit's Billing tab (codeRules.ts), for every discipline:
 * - a code staff add brings its linked codes (linkedCodeLines.ts), however it is added (the code list, a bundle, the
 *   tooth chart); the lines the visit had when it opened are its own and bring nothing again;
 * - the first new code with a default place of service fills the visit's place of service when it is empty (medical aid
 *   patients: it goes on the claim), and says so;
 * - each line's notices: the fund's authorisation number, the lab and its slip, the time taken.
 * AddVisitTabs and EditVisitTabs call it once their lines are loaded (`ready`).
 */
export function useCodeRulesOnVisit(params: {
  ready: boolean;
  services: readonly ServiceSelection[];
  setServices: (services: ServiceSelection[]) => void;
  tariffs: readonly RuledVisitTariff[];
  hasMedicalAid: boolean;
  practiceType: string | null | undefined;
  /** The number each line takes from the patient's authorisations (useVisitBilling) */
  lineAuthorisations?: ReadonlyMap<string, LineAuthorisation>;
  /** The visit's claim details draft (useVisitClaimDetails) */
  claimDetails?: Pick<VisitClaimDetailsState, 'status' | 'draft' | 'setDraft'> | null;
}): CodeRulesOnVisit {
  const { ready, services, setServices, tariffs, hasMedicalAid, practiceType, lineAuthorisations, claimDetails } = params;
  // The lines already handled: null until the visit's own lines are loaded
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (seen.current === null) {
      seen.current = new Set(services.map(service => service.id));
      return;
    }
    const known = seen.current;
    const fresh = services.filter(service => !known.has(service.id));
    if (fresh.length === 0) return;
    fresh.forEach(service => known.add(service.id));

    const linked = addLinkedLines(services, new Set(fresh.map(service => service.id)), tariffs, {
      hasMedicalAid,
      dental: isDentalPractice(practiceType)
    });
    linked.services.forEach(service => known.add(service.id));
    if (linked.problems.length > 0) toast.error(linked.problems.join(' '), { id: 'linked-codes-problem', duration: 8000 });
    if (linked.added.length > 0) {
      setServices(linked.services);
      toast(describeAddedLinks(linked.added), { id: 'linked-codes', duration: 8000 });
    }

    const draft = claimDetails?.draft;
    if (hasMedicalAid && claimDetails?.status === 'ready' && draft && !draft.placeOfService.trim()) {
      const place = placeOfServiceFor(fresh, tariffs);
      if (place) {
        claimDetails.setDraft({ ...draft, placeOfService: place.place });
        toast(`Place of service set to ${describePlaceOfService(place.place)}, as code ${place.code} has it. Change it under Referral and hospital details.`, {
          id: 'place-of-service',
          duration: 8000
        });
      }
    }
  }, [ready, services, setServices, tariffs, hasMedicalAid, practiceType, claimDetails]);

  const rulesByCode = useMemo(() => {
    const map = new Map<string, CodeRules>();
    tariffs.forEach(tariff => {
      if (tariff.code_rules) map.set(codeKey(tariff.code), tariff.code_rules);
    });
    return map;
  }, [tariffs]);

  const lineNotices = useMemo(() => {
    const notices = new Map<string, string[]>();
    if (rulesByCode.size === 0) return notices;
    services.forEach(service => {
      const found = lineRuleNotices(service, rulesByCode.get(codeKey(service.code)), {
        hasMedicalAid,
        registerAuthorisation: lineAuthorisations?.get(service.id)?.number ?? null
      });
      if (found.length > 0) notices.set(service.id, found);
    });
    return notices;
  }, [services, rulesByCode, hasMedicalAid, lineAuthorisations]);

  return { lineNotices };
}
