import { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import type { ClaimLine } from '../../utils/billing/claimLine';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { isLabFeeLine, pairLabSlips, withLabDetails, type BilledLabOrder } from '../../utils/dental/labSlips';
import { loadBilledLabOrders } from '../../services/dental/labOrderService';
import type { PreSendIssue } from '../finance/claims/preSendChecks';

export interface BatchLabSlips {
  /** Errors on 8099 lines without a lab invoice that adds up to them (they block sending) */
  issues: PreSendIssue[];
  /** The claim lines as the file writes them: a paired 8099 line carries its lab's lines (type L records after it) */
  fileLines: readonly ClaimLine[];
  /** Said above the lines when the check could not run as it should */
  note: string | null;
}

const PREVENTS = "the fund refusing 8099 without the lab's lines, or when they do not add up to it";

/**
 * Claim review's check of a dental practice's 8099 lines (parity D28): the lab orders billed at the visits of the
 * batch's 8099 lines are read with the lab's invoice lines; each 8099 line is paired with the order whose lines add up
 * to it (pairLabSlips), and a line left without one is an error, so the batch cannot be sent until it is put right.
 * The claim file then writes each paired line's lab lines after it. Until the orders are read the 8099 lines wait
 * (sending an unchecked line is what the check prevents). Other practices, sent batches and credit files: nothing.
 */
export function useBatchLabSlips(options: { practiceType: string | null | undefined; lines: readonly ClaimLine[]; enabled: boolean }): BatchLabSlips {
  const { practiceType, lines, enabled } = options;
  const feeLines = useMemo(() => lines.filter(isLabFeeLine), [lines]);
  const visitKey = useMemo(() => [...new Set(feeLines.map(line => line.visitId).filter((id): id is string => Boolean(id)))].sort().join(','), [feeLines]);
  const active = enabled && isDentalPractice(practiceType) && feeLines.length > 0;
  const [loaded, setLoaded] = useState<{ key: string; orders: BilledLabOrder[] | null; note: string | null } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const visitIds = visitKey ? visitKey.split(',') : [];
    loadBilledLabOrders(visitIds)
      .then(result => {
        if (cancelled) return;
        setLoaded(
          result.status === 'not_set_up'
            ? { key: visitKey, orders: null, note: "Lab work is not set up yet, so 8099 lines are sent without the lab's lines." }
            : { key: visitKey, orders: result.orders, note: null }
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoaded({ key: visitKey, orders: [], note: `The lab orders could not be read (${error instanceof Error ? plainWords(error.message) : 'unknown error'}): reload the batch to check the 8099 lines.` });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, visitKey]);

  const current = loaded && loaded.key === visitKey ? loaded : null;
  const pairing = useMemo(() => (active && current?.orders ? pairLabSlips(lines, current.orders) : null), [active, current, lines]);
  const fileLines = useMemo(() => (pairing ? withLabDetails(lines, pairing) : lines), [pairing, lines]);
  const issues = useMemo<PreSendIssue[]>(() => {
    if (!active) return [];
    // Not set up yet: as before the lab update, nothing to check against
    if (current && current.orders === null) return [];
    if (!pairing) {
      return feeLines.map(line => ({ lineKey: line.key, severity: 'error', field: 'amount', prevents: PREVENTS, message: "Checking the lab's invoice for this 8099 line..." }));
    }
    return pairing.issues.map(issue => ({ lineKey: issue.lineKey, severity: issue.severity, field: 'amount', prevents: PREVENTS, message: issue.message }));
  }, [active, current, pairing, feeLines]);

  return { issues, fileLines, note: active ? current?.note ?? null : null };
}
