import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import type { ServiceSelection } from '../../types/billing';
import { loadPatientPackages, loadPromotions } from '../../services/billing/billingExtrasService';
import { formatNad, fromCents, toCents } from '../../utils/billing/money';
import {
  billNormally,
  describePackageBalance,
  packageFor,
  packageState,
  payFromPackages,
  usesOnLines,
  type PatientPackage
} from '../../utils/billing/packages';
import {
  applyPromotions,
  describeOffer,
  promotionCanApply,
  promotionFor,
  syncPromotedLines,
  withoutPromotion,
  type PromotedLineSeen,
  type Promotion
} from '../../utils/billing/promotions';

interface VisitBillingExtrasProps {
  /** The visit's lines are loaded: lines there now are the visit's own and are left as they are */
  ready: boolean;
  practiceId: string | null;
  patientId: string | null;
  /** The visit's saved invoice: its own package lines are on the screen, so the package count leaves it out */
  invoiceId: string | null;
  services: readonly ServiceSelection[];
  setServices: (lines: ServiceSelection[]) => void;
  hasMedicalAid: boolean;
  visitDateKey: string;
  /** The visit's tariffs, priced for the patient: a line billed normally again takes its price from here */
  tariffs: ReadonlyArray<{ id: string; price: unknown; default_paid_by?: ServiceSelection['paidBy'] | null }>;
  /** The invoice is locked (paid or claimed): nothing is changed */
  locked: boolean;
}

const BUTTON = 'font-medium text-cyan-800 underline underline-offset-2 hover:text-cyan-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded';

/**
 * Prepaid packages and promotions on the visit's Billing tab (parity D17, D18). A code staff add that a package covers is
 * paid from it (N$ 0.00, the package named); on a private patient's new line a running promotion takes its percentage
 * or amount off, with the promotion named, so Finance > Reports > Discounts given lists it. Each can be undone here. The
 * patient's packages show what is left and until when. Shown only when there is something to say.
 */
