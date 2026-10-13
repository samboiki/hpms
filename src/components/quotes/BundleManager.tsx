import React, { useEffect, useId, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../utils/billing/money';
import { parseTariffPrice } from '../../utils/billing/pricing';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { billingCodeFor } from '../../utils/stock/items';
import type { VisitTariff } from '../visits/visitBillingLines';
import { findTariff, type LineContext } from './billingLines';
import {
  BUNDLE_COLOURS,
  BUNDLE_COLOUR_STYLES,
  bundleCodesSummary,
  bundleToDraft,
  checkBundleAgainstTariffs,
  emptyBundleDraft,
  isStockBundleLine,
  presetToDraft,
  previewBundle,
  starterBundlesFor,
  validateBundleDraft,
  type BundleDraft,
  type BundleLine,
  type CodeBundle
} from './bundles';
import { deleteBundle, loadBundleExtrasEnabled, saveBundle } from './quoteService';
import { useBundleStock, type BundleStock } from './useBundleStock';
import { MessageList, inputClass, labelClass, primaryButton, secondaryButton } from './QuoteBits';
import Icd10SearchInput from '../billing/Icd10SearchInput';

interface BundleManagerProps {
  practiceId: string;
  practiceType: string | null;
  /** Tariffs in effect today: used to check codes and show today's price */
  tariffs: readonly VisitTariff[];
  bundles: readonly CodeBundle[];
  /** Called after a bundle was saved or deleted, to reload the list */
  onChanged: () => void;
}

const previewContext = (tariffs: readonly VisitTariff[], practiceType: string | null): LineContext => ({
  tariffs,
  hasMedicalAid: false,
  autoInfectionControl: isDentalPractice(practiceType)
});

/** The practice's code bundles: list, starter suggestions, and the editor. */
const BundleManager: React.FC<BundleManagerProps> = ({ practiceId, practiceType, tariffs, bundles, onChanged }) => {
  const [draft, setDraft] = useState<BundleDraft | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // A line's ICD-10 code, fee and stock item, and "needs an authorisation number", once the database keeps them
  const [extras, setExtras] = useState(false);
  const context = useMemo(() => previewContext(tariffs, practiceType), [tariffs, practiceType]);
  const usesStock = extras && (draft !== null || bundles.some(bundle => bundle.lines.some(isStockBundleLine)));
  const stock = useBundleStock(practiceId, usesStock, false);
  const stockLine = stock.status === 'ready' ? stock.stockLine : undefined;
  const usedPresets = new Set(bundles.map(bundle => bundle.presetKey).filter(Boolean));
  const suggestions = starterBundlesFor(practiceType).filter(preset => !usedPresets.has(preset.key));

  useEffect(() => {
    let cancelled = false;
    void loadBundleExtrasEnabled()
      .then(enabled => {
        if (!cancelled) setExtras(enabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (draft) {
    return (
      <BundleEditor
        practiceId={practiceId}
        tariffs={tariffs}
        context={context}
        dental={isDentalPractice(practiceType)}
        extras={extras}
        stock={stock}
        initial={draft}
        onCancel={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          onChanged();
        }}
      />
    );
  }

  const remove = async (bundle: CodeBundle) => {
    if (!window.confirm(`Delete the bundle "${bundle.name}"? Visits and quotes that used it keep their lines.`)) return;
    setDeleting(bundle.id);
    try {
      await deleteBundle(bundle.id);
      toast.success(`Bundle "${bundle.name}" deleted.`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not delete the bundle.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Your bundles</h3>
          <p className="text-xs text-gray-500">Shared by everyone in the practice. Prices always come from the current tariff list.</p>
        </div>
        <button type="button" className={primaryButton} onClick={() => setDraft(emptyBundleDraft())}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          New bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No bundles yet. Create one, or start from a suggestion below.
        </p>
      ) : (
        <ul className="space-y-2">
          {bundles.map(bundle => {
            const preview = previewBundle(bundle, context, { stockLine });
            return (
              <li key={bundle.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <span className={`h-3 w-3 flex-shrink-0 rounded-full ${BUNDLE_COLOUR_STYLES[bundle.colour].dot}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{bundle.name}</p>
                  <p className="truncate text-xs text-gray-500">{bundleCodesSummary(bundle.lines)}</p>
                  {preview.problems.length > 0 && (
                    <p className="text-xs text-amber-700">{preview.problems.length} line(s) cannot be billed today: check the codes.</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatNad(fromCents(preview.totalCents))}</span>
                <div className="flex gap-1">
                  <button type="button" className={secondaryButton} onClick={() => setDraft(bundleToDraft(bundle))} aria-label={`Edit ${bundle.name}`}>
                    <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => void remove(bundle)}
                    disabled={deleting === bundle.id}
                    aria-label={`Delete ${bundle.name}`}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Starter suggestions</h3>
            <p className="text-xs text-gray-500">
              Suggestions only: check that the codes and quantities match how your practice bills, then save them as your own.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map(preset => (
              <li key={preset.key} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${BUNDLE_COLOUR_STYLES[preset.colour].dot}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {preset.name} <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Suggestion</span>
                    </p>
                    <p className="text-xs text-gray-500">{bundleCodesSummary(preset.lines)}</p>
                    <p className="mt-1 text-xs text-gray-600">{preset.description}</p>
                  </div>
                </div>
                <button type="button" className={`${secondaryButton} mt-2 w-full`} onClick={() => setDraft(presetToDraft(preset))}>
                  <Icon icon="solar:magic-stick-3-bold-duotone" className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                  Review and add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface BundleEditorProps {
  practiceId: string;
  tariffs: readonly VisitTariff[];
  context: LineContext;
  /** Dental practices: teeth, 8109 and 8346 are part of the wording */
  dental: boolean;
  /** The database keeps a line's ICD-10 code, fee and stock item, and "needs an authorisation number" */
  extras: boolean;
  stock: BundleStock;
  initial: BundleDraft;
  onCancel: () => void;
  onSaved: () => void;
}

const blankLine = (): BundleLine => ({ code: '', quantity: 1, tooth: null, notes: null });

const BundleEditor: React.FC<BundleEditorProps> = ({ practiceId, tariffs, context, dental, extras, stock, initial, onCancel, onSaved }) => {
  const listId = useId();
  const [draft, setDraft] = useState<BundleDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const stockItems = stock.status === 'ready' ? stock.items.filter(item => item.isActive) : [];
  const stockLine = stock.status === 'ready' ? stock.stockLine : undefined;

  const errors = useMemo(
    () => [...validateBundleDraft(draft), ...(tariffs.length > 0 ? checkBundleAgainstTariffs(draft.lines, tariffs) : [])],
    [draft, tariffs]
  );
  const preview = useMemo(() => previewBundle(draft, context, { stockLine }), [draft, context, stockLine]);

  const setLine = (index: number, patch: Partial<BundleLine>) =>
    setDraft(current => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }));

  const save = async () => {
    setAttempted(true);
    if (tariffs.length === 0) {
      toast.error('The tariff list has not loaded, so the codes cannot be checked. Try again in a moment.');
      return;
    }
    if (errors.length > 0) return;
    setSaving(true);
    try {
      await saveBundle(practiceId, draft);
      toast.success(`Bundle "${draft.name.trim()}" saved.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not save the bundle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" className={secondaryButton} onClick={onCancel} aria-label="Back to the bundles">
          <Icon icon="solar:alt-arrow-left-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 className="text-sm font-semibold text-gray-900">{draft.id ? 'Edit bundle' : 'New bundle'}</h3>
        {draft.presetKey && !draft.id && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">From a suggestion: review it</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            className={inputClass}
            value={draft.name}
            maxLength={60}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            placeholder="For example: Check-up with scale and polish"
          />
        </label>
        <div>
          <span className={labelClass}>Colour</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {BUNDLE_COLOURS.map(colour => (
              <button
                key={colour}
                type="button"
                role="radio"
                aria-checked={draft.colour === colour}
                aria-label={BUNDLE_COLOUR_STYLES[colour].label}
                title={BUNDLE_COLOUR_STYLES[colour].label}
                onClick={() => setDraft(current => ({ ...current, colour }))}
                className={`h-7 w-7 rounded-full ${BUNDLE_COLOUR_STYLES[colour].dot} ${draft.colour === colour ? 'ring-2 ring-offset-2 ring-gray-700' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Description (optional)</span>
        <input
          className={inputClass}
          value={draft.description}
          maxLength={200}
          onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
        />
      </label>

      {extras && (
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            checked={draft.needsAuthorisation === true}
            onChange={event => setDraft(current => ({ ...current, needsAuthorisation: event.target.checked }))}
          />
          <span>
            Needs an authorisation number
            <span className="block text-xs text-gray-500">On a medical aid visit staff are asked for the fund&apos;s number, which goes on every line.</span>
          </span>
        </label>
      )}

      <div className="space-y-2">
        <p className={labelClass}>Codes</p>
        <datalist id={listId}>
          {tariffs.map(tariff => (
            <option key={tariff.id} value={tariff.code}>
              {tariff.description ?? ''}
            </option>
          ))}
        </datalist>
        {draft.lines.map((line, index) => {
          const fromStock = isStockBundleLine(line);
          const tariff = !fromStock && line.code.trim() ? findTariff(tariffs, line.code) : undefined;
          const price = tariff ? parseTariffPrice(tariff.price) : null;
          const item = fromStock ? stockItems.find(entry => entry.id === line.stockItemId) : undefined;
          return (
            <div key={index} className="rounded-xl border border-gray-200 p-3">
              {extras && (
                <div className="mb-2 inline-flex rounded-lg bg-gray-100 p-0.5 text-xs" role="radiogroup" aria-label={`Line ${index + 1}: a tariff code or a stock item`}>
                  {[
                    { stock: false, label: 'Tariff code' },
                    { stock: true, label: 'Item from stock' }
                  ].map(choice => (
                    <button
                      key={choice.label}
                      type="button"
                      role="radio"
                      aria-checked={fromStock === choice.stock}
                      onClick={() => setLine(index, choice.stock ? { stockItemId: stockItems[0]?.id ?? null, code: stockItems[0] ? billingCodeFor(stockItems[0]) : '', tooth: null } : { stockItemId: null, code: '' })}
                      disabled={choice.stock && stockItems.length === 0}
                      title={choice.stock && stockItems.length === 0 ? 'The practice has no stock items yet' : undefined}
                      className={`rounded-md px-2.5 py-1 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                        fromStock === choice.stock ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.2fr)_5rem_5rem_minmax(0,1.5fr)_auto] sm:items-end">
                {fromStock ? (
                  <label className="col-span-2 block sm:col-span-1">
                    <span className={labelClass}>Item</span>
                    <select
                      className={inputClass}
                      value={line.stockItemId ?? ''}
                      onChange={event => {
                        const chosen = stockItems.find(entry => entry.id === event.target.value);
                        if (chosen) setLine(index, { stockItemId: chosen.id, code: billingCodeFor(chosen) });
                      }}
                    >
                      {!item && <option value={line.stockItemId ?? ''}>Not in the stock list any more</option>}
                      {stockItems.map(entry => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="col-span-2 block sm:col-span-1">
                    <span className={labelClass}>Code</span>
                    <input
                      className={inputClass}
                      list={listId}
                      value={line.code}
                      inputMode="text"
                      autoComplete="off"
                      onChange={event => setLine(index, { code: event.target.value.toUpperCase() })}
                      placeholder={dental ? '8101' : '0190'}
                    />
                  </label>
                )}
                <label className="block">
                  <span className={labelClass}>Qty</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={fromStock ? 1 : 0.01}
                    max={99}
                    step={fromStock ? 1 : 'any'}
                    value={Number.isFinite(line.quantity) ? line.quantity : ''}
                    onChange={event => setLine(index, { quantity: event.target.value === '' ? Number.NaN : Number(event.target.value) })}
                  />
                </label>
                {dental && !fromStock ? (
                  <label className="block">
                    <span className={labelClass}>Tooth</span>
                    <input
                      className={inputClass}
                      value={line.tooth ?? ''}
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="Ask"
                      onChange={event => setLine(index, { tooth: event.target.value.trim() || null })}
                    />
                  </label>
                ) : (
                  <span className="hidden sm:block" aria-hidden="true" />
                )}
                <label className="col-span-2 block sm:col-span-1">
                  <span className={labelClass}>Note (optional)</span>
                  <input
                    className={inputClass}
                    value={line.notes ?? ''}
                    maxLength={200}
                    onChange={event => setLine(index, { notes: event.target.value || null })}
                  />
                </label>
                <button
                  type="button"
                  className={`${secondaryButton} col-span-2 sm:col-span-1`}
                  onClick={() => setDraft(current => ({ ...current, lines: current.lines.filter((_, i) => i !== index) }))}
                  disabled={draft.lines.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
                  <span className="sm:hidden">Remove</span>
                </button>
              </div>
              {extras && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
                  <div>
                    <label htmlFor={`${listId}-icd10-${index}`} className={labelClass}>
                      ICD-10 code (optional)
                    </label>
                    {/* The medical aids' full list, by code or by words; the code becomes the main code of the line */}
                    <Icd10SearchInput
                      id={`${listId}-icd10-${index}`}
                      className={inputClass}
                      value={line.icd10 ?? ''}
                      position="main"
                      placeholder="e.g. J06.9 or sinusitis"
                      onChange={text => setLine(index, { icd10: text.toUpperCase() || null })}
                      onPick={option => setLine(index, { icd10: option.code })}
                      onBlur={() => {
                        if (line.icd10 && line.icd10 !== line.icd10.trim()) setLine(index, { icd10: line.icd10.trim() || null });
                      }}
                    />
                  </div>
                  <label className="block">
                    <span className={labelClass}>Fee per unit, N$ (optional)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.fee !== null && line.fee !== undefined && Number.isFinite(line.fee) ? line.fee : ''}
                      placeholder={fromStock ? 'Stock price' : 'Price list'}
                      onChange={event => setLine(index, { fee: event.target.value === '' ? null : Number(event.target.value) })}
                    />
                  </label>
                </div>
              )}
              {fromStock ? (
                <p className={`mt-1 text-xs ${item ? 'text-gray-500' : 'text-amber-700'}`}>
                  {item ? `${item.name}: priced as "From stock" lines are, and taken off stock when the visit is saved` : 'This item is no longer in the stock list: choose another or remove the line'}
                </p>
              ) : (
                line.code.trim() && (
                  <p className={`mt-1 text-xs ${tariff ? 'text-gray-500' : 'text-amber-700'}`}>
                    {tariff
                      ? `${tariff.description ?? ''}${price !== null ? ` · ${formatNad(price)} today` : ''}`
                      : 'Not in the tariff list in effect today'}
                  </p>
                )
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setDraft(current => ({ ...current, lines: [...current.lines, blankLine()] }))}
          disabled={draft.lines.length >= 30}
        >
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add code
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {dental
          ? 'Leave the tooth empty to be asked for it when the bundle is used. Infection control (8109) is added once per visit automatically, and fillings bring their 8346 material line. Codes charged once per visit (8109, 8110, 8145) are never added twice to one visit.'
          : 'Each code is priced from the tariff list on the day the bundle is used.'}
        {extras ? ' A fee set here replaces the price list for this bundle and is shown on the line as a changed fee.' : ''}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm">
        <span className="text-gray-600">Price today, with automatic lines</span>
        <span className="font-semibold text-gray-900">{formatNad(fromCents(preview.totalCents))}</span>
      </div>

      {attempted && <MessageList tone="error" title="Fix these before saving" messages={errors} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={primaryButton} onClick={() => void save()} disabled={saving}>
          <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} aria-hidden="true" />
          {saving ? 'Saving...' : 'Save bundle'}
        </button>
      </div>
    </div>
  );
};

export default BundleManager;
