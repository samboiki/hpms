import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { parseAmountInput, type CashierLine } from '../../../services/ledgerService';
import {
  CASHIER_COUNT_METHODS,
  CASHIER_METHOD_LABELS,
  cashierDay,
  cashierDifferences,
  cashierExpected,
  cashiersStillToCount,
  changedSinceCount,
  checkCashierCount,
  handOverCents,
  standingCashierCounts,
  type CashierCashUp,
  type CashierCountMethod
} from '../../../services/ledger/cashierCashUp';
import { LoadingState, Notice, SectionCard } from '../FinanceUI';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, SummaryRow, inputClass } from '../receipts/ArUi';
import { formatDay } from '../receipts/receiptDocuments';
import { CASHIER_CASH_UPS_NOT_SET_UP, loadCashierCounts, recordCashierCount, type CashierCountsLoad } from './cashierCashUpService';

const nad = (cents: number) => formatNad(fromCents(cents));
const ZERO = /^\s*(N\$)?\s*0+([.,]0*)?\s*$/i;
const amountOf = (text: string): number | null => (text.trim() === '' ? null : ZERO.test(text) ? 0 : parseAmountInput(text));

interface CashierCashUpsProps {
  practiceId: string;
  dayKey: string;
  /** The day's cashier report lines (receipts per person who captured them) */
  lines: readonly CashierLine[];
  staffNames: Readonly<Record<string, string>>;
  /** The signed-in staff member */
  myId: string | null;
  isAdmin: boolean;
  /** The day's month is closed */
  locked: boolean;
  /** Tells Day end whether every cashier with takings has cashed up (the administrator signs off then) */
  onStillToCount?: (names: string[]) => void;
}

/**
 * Cash-up per cashier (owner, 13 Oct 2026): each cashier counts their own till, card slips and EFTs against their
 * own receipts, with their own float; the administrator sees every cashier of the day, then closes the day.
 */
