import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { SectionCard } from '../finance/FinanceUI';
import { saveStockSettings } from '../../services/stock/stockService';
import { parseAmountText } from '../../utils/stock/items';
import { PRICE_RULE_LIMITS, describeBand, draftsFromPriceRule, priceRuleFromDrafts, priceStockLine, type PriceBandDraft } from '../../utils/stock/pricing';
import { toCents } from '../../utils/billing/money';
import { canStock, whoCan } from '../../utils/stock/stockRoles';
import type { StockContext } from './stockContext';
import { PricingRulesCards, usePricingRulesForm } from './PricingRulesCards';
import { StoresCard } from './StoresCard';
import { INPUT, LABEL, PRIMARY, QUIET, SECONDARY, STOCK_COLOR, errorText, nad } from './stockUi';

const LABEL_NOTE_MAX = 120;

interface Draft {
  dispensingEnabled: boolean;
  vatRate: string;
  bands: PriceBandDraft[];
  scriptValidMonths: string;
  labelNote: string;
}

const draftFrom = (settings: StockContext['settings']): Draft => ({
  dispensingEnabled: settings.dispensingEnabled,
  vatRate: String(settings.defaultVatRate),
  bands: draftsFromPriceRule(settings.priceRule),
  scriptValidMonths: String(settings.scriptValidMonths),
  labelNote: settings.labelNote ?? ''
});

/**
 * The practice's stock settings: whether it dispenses, its VAT rate, its own price rule (markup and dispensing fee by
 * cost band: OneHealth builds in no pricing formula), how long repeats stay valid and a note for labels.
 */