export const VisitBillingExtras: React.FC<VisitBillingExtrasProps> = ({
  ready,
  practiceId,
  patientId,
  invoiceId,
  services,
  setServices,
  hasMedicalAid,
  visitDateKey,
  tariffs,
  locked
}) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [packages, setPackages] = useState<PatientPackage[]>([]);
  // The lines already handled: null until the visit's own lines are loaded
  const seen = useRef<Set<string> | null>(null);
  const promoted = useRef<Map<string, PromotedLineSeen>>(new Map());

  useEffect(() => {
    if (!practiceId) return;
    let live = true;
    void loadPromotions(practiceId).then(result => {
      if (live) setPromotions(result.status === 'ready' ? result.data : []);
    });
    return () => {
      live = false;
    };
  }, [practiceId]);

  useEffect(() => {
    if (!patientId) return;
    let live = true;
    void loadPatientPackages(patientId, invoiceId).then(result => {
      if (live) setPackages(result.status === 'ready' ? result.data : []);
    });
    return () => {
      live = false;
    };
  }, [patientId, invoiceId]);

  // New lines: paid from a package that covers them, else a private patient's running promotion
  useEffect(() => {
    if (!ready || locked) return;
    if (seen.current === null) {
      seen.current = new Set(services.map(line => line.id));
      return;
    }
    const known = seen.current;
    const fresh = services.filter(line => !known.has(line.id));
    if (fresh.length === 0) return;
    fresh.forEach(line => known.add(line.id));
    const ids = new Set(fresh.map(line => line.id));
    const paid = payFromPackages(services, packages, { lineIds: ids, visitDateKey, hasMedicalAid });
    const promo = applyPromotions(paid.lines, promotions, { hasMedicalAid, visitDateKey, lineIds: ids });
    const said = [
      ...paid.used.map(item => `${item.code} is paid from the prepaid package "${item.pack.name}".`),
      ...promo.applied.map(item => `${item.code}: ${item.promotion.name}, ${formatNad(fromCents(item.discountCents))} off.`)
    ];
    if (said.length > 0) {
      setServices(promo.lines);
      toast(`${said.join(' ')} Undo it under the lines if it should not apply.`, { id: 'billing-extras', duration: 8000 });
    }
  }, [ready, locked, services, packages, promotions, visitDateKey, hasMedicalAid, setServices]);

  // Promoted lines follow a change of quantity or price, and let go of the promotion when staff type another discount
  useEffect(() => {
    if (!ready || locked) return;
    const result = syncPromotedLines(services, promotions, { hasMedicalAid, seen: promoted.current });
    promoted.current = result.seen;
    if (result.lines !== services) setServices([...result.lines]);
  }, [ready, locked, services, promotions, hasMedicalAid, setServices]);

  const uses = useMemo(() => usesOnLines(services), [services]);
  const shownPackages = packages.filter(pack => packageState(pack, visitDateKey) === 'active' || uses.has(pack.id));
  const packageLines = services.filter(line => line.packageId);
  const promotedLines = services.filter(line => line.promotionId);
  // Lines a promotion or a package could still take (added before they loaded, or undone): offered, never forced
  const promotionOffers = locked ? [] : services.flatMap(line => {
    if (line.promotionId || !promotionCanApply(line, hasMedicalAid)) return [];
    const promotion = promotionFor(promotions, line.code, line.serviceDate || visitDateKey);
    return promotion ? [{ line, promotion }] : [];
  });
  const packageOffers = locked ? [] : services.flatMap(line => {
    if (line.packageId || line.isAutoGenerated) return [];
    const pack = packageFor(packages, line.code, line.serviceDate || visitDateKey, Number(line.quantity) || 1, uses);
    return pack ? [{ line, pack }] : [];
  });
  const medicalAidPromotion = hasMedicalAid && services.some(line => promotionFor(promotions, line.code, line.serviceDate || visitDateKey));

  if (shownPackages.length === 0 && packageLines.length === 0 && promotedLines.length === 0 && promotionOffers.length === 0 && packageOffers.length === 0 && !medicalAidPromotion) {
    return null;
  }

  const replace = (lineId: string, next: ServiceSelection) => setServices(services.map(line => (line.id === lineId ? next : line)));
  const nameOf = (id: string | undefined) => promotions.find(item => item.id === id)?.name ?? 'a promotion';
  const packageName = (id: string | undefined) => packages.find(item => item.id === id)?.name ?? 'a prepaid package';

  return (
    <div role="status" className="-mt-4 flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
      <Icon icon="solar:ticket-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <ul className="min-w-0 space-y-1">
        {shownPackages.map(pack => (
          <li key={pack.id}>
            Prepaid package &quot;{pack.name}&quot;: {describePackageBalance(pack, visitDateKey, uses.get(pack.id) ?? 0)}
            {uses.has(pack.id) ? ' after this visit' : ''}.
          </li>
        ))}
        {packageLines.map(line => (
          <li key={`pack-${line.id}`}>
            {line.code} is paid from &quot;{packageName(line.packageId)}&quot; (N$ 0.00).{' '}
            {!locked && (
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  const normal = billNormally(line, tariffs);
                  if (normal) replace(line.id, normal);
                  else toast.error(`${line.code} is not in this visit's tariffs any more: remove the line and add it again.`);
                }}
              >
                Bill it normally
              </button>
            )}
          </li>
        ))}
        {promotedLines.map(line => (
          <li key={`promo-${line.id}`}>
            {line.code}: {nameOf(line.promotionId)}, {formatNad(fromCents(toCents(line.discountAmount ?? 0)))} off.{' '}
            {!locked && (
              <button type="button" className={BUTTON} onClick={() => replace(line.id, withoutPromotion(line))}>
                Remove the promotion
              </button>
            )}
          </li>
        ))}
        {packageOffers.map(({ line, pack }) => (
          <li key={`offer-pack-${line.id}`}>
            {line.code} can be paid from &quot;{pack.name}&quot;.{' '}
            <button
              type="button"
              className={BUTTON}
              onClick={() => setServices(payFromPackages(services, packages, { lineIds: new Set([line.id]), visitDateKey, hasMedicalAid }).lines)}
            >
              Pay from the package
            </button>
          </li>
        ))}
        {promotionOffers.map(({ line, promotion }) => (
          <li key={`offer-promo-${line.id}`}>
            {line.code}: &quot;{promotion.name}&quot; gives {describeOffer(promotion)}.{' '}
            <button
              type="button"
              className={BUTTON}
              onClick={() => setServices(applyPromotions(services, promotions, { hasMedicalAid, visitDateKey, lineIds: new Set([line.id]) }).lines)}
            >
              Apply it
            </button>
          </li>
        ))}
        {medicalAidPromotion && (
          <li>A promotion runs on a code of this visit, but promotions are for private patients: a medical aid line is claimed at the agreed price.</li>
        )}
      </ul>
    </div>
  );
};

export default VisitBillingExtras;