export const CashierCashUps: React.FC<CashierCashUpsProps> = ({ practiceId, dayKey, lines, staffNames, myId, isAdmin, locked, onStillToCount }) => {
  const [load, setLoad] = useState<CashierCountsLoad | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoad(null);
    loadCashierCounts(practiceId, dayKey).then(result => { if (!cancelled) setLoad(result); });
    return () => { cancelled = true; };
  }, [practiceId, dayKey]);
  useEffect(() => reload(), [reload]);

  const counts = useMemo(() => (load?.state === 'ready' ? load.counts : []), [load]);
  const rows = useMemo(() => cashierDay(lines, counts), [lines, counts]);
  const nameOf = (id: string) => staffNames[id] ?? (id === myId ? 'You' : 'Staff member');
  const waiting = cashiersStillToCount(rows);

  useEffect(() => {
    if (onStillToCount) onStillToCount(load?.state === 'ready' ? waiting.map(row => nameOf(row.cashierId)) : []);
    // nameOf only reads staffNames and myId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, rows, onStillToCount]);

  if (!load) return <LoadingState label="Loading the cashier counts" rows={2} />;
  if (load.state === 'not_set_up') return <Notice tone="info" title="Cash-up per cashier is not set up yet">{CASHIER_CASH_UPS_NOT_SET_UP}</Notice>;
  if (load.state === 'error') return <ErrorBox>{load.message}</ErrorBox>;

  const mine = myId ? standingCashierCounts(counts).get(myId) ?? null : null;
  const myLine = myId ? lines.find(line => line.userId === myId) ?? null : null;

  return (
    <div className="space-y-6">
      {myId && <MyCount practiceId={practiceId} dayKey={dayKey} line={myLine} mine={mine} locked={locked} onSaved={reload} />}

      {isAdmin && (
        <SectionCard
          title="Cashiers"
          subtitle={`Each cashier's count against their own receipts, ${formatDay(dayKey)}`}
          icon="solar:users-group-rounded-bold-duotone"
          tone="violet"
        >
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">Nobody took money or cashed up on this day.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Cashier</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Float in</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Cash expected</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Cash counted</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Card</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">EFT</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Over / short</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Handed over</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.cashierId} className="text-gray-700 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{nameOf(row.cashierId)}</p>
                        {!row.count && <p className="text-xs text-amber-800">Not cashed up</p>}
                        {row.count?.notes && <p className="text-xs text-gray-500 break-words">{row.count.notes}</p>}
                        {changedSinceCount(row) && <p className="text-xs text-amber-800">Receipts changed after the count</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{row.count ? nad(row.count.floatInCents) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{nad(row.count?.expected.cash ?? row.expectedNow.cash)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{row.count ? nad(row.count.counted.cash) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {row.count ? `${nad(row.count.counted.card)} of ${nad(row.count.expected.card)}` : nad(row.expectedNow.card)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {row.count ? `${nad(row.count.counted.eft)} of ${nad(row.count.expected.eft)}` : nad(row.expectedNow.eft)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${row.differenceCents ? 'text-amber-800 font-medium' : ''}`}>
                        {row.differenceCents === null ? '—' : row.differenceCents === 0 ? 'Balanced' : `${row.differenceCents > 0 ? 'Over' : 'Short'} ${nad(Math.abs(row.differenceCents))}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{row.count ? nad(handOverCents(row.count.counted.cash, row.count.floatOutCents)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {waiting.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-800">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Still to cash up: {waiting.map(row => nameOf(row.cashierId)).join(', ')}. Close the day once they have.
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
};

interface MyCountProps {
  practiceId: string;
  dayKey: string;
  line: CashierLine | null;
  mine: CashierCashUp | null;
  locked: boolean;
  onSaved: () => void;
}

type CountTexts = Record<CashierCountMethod, string>;

/** The signed-in cashier's own count: float in, what they counted per method, float kept back */
const MyCount: React.FC<MyCountProps> = ({ practiceId, dayKey, line, mine, locked, onSaved }) => {
  const [counting, setCounting] = useState(!mine);
  const [floatIn, setFloatIn] = useState('');
  const [floatOut, setFloatOut] = useState('');
  const [counted, setCounted] = useState<CountTexts>({ cash: '', card: '', eft: '' });
  const [notes, setNotes] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCounting(!mine);
    setFloatIn(mine ? String(fromCents(mine.floatInCents)) : '');
    setFloatOut('');
    setCounted({ cash: '', card: '', eft: '' });
    setNotes('');
    setReplaceReason('');
    setError(null);
  }, [mine, dayKey]);

  const floatInCents = amountOf(floatIn);
  const expected = cashierExpected(line, floatInCents ?? 0);
  const countedCents = { cash: amountOf(counted.cash), card: amountOf(counted.card), eft: amountOf(counted.eft) };
  const allCounted = CASHIER_COUNT_METHODS.every(method => countedCents[method] !== null);
  const differences = allCounted ? cashierDifferences(expected, countedCents as Record<CashierCountMethod, number>) : null;

  const save = async () => {
    const draft = { floatInCents, counted: countedCents, floatOutCents: amountOf(floatOut), notes };
    const check = checkCashierCount(draft, line);
    if (!check.ok) { setError(check.error); return; }
    if (mine && replaceReason.trim().length < 3) { setError('You already cashed up this day. Say why you count again.'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await recordCashierCount(practiceId, dayKey, {
        floatInCents: floatInCents ?? 0,
        floatOutCents: draft.floatOutCents ?? 0,
        counted: countedCents as Record<CashierCountMethod, number>,
        notes,
        replaceReason
      });
      toast.success(`Cashed up${result.difference === 0 ? ': everything balances' : ''}`);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your cash-up was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={mine ? 'You cashed up' : 'Cash up your till'}
      subtitle={mine ? `Counted ${mine.countedAt ? new Date(mine.countedAt).toLocaleString('en-NA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}` : 'Count your own takings against the payments you captured'}
      icon={mine ? 'solar:check-circle-bold-duotone' : 'solar:wad-of-money-bold-duotone'}
      tone={mine ? 'green' : 'amber'}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <SummaryRow label="Your cash payments, less cash refunds" value={nad(line?.expectedCashCents ?? 0)} />
          <SummaryRow label="Your card payments" value={nad(line?.byMethod.card ?? 0)} />
          <SummaryRow label="Your EFT payments" value={nad(line?.byMethod.eft ?? 0)} />
          {mine && (
            <>
              <SummaryRow label="Float in" value={nad(mine.floatInCents)} />
              {CASHIER_COUNT_METHODS.map(method => (
                <SummaryRow
                  key={method}
                  label={CASHIER_METHOD_LABELS[method]}
                  value={`${nad(mine.counted[method])} of ${nad(mine.expected[method])}`}
                  tone={mine.counted[method] === mine.expected[method] ? 'good' : 'warning'}
                />
              ))}
              <SummaryRow label="Float kept for tomorrow" value={nad(mine.floatOutCents)} />
              <SummaryRow label="Cash handed over" value={nad(handOverCents(mine.counted.cash, mine.floatOutCents))} strong />
              {mine.notes && <p className="pt-1 text-xs text-gray-600">Note: {mine.notes}</p>}
            </>
          )}
        </div>

        <div className="space-y-3">
          {locked && <Notice tone="info">This month is closed, so this day cannot be counted again.</Notice>}
          {mine && !counting && !locked && (
            <SecondaryButton icon="solar:refresh-bold-duotone" onClick={() => setCounting(true)}>Count again</SecondaryButton>
          )}
          {counting && !locked && (
            <>
              {error && <ErrorBox>{error}</ErrorBox>}
              <Field label="Float you started with" htmlFor="cashier-float-in" hint="The cash in your till before the first payment (0 if none)">
                <AmountInput id="cashier-float-in" value={floatIn} onChange={event => setFloatIn(event.target.value)} invalid={floatIn.trim() !== '' && floatInCents === null} />
              </Field>
              {CASHIER_COUNT_METHODS.map(method => (
                <Field
                  key={method}
                  label={CASHIER_METHOD_LABELS[method]}
                  htmlFor={`cashier-count-${method}`}
                  hint={method === 'cash' ? `Expected ${nad(expected.cash)}, float included` : `Expected ${nad(expected[method])}`}
                >
                  <AmountInput
                    id={`cashier-count-${method}`}
                    value={counted[method]}
                    onChange={event => setCounted(current => ({ ...current, [method]: event.target.value }))}
                    invalid={counted[method].trim() !== '' && countedCents[method] === null}
                  />
                </Field>
              ))}
              {differences && (
                <ul className="space-y-1 text-sm">
                  {differences.map(difference => (
                    <li key={difference.method} className={`flex items-center gap-1.5 ${difference.differenceCents === 0 ? 'text-green-700' : 'text-amber-800'}`}>
                      <Icon icon={difference.differenceCents === 0 ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
                      {CASHIER_METHOD_LABELS[difference.method]}: {difference.differenceCents === 0 ? 'balances' : `${difference.differenceCents > 0 ? 'over' : 'short'} by ${nad(Math.abs(difference.differenceCents))}`}
                    </li>
                  ))}
                </ul>
              )}
              <Field label="Float you keep in the till for tomorrow" htmlFor="cashier-float-out" hint="The rest of the cash is handed over (0 to hand over everything)">
                <AmountInput id="cashier-float-out" value={floatOut} onChange={event => setFloatOut(event.target.value)} invalid={floatOut.trim() !== '' && amountOf(floatOut) === null} />
              </Field>
              <Field label={differences?.some(difference => difference.differenceCents !== 0) ? 'Why is it over or short?' : 'Note (optional)'} htmlFor="cashier-notes">
                <textarea id="cashier-notes" rows={2} className={inputClass} value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} />
              </Field>
              {mine && (
                <Field label="Why count again?" htmlFor="cashier-replace">
                  <input id="cashier-replace" className={inputClass} value={replaceReason} onChange={event => setReplaceReason(event.target.value)} maxLength={200} />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <PrimaryButton icon="solar:lock-keyhole-bold-duotone" onClick={() => void save()} busy={saving}>Save my cash-up</PrimaryButton>
                {mine && <SecondaryButton onClick={() => setCounting(false)} disabled={saving}>Keep the earlier count</SecondaryButton>}
              </div>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
};