export const StockSettingsTab: React.FC<{ context: StockContext }> = ({ context }) => {
  const { settings } = context;
  const canEdit = canStock(context.role, 'settings');
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [saving, setSaving] = useState(false);
  const [tryCost, setTryCost] = useState('100');
  useEffect(() => setDraft(draftFrom(settings)), [settings]);
  // The medicine price tiers and the material rule (NAMAF rule 013), saved with the rest
  const pricing = usePricingRulesForm(settings, context.practiceId);

  const parsedRule = useMemo(() => priceRuleFromDrafts(draft.bands), [draft.bands]);
  const rule = parsedRule.rule;
  const vat = parseAmountText(draft.vatRate);
  const vatError = vat === null || vat > 100 ? 'A VAT rate from 0 to 100%, at most 2 decimals.' : null;
  const months = /^\d+$/.test(draft.scriptValidMonths.trim()) ? Number(draft.scriptValidMonths.trim()) : null;
  const monthsError = months === null || months < 1 || months > 24 ? 'From 1 to 24 months.' : null;
  const noteError = draft.labelNote.trim().length > LABEL_NOTE_MAX ? `Keep the note to ${LABEL_NOTE_MAX} characters.` : null;

  const tryCents = parseAmountText(tryCost);
  const example = rule && vat !== null && tryCents !== null && tryCents > 0
    ? priceStockLine({ quantity: 1, lineCostCents: toCents(tryCents), vatRate: settings.vatRegistered ? vat : 0, rule, fixedUnitPriceCents: null })
    : null;

  const setBand = (index: number, patch: Partial<PriceBandDraft>) =>
    setDraft(current => ({ ...current, bands: current.bands.map((band, at) => (at === index ? { ...band, ...patch } : band)) }));
  const addBand = () =>
    setDraft(current => {
      // The new band goes before the open last band, which keeps covering everything above it
      const last = current.bands[current.bands.length - 1];
      return { ...current, bands: [...current.bands.slice(0, -1), { upTo: '', markup: last.markup, fee: last.fee }, last] };
    });
  const removeBand = (index: number) =>
    setDraft(current => ({ ...current, bands: current.bands.filter((_, at) => at !== index) }));

  const save = async () => {
    if (!rule || vat === null || vatError || months === null || monthsError || noteError || pricing.problem) {
      toast.error(parsedRule.error ?? vatError ?? monthsError ?? noteError ?? pricing.problem ?? 'Check the settings.');
      return;
    }
    setSaving(true);
    try {
      await saveStockSettings(context.practiceId, {
        dispensingEnabled: draft.dispensingEnabled,
        defaultVatRate: vat,
        priceRule: rule,
        scriptValidMonths: months,
        labelNote: draft.labelNote.trim() || null
      });
      await pricing.save();
      toast.success('Stock settings saved');
      context.reloadSettings();
    } catch (error) {
      toast.error(errorText(error, 'Could not save the settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600" role="note">
          <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          {whoCan('settings')} You can see the settings here.
        </p>
      )}

      <SectionCard title="Dispensing" subtitle="Stock for consumables works for every practice; dispensing is for practices that hand out medicine" icon="solar:pills-3-bold-duotone" tone={STOCK_COLOR.tone}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            role="switch"
            checked={draft.dispensingEnabled}
            disabled={!canEdit}
            onChange={event => setDraft(current => ({ ...current, dispensingEnabled: event.target.checked }))}
            aria-describedby="stock-dispensing-help"
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">We dispense medicine</span>
            <span id="stock-dispensing-help" className="block text-sm text-gray-500">
              Shows dispensing in the visit and the patient file: the medicine from stock, directions, a label, repeats, and the line on the bill with its NAPPI code.
            </span>
          </span>
        </label>
        {draft.dispensingEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="stock-script-months" className={LABEL}>Repeats stay valid for (months)</label>
              <input
                id="stock-script-months"
                inputMode="numeric"
                className={INPUT}
                value={draft.scriptValidMonths}
                disabled={!canEdit}
                aria-invalid={monthsError ? true : undefined}
                aria-describedby="stock-script-months-help"
                onChange={event => setDraft(current => ({ ...current, scriptValidMonths: event.target.value }))}
              />
              <p id="stock-script-months-help" className={`mt-1 text-xs ${monthsError ? 'text-red-600' : 'text-gray-500'}`}>
                {monthsError ?? 'Counted from the first dispensing. After that, the repeats can no longer be dispensed.'}
              </p>
            </div>
            <div>
              <label htmlFor="stock-label-note" className={LABEL}>Note on every label</label>
              <input
                id="stock-label-note"
                className={INPUT}
                value={draft.labelNote}
                disabled={!canEdit}
                maxLength={LABEL_NOTE_MAX}
                placeholder="For example: Keep out of reach of children"
                aria-invalid={noteError ? true : undefined}
                aria-describedby="stock-label-note-help"
                onChange={event => setDraft(current => ({ ...current, labelNote: event.target.value }))}
              />
              <p id="stock-label-note-help" className={`mt-1 text-xs ${noteError ? 'text-red-600' : 'text-gray-500'}`}>
                {noteError ?? `Optional, up to ${LABEL_NOTE_MAX} characters.`}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Selling prices" subtitle="Your own markup and dispensing fee by cost band, then VAT. Items with their own selling price keep it." icon="solar:tag-price-bold-duotone" tone={STOCK_COLOR.tone}>
        <div className="max-w-xs">
          <label htmlFor="stock-vat" className={LABEL}>VAT rate (%)</label>
          <input
            id="stock-vat"
            inputMode="decimal"
            className={INPUT}
            value={draft.vatRate}
            disabled={!canEdit}
            aria-invalid={vatError ? true : undefined}
            aria-describedby="stock-vat-help"
            onChange={event => setDraft(current => ({ ...current, vatRate: event.target.value }))}
          />
          <p id="stock-vat-help" className={`mt-1 text-xs ${vatError ? 'text-red-600' : 'text-gray-500'}`}>
            {vatError ?? (settings.vatRegistered
              ? 'For VAT-able items without their own rate, on prices and on supplier invoices.'
              : 'On supplier invoices. Prices carry no VAT: the practice is not VAT registered (Settings > Practice).')}
          </p>
        </div>

        {!settings.priceRuleReadable && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            The saved price rule could not be read, so items are priced at cost until it is saved again.
          </p>
        )}

        <fieldset className="mt-4" disabled={!canEdit}>
          <legend className="text-sm font-medium text-gray-700">Price bands, by the cost of the dispensed line (excluding VAT)</legend>
          <ol className="mt-2 space-y-2">
            {draft.bands.map((band, index) => {
              const last = index === draft.bands.length - 1;
              const id = `stock-band-${index}`;
              return (
                <li key={index} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    {last ? (
                      <>
                        <p className="mb-1 block text-xs font-medium text-gray-600">Band {index + 1}: cost</p>
                        <p className="py-2 text-sm text-gray-500">{index === 0 ? 'Any cost' : 'Everything above the band before'}</p>
                      </>
                    ) : (
                      <>
                        <label htmlFor={`${id}-upto`} className="mb-1 block text-xs font-medium text-gray-600">Band {index + 1}: cost up to (N$)</label>
                        <input id={`${id}-upto`} inputMode="decimal" className={INPUT} value={band.upTo} onChange={event => setBand(index, { upTo: event.target.value })} />
                      </>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${id}-markup`} className="mb-1 block text-xs font-medium text-gray-600">Markup (%)</label>
                    <input id={`${id}-markup`} inputMode="decimal" className={INPUT} value={band.markup} placeholder="0" onChange={event => setBand(index, { markup: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${id}-fee`} className="mb-1 block text-xs font-medium text-gray-600">Dispensing fee (N$)</label>
                    <input id={`${id}-fee`} inputMode="decimal" className={INPUT} value={band.fee} placeholder="0.00" onChange={event => setBand(index, { fee: event.target.value })} />
                  </div>
                  <div className="col-span-2 flex justify-end sm:col-span-1">
                    {draft.bands.length > 1 && (
                      <button type="button" className={QUIET} onClick={() => removeBand(index)} aria-label={`Remove band ${index + 1}`}>
                        <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                        <span className="sm:sr-only">Remove</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {draft.bands.length < PRICE_RULE_LIMITS.maxBands && (
            <button type="button" className={`${SECONDARY} mt-2`} onClick={addBand}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Add a band
            </button>
          )}
        </fieldset>

        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm" aria-live="polite">
          {rule ? (
            <>
              <ul className="space-y-0.5 text-gray-700">
                {rule.bands.map((_, index) => <li key={index}>{describeBand(rule, index)}</li>)}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-gray-700">
                <label htmlFor="stock-try-cost">A line that costs N$</label>
                <input id="stock-try-cost" inputMode="decimal" className={`${INPUT} w-28`} value={tryCost} onChange={event => setTryCost(event.target.value)} />
                <span>
                  {example
                    ? <>sells for <strong>{nad(example.totalCents)}</strong> including VAT ({nad(example.markupCents)} markup, {nad(example.feeCents)} fee, {nad(example.vatCents)} VAT).</>
                    : 'Type a cost to see its price.'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-red-700" role="alert">{parsedRule.error}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">The fee is charged once per dispensed line and spread over its units, so the bill shows unit price times quantity.</p>
        </div>
      </SectionCard>

      <PricingRulesCards form={pricing} canEdit={canEdit} dispensing={draft.dispensingEnabled} vatRate={vatError ? null : settings.vatRegistered ? vat : 0} />

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" className={PRIMARY} onClick={() => void save()} disabled={saving}>
            <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {saving ? 'Saving' : 'Save settings'}
          </button>
        </div>
      )}

      {/* L10: saved store by store, apart from the settings above */}
      <StoresCard context={context} />
    </div>
  );
};

export default StockSettingsTab;
