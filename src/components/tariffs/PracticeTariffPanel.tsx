import React, { useEffect, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { formatNad } from '../../utils/billing/money';
import { isValidDateKey, todayKey } from '../../utils/billing/dates';
import {
  TARIFF_EXCLUSION_LABELS,
  searchTariffs,
  selectBillableTariffs,
  summarizeExclusions,
  type BillableTariff,
  type TariffExclusionReason,
  type TariffRow
} from '../../utils/billing/pricing';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { normalizeIcd10 } from '../../utils/billing/icd10';
import { suggestLineIcd10, tariffCodeKey, usualIcd10Problem } from '../../utils/billing/icd10Defaults';
import { PAID_BY_LABELS, isPaidBy, type PaidBy } from '../../utils/billing/lineSplit';
import { mergeOwnTariffs, type OwnTariffRow } from '../../utils/billing/practiceTariffs';
import { loadTariffIcd10Defaults, saveTariffIcd10Default, type Icd10DefaultsLoad } from '../../services/icd10DefaultsService';
import { removeOwnTariff, saveTariffPortions } from '../../services/practiceTariffService';
import { describeCodeRules, hasAnyRule, type CodeRules } from '../../utils/billing/codeRules';
import { loadCodeRules, type CodeRulesLoad } from '../../services/codeRulesService';
import type { PracticeTariffRecord } from './tariffAdmin';
import OwnTariffForm from './OwnTariffForm';
import CodeRulesForm from './CodeRulesForm';
import TariffIncreaseForm from './TariffIncreaseForm';
import Icd10SearchInput from '../billing/Icd10SearchInput';

interface PracticeTariffPanelProps {
  practiceType: string;
  tariffRows: readonly PracticeTariffRecord[];
  /** The practice whose usual ICD-10 codes are shown */
  practiceId: string;
  /** Practice administrators (and support) set the usual ICD-10 codes */
  canEdit: boolean;
  /** The practice's own codes (parity E13): `enabled` false until the database update; absent: not shown */
  ownTariffs?: { rows: readonly OwnTariffRow[]; enabled: boolean };
  /** Who pays each code's lines by default (parity D8); absent: not shown */
  portions?: { map: ReadonlyMap<string, PaidBy>; editable: boolean };
  /** Called after a code or a default portion was saved, to load the list again */
  onChanged?: () => void;
}

/** The form's starting point: a new code, or a code's current terms */
type Editing = { kind: 'new' } | { kind: 'code'; tariff: BillableTariff; shared: boolean };

const dayLabel = (key: string | null): string => (key && isValidDateKey(key) ? format(parseISO(key), 'd MMM yyyy') : '-');
const RULE_LABELS: Record<string, string> = { NO: 'Once per line', YES: 'Per unit', SOMETIMES: 'Per unit (check)', PROGRESSIVE: 'Per unit (check)' };
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

/** One tariff code's usual ICD-10 code: the practice's (bold) or the built-in dental one (grey), changed in place. */
const UsualIcd10Cell: React.FC<{
  code: string;
  own: string | null;
  builtIn: string | null;
  editable: boolean;
  onSave: (icd10: string | null) => Promise<void>;
}> = ({ code, own, builtIn, editable, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string | null) => {
    const problem = value === null ? null : usualIcd10Problem(value);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(value === null ? null : normalizeIcd10(value));
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'The code could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form
        className="flex min-w-[14rem] flex-wrap items-center gap-1"
        onSubmit={event => {
          event.preventDefault();
          void save(text);
        }}
      >
        {/* The medical aids' full list, by code or words; it marks codes that cannot be a line's main code */}
        <Icd10SearchInput
          value={text}
          onChange={next => setText(next.toUpperCase())}
          onPick={option => setText(option.code)}
          position="main"
          ariaLabel={`Usual ICD-10 code for ${code}`}
          ariaInvalid={error ? true : undefined}
          placeholder="e.g. J06.9"
          autoFocus
          className="w-24 rounded border border-gray-300 px-2 py-1 font-mono text-sm"
        />
        <button type="submit" disabled={busy} className={`rounded bg-[#01b9d4] px-2 py-1 text-xs font-medium text-white disabled:opacity-50 ${FOCUS}`}>
          Save
        </button>
        {own && (
          <button type="button" disabled={busy} onClick={() => void save(null)} className={`rounded px-2 py-1 text-xs font-medium text-gray-700 hover:underline disabled:opacity-50 ${FOCUS}`}>
            Clear
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`rounded px-2 py-1 text-xs text-gray-600 hover:underline ${FOCUS}`}>
          Cancel
        </button>
        {error && (
          <span className="w-full text-xs text-red-700" role="alert">
            {error}
          </span>
        )}
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {own ? (
        <span className="font-mono font-semibold text-gray-900">{own}</span>
      ) : builtIn ? (
        <span className="text-gray-500">
          <span className="font-mono">{builtIn}</span> <span className="text-xs">built-in</span>
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => {
            setText(own ?? '');
            setError(null);
            setEditing(true);
          }}
          aria-label={`${own ? 'Change' : 'Set'} the usual ICD-10 code for ${code}`}
          className={`rounded text-xs font-medium text-cyan-700 hover:underline ${FOCUS}`}
        >
          {own ? 'Change' : 'Set'}
        </button>
      )}
    </span>
  );
};

/** "Who pays" for one code: the practice's default portion for new lines of the code (parity D8). */
const PortionCell: React.FC<{ code: string; value: PaidBy | null; editable: boolean; onSave: (paidBy: PaidBy | null) => Promise<void> }> = ({
  code,
  value,
  editable,
  onSave
}) => {
  const [busy, setBusy] = useState(false);
  if (!editable) return <span className={value ? 'font-medium text-gray-900' : 'text-gray-400'}>{value ? PAID_BY_LABELS[value] : 'Usual split'}</span>;
  return (
    <select
      value={value ?? 'split'}
      disabled={busy}
      aria-label={`Who pays new lines of ${code}`}
      onChange={event => {
        const next = isPaidBy(event.target.value) ? event.target.value : null;
        setBusy(true);
        void onSave(next).finally(() => setBusy(false));
      }}
      className={`rounded border border-gray-300 bg-white px-2 py-1 text-xs ${FOCUS}`}
    >
      <option value="split">Usual split</option>
      <option value="fund">{PAID_BY_LABELS.fund}</option>
      <option value="patient">{PAID_BY_LABELS.patient}</option>
    </select>
  );
};

/** "When billed" for one code: its rules in a few words (parity E9, D13, O2), set or changed in the form above the list. */
const RulesCell: React.FC<{ code: string; words: readonly string[]; editable: boolean; onEdit: () => void }> = ({ code, words, editable, onEdit }) => (
  <span className="flex min-w-[7rem] max-w-[14rem] flex-wrap items-center gap-x-2">
    <span className={words.length > 0 ? 'text-gray-700' : 'text-gray-400'}>{words.length > 0 ? words.join(', ') : '-'}</span>
    {editable && (
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${words.length > 0 ? 'Change' : 'Set'} what happens when ${code} is billed`}
        className={`rounded text-xs font-medium text-cyan-700 hover:underline ${FOCUS}`}
      >
        {words.length > 0 ? 'Change' : 'Set'}
      </button>
    )}
  </span>
);

/** A code's current terms as the change form starts from them. */
const termsOf = (tariff: BillableTariff) => ({
  code: tariff.code,
  description: tariff.description,
  price: tariff.unitPrice.toFixed(2),
  perUnit: tariff.multiplyRule !== 'NO',
  needsTooth: tariff.requiresTooth
});

/**
 * The practice tariff as billing uses it on a date: one version per code (the newest in effect), with the rows left
 * out and why. Patients without medical aid, and funds without their own prices, pay these.
 * - The practice's own codes and prices (parity E13) are part of the list and win over the shared list of the
 *   practice type from their start date; practice administrators add a code, change one (a new price from a date) or
 *   take their own price off again. Other practices are never affected.
 * - Who pays new lines of each code (parity D8): the usual split, the medical aid all of it, or the patient all of it
 *   (never claimed).
 * - Each code's usual ICD-10 code (parity E8): new billing lines for the code start with it and claim review suggests
 *   it. Practice administrators set it; dental practices fall back to the built-in suggestions.
 * - When billed (parity E9, D13, O2): what happens when staff bill the code (the fund's authorisation number, lab work,
 *   time, do not claim, a recall, the place of service and the codes it brings with it; codeRules.ts).
 * - Yearly increase (parity E3): the practice's prices up by a percentage from a date (tariffIncrease.ts).
 */
const PracticeTariffPanel: React.FC<PracticeTariffPanelProps> = ({ practiceType, tariffRows, practiceId, canEdit, ownTariffs, portions, onChanged }) => {
  const [date, setDate] = useState(todayKey());
  const [search, setSearch] = useState('');
  const [usual, setUsual] = useState<Icd10DefaultsLoad | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  // One form at a time above the list: a code's terms (editing), its rules, or the yearly increase
  const [rulesFor, setRulesFor] = useState<BillableTariff | null>(null);
  const [increasing, setIncreasing] = useState(false);
  const [rulesLoad, setRulesLoad] = useState<CodeRulesLoad | null>(null);
  const [portionMap, setPortionMap] = useState<ReadonlyMap<string, PaidBy>>(portions?.map ?? new Map());
  const dateKey = isValidDateKey(date) ? date : todayKey();
  const ownRows = ownTariffs?.rows;
  const rows = useMemo(
    () => (ownRows ? mergeOwnTariffs(tariffRows as unknown as TariffRow[], ownRows) : tariffRows) as unknown as TariffRow[],
    [tariffRows, ownRows]
  );
  const ownIds = useMemo(() => new Set((ownRows ?? []).map(row => row.id)), [ownRows]);
  const sharedCodes = useMemo(() => new Set(tariffRows.map(row => tariffCodeKey(row.code ?? ''))), [tariffRows]);
  const { tariffs, excluded } = useMemo(() => selectBillableTariffs(rows, dateKey), [rows, dateKey]);
  const shown = useMemo(() => searchTariffs(tariffs, search), [tariffs, search]);
  const exclusionSummary = (Object.entries(summarizeExclusions(excluded)) as Array<[TariffExclusionReason, number]>)
    .map(([reason, count]) => `${count} ${TARIFF_EXCLUSION_LABELS[reason]}`)
    .join(', ');
  const dental = isDentalPractice(practiceType);
  const ownEditable = canEdit && ownTariffs?.enabled === true;
  const portionsShown = portions !== undefined;
  const portionsEditable = canEdit && portions?.editable === true;
  const portionSource = portions?.map;

  const latestPortions = useRef<ReadonlyMap<string, PaidBy>>(portionMap);
  useEffect(() => {
    const fresh = portionSource ?? new Map<string, PaidBy>();
    latestPortions.current = fresh;
    setPortionMap(fresh);
  }, [portionSource]);

  useEffect(() => {
    let cancelled = false;
    void loadTariffIcd10Defaults(practiceId).then(result => {
      if (!cancelled) setUsual(result);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  useEffect(() => {
    let cancelled = false;
    void loadCodeRules(practiceId)
      .catch((error: unknown): CodeRulesLoad => ({ status: 'error', rules: new Map(), message: error instanceof Error ? plainWords(error.message) : 'The code rules could not be read.' }))
      .then(result => {
        if (!cancelled) setRulesLoad(result);
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const codeRules = rulesLoad?.rules;
  const rulesReady = rulesLoad?.status === 'ready';
  const rulesEditable = canEdit && rulesReady;
  const billableCodes = useMemo(() => new Set(tariffs.map(tariff => tariffCodeKey(tariff.code))), [tariffs]);
  const describeCode = (code: string): string | null => tariffs.find(tariff => tariffCodeKey(tariff.code) === tariffCodeKey(code))?.description ?? null;
  const openForm = (next: { editing?: Editing; rulesFor?: BillableTariff; increasing?: boolean }) => {
    setEditing(next.editing ?? null);
    setRulesFor(next.rulesFor ?? null);
    setIncreasing(next.increasing === true);
  };
  const rulesSaved = (code: string, rules: CodeRules) => {
    setRulesLoad(current => {
      const next = new Map(current?.rules ?? []);
      if (hasAnyRule(rules)) next.set(tariffCodeKey(code), rules);
      else next.delete(tariffCodeKey(code));
      return { status: 'ready', rules: next };
    });
    setRulesFor(null);
  };

  const defaults = usual?.defaults ?? new Map<string, string>();
  const codesEditable = canEdit && usual?.status === 'ready';
  const saveUsual = async (code: string, icd10: string | null) => {
    await saveTariffIcd10Default(practiceId, code, icd10);
    setUsual(current => {
      const next = new Map(current?.defaults ?? []);
      if (icd10) next.set(tariffCodeKey(code), icd10);
      else next.delete(tariffCodeKey(code));
      return { status: 'ready', defaults: next, message: null };
    });
  };

  const savePortion = async (code: string, paidBy: PaidBy | null) => {
    // The whole list is saved each time: start from the latest one, so two quick changes never undo each other
    const before = latestPortions.current;
    const next = new Map(before);
    if (paidBy) next.set(tariffCodeKey(code), paidBy);
    else next.delete(tariffCodeKey(code));
    latestPortions.current = next;
    setPortionMap(next);
    try {
      await saveTariffPortions(practiceId, next);
      toast.success(`${code}: ${paidBy ? PAID_BY_LABELS[paidBy].toLowerCase() : 'the usual split'} for new lines.`);
      // The page reloads its copy, so the choice is still there after switching tabs
      onChanged?.();
    } catch (error) {
      if (latestPortions.current === next) {
        latestPortions.current = before;
        setPortionMap(before);
      }
      toast.error(error instanceof Error ? plainWords(error.message) : 'Who pays the code could not be saved.');
    }
  };

  const removeOwn = async (tariff: BillableTariff) => {
    const shared = sharedCodes.has(tariffCodeKey(tariff.code));
    const question = shared
      ? `Stop using your own price for ${tariff.code}? The shared list's price applies again.`
      : `Remove ${tariff.code} from your practice's list? It can no longer be added to visits; invoices already made keep it.`;
    if (!window.confirm(question)) return;
    try {
      await removeOwnTariff(practiceId, tariff.code);
      toast.success(shared ? `${tariff.code} is back on the shared price.` : `${tariff.code} removed.`);
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The code could not be removed.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Prices on</span>
          <input type="date" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Search</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Code or description"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        {ownEditable && (
          <button
            type="button"
            onClick={() => openForm({ editing: { kind: 'new' } })}
            className={`inline-flex items-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] ${FOCUS}`}
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add a code
          </button>
        )}
        {ownEditable && rulesReady && (
          <button
            type="button"
            onClick={() => openForm({ increasing: true })}
            className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${FOCUS}`}
          >
            <Icon icon="solar:graph-up-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Yearly increase
          </button>
        )}
        <p className="w-full text-sm text-gray-600">
          {tariffs.length} codes in effect on {dayLabel(dateKey)}
          {exclusionSummary ? ` (rows not used: ${exclusionSummary})` : ''}
        </p>
        <p className="w-full text-xs text-gray-500">
          {ownTariffs ? 'Codes marked "Practice\'s own" are your practice\'s prices: only your practice bills them. ' : ''}
          Usual ICD-10: new billing lines for the code start with it (staff can change it on the line) and claim review suggests it.
          {dental ? ' Codes marked built-in are the app\'s dental suggestions, used until the practice chooses its own.' : ''}
          {portionsShown ? ' Who pays: new lines of a medical aid patient start that way; staff can change it on the line.' : ''}
          {rulesReady
            ? " When billed: what happens when staff bill the code (the fund's authorisation number, lab work, time, a recall, the place of service and the codes it brings with it)."
            : ''}
          {!canEdit ? ' Practice administrators choose them.' : ''}
        </p>
        {rulesLoad?.status === 'not-set-up' && (
          <p className="w-full text-xs text-amber-700" role="status">
            What happens when a code is billed, and the yearly increase, can be set once the database update for them
            (proposals/2026-10-13-tariff-code-rules.sql) is applied.
          </p>
        )}
        {rulesLoad?.status === 'error' && (
          <p className="w-full text-xs text-red-700" role="alert">
            {rulesLoad.message}
          </p>
        )}
        {ownTariffs && !ownTariffs.enabled && (
          <p className="w-full text-xs text-amber-700" role="status">
            Your practice&apos;s own codes can be added once the database update for them (proposals/2026-10-09-practice-own-tariffs.sql) is applied.
          </p>
        )}
        {usual?.status === 'not-set-up' && (
          <p className="w-full text-xs text-amber-700" role="status">
            Usual ICD-10 codes are not set up yet: the database update for them has not been applied.
          </p>
        )}
        {usual?.status === 'error' && (
          <p className="w-full text-xs text-red-700" role="alert">
            {usual.message}
          </p>
        )}
      </div>

      {editing && (
        <OwnTariffForm
          key={editing.kind === 'new' ? 'new' : editing.tariff.id}
          practiceId={practiceId}
          initial={editing.kind === 'new' ? null : { ...termsOf(editing.tariff), shared: editing.shared }}
          dental={dental}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}

      {rulesFor && (
        <CodeRulesForm
          key={rulesFor.id}
          practiceId={practiceId}
          code={rulesFor.code}
          description={rulesFor.description}
          rules={codeRules?.get(tariffCodeKey(rulesFor.code)) ?? null}
          dental={dental}
          billableCodes={billableCodes}
          describe={describeCode}
          doNotClaim={
            portionsEditable
              ? { value: portionMap.get(tariffCodeKey(rulesFor.code)) === 'patient', onChange: next => savePortion(rulesFor.code, next ? 'patient' : null) }
              : undefined
          }
          onCancel={() => setRulesFor(null)}
          onSaved={rules => rulesSaved(rulesFor.code, rules)}
        />
      )}

      {increasing && (
        <TariffIncreaseForm
          practiceId={practiceId}
          rows={rows}
          today={todayKey()}
          onCancel={() => setIncreasing(false)}
          onApplied={() => {
            setIncreasing(false);
            onChanged?.();
          }}
        />
      )}

      <div className="max-h-[560px] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Usual ICD-10</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2">Quantity</th>
              {dental && <th className="px-4 py-2">Tooth</th>}
              {portionsShown && <th className="px-4 py-2">Who pays</th>}
              {rulesReady && <th className="px-4 py-2">When billed</th>}
              <th className="px-4 py-2">From</th>
              <th className="px-4 py-2">To</th>
              {ownEditable && (
                <th className="px-4 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map(tariff => {
              const own = defaults.get(tariffCodeKey(tariff.code)) ?? null;
              const builtIn = dental && !own ? suggestLineIcd10(tariff.code, { dental: true }).codes[0] ?? null : null;
              const isOwn = ownIds.has(tariff.id);
              const shared = sharedCodes.has(tariffCodeKey(tariff.code));
              return (
                <tr key={tariff.id}>
                  <td className="px-4 py-1.5 font-semibold text-gray-900">{tariff.code}</td>
                  <td className="max-w-lg px-4 py-1.5 text-gray-700" title={tariff.description}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{tariff.description}</span>
                      {isOwn && <span className="flex-shrink-0 rounded bg-cyan-50 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-800">Practice&apos;s own</span>}
                    </span>
                  </td>
                  <td className="px-4 py-1.5">
                    <UsualIcd10Cell code={tariff.code} own={own} builtIn={builtIn} editable={codesEditable} onSave={icd10 => saveUsual(tariff.code, icd10)} />
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium text-gray-900">{formatNad(tariff.unitPrice)}</td>
                  <td className="px-4 py-1.5 text-gray-600">{RULE_LABELS[tariff.multiplyRule] ?? tariff.multiplyRule}</td>
                  {dental && <td className="px-4 py-1.5 text-gray-600">{tariff.requiresTooth ? 'Required' : '-'}</td>}
                  {portionsShown && (
                    <td className="px-4 py-1.5">
                      <PortionCell
                        code={tariff.code}
                        value={portionMap.get(tariffCodeKey(tariff.code)) ?? null}
                        editable={portionsEditable}
                        onSave={paidBy => savePortion(tariff.code, paidBy)}
                      />
                    </td>
                  )}
                  {rulesReady && (
                    <td className="px-4 py-1.5">
                      <RulesCell
                        code={tariff.code}
                        words={describeCodeRules(codeRules?.get(tariffCodeKey(tariff.code)))}
                        editable={rulesEditable}
                        onEdit={() => openForm({ rulesFor: tariff })}
                      />
                    </td>
                  )}
                  <td className="px-4 py-1.5 text-gray-600">{dayLabel(tariff.effectiveFrom)}</td>
                  <td className="px-4 py-1.5 text-gray-600">{dayLabel(tariff.effectiveTo)}</td>
                  {ownEditable && (
                    <td className="whitespace-nowrap px-4 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => openForm({ editing: { kind: 'code', tariff, shared } })}
                        aria-label={`Change ${tariff.code}`}
                        className={`rounded text-xs font-medium text-cyan-700 hover:underline ${FOCUS}`}
                      >
                        Change
                      </button>
                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => void removeOwn(tariff)}
                          aria-label={shared ? `Use the shared price for ${tariff.code} again` : `Remove ${tariff.code}`}
                          className={`ml-3 rounded text-xs font-medium text-red-700 hover:underline ${FOCUS}`}
                        >
                          {shared ? 'Shared price' : 'Remove'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">
            {tariffs.length === 0 && ownEditable ? 'No codes yet: add your practice\'s first code with "Add a code".' : 'No codes match.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default PracticeTariffPanel;
