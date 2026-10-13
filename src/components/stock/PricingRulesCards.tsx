import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { SectionCard } from '../finance/FinanceUI';
import { savePricingRules } from '../../services/stock/pricingRulesService';
import { toCents } from '../../utils/billing/money';
import { parseAmountText } from '../../utils/stock/items';
import {
  MEDICINE_TIERS,
  NAMAF_RULE_013_2025,
  NO_PRICING_RULES,
  TIER_LABELS,
  materialDraftFrom,
  priceItemLine,
  pricingDraftFrom,
  pricingRulesFromDraft,
  sameRules,
  type MedicineTier,
  type PricingDraft,
  type PricingRules,
  type TierDraft
} from '../../utils/stock/pricingRules';
import type { StockSettings } from '../../utils/stock/stockRows';
import { INPUT, SECONDARY, STOCK_COLOR, nad } from './stockUi';

export interface PricingRulesForm {
  draft: PricingDraft;
  setDraft: React.Dispatch<React.SetStateAction<PricingDraft>>;
  /** What to fix before saving; null when the form describes a rule */
  problem: string | null;
  rules: PricingRules | null;
  /** The form differs from what is saved */
  changed: boolean;
  save: () => Promise<void>;
  /** False before proposals/2026-10-13-billing-extras.sql: the cards say so and cannot be changed */
  setUp: boolean;
  readable: boolean;
}

/** The tiers and the material rule as Stock > Settings edits them; saved with the page's one Save button */
export function usePricingRulesForm(settings: StockSettings, practiceId: string): PricingRulesForm {
  const saved = settings.pricing ?? NO_PRICING_RULES;
  const [draft, setDraft] = useState<PricingDraft>(() => pricingDraftFrom(saved));
  useEffect(() => setDraft(pricingDraftFrom(saved)), [saved]);
  const parsed = useMemo(() => pricingRulesFromDraft(draft), [draft]);
  const changed = parsed.rules !== null && !sameRules(parsed.rules, saved);
  return {
    draft,
    setDraft,
    problem: parsed.error,
    rules: parsed.rules,
    changed,
    save: async () => {
      if (parsed.rules && changed) await savePricingRules(practiceId, parsed.rules);
    },
    setUp: settings.pricingSetUp === true,
    readable: settings.pricingReadable !== false
  };
}

const TIER_HELP: Readonly<Record<MedicineTier, string>> = {
  medical_aid: 'Patients whose file has a medical aid.',
  private: 'Patients without a medical aid.',
  staff: 'Chosen when the medicine is added to a bill.'
};

const LABEL_SMALL = 'mb-1 block text-xs font-medium text-gray-600';

interface PricingRulesCardsProps {
  form: PricingRulesForm;
  canEdit: boolean;
  /** The practice dispenses medicine: the tiers are shown */
  dispensing: boolean;
  /** The VAT rate on the form, for the example; null while it is not a number */
  vatRate: number | null;
}

/**
 * Two cards under Selling prices (parity E7, D29): medicine price tiers for a dispensing practice, and materials at cost
 * plus a handling fee (NAMAF rule 013). Each is off until the practice switches it on, so nothing prices differently
 * before then; the page's Save button saves them with the other settings.
 */
export const PricingRulesCards: React.FC<PricingRulesCardsProps> = ({ form, canEdit, dispensing, vatRate }) => {
  const { draft, setDraft } = form;
  const [tryCost, setTryCost] = useState('100');
  const editable = canEdit && form.setUp;
  const setTier = (key: MedicineTier, patch: Partial<TierDraft>) =>
    setDraft(current => ({ ...current, tiers: { ...current.tiers, [key]: { ...current.tiers[key], ...patch } } }));
  const setMaterial = (patch: Partial<PricingDraft['material']>) => setDraft(current => ({ ...current, material: { ...current.material, ...patch } }));
  const fillNamaf = () => setDraft(current => ({ ...current, material: materialDraftFrom(NAMAF_RULE_013_2025, true) }));

  const material = form.rules?.material ?? null;
  const tryCents = parseAmountText(tryCost);
  const example = material && vatRate !== null && tryCents !== null && tryCents > 0
    ? priceItemLine({ kind: 'material', quantity: 1, lineCostCents: toCents(tryCents), vatRate, bands: { bands: [] }, rules: { tiers: {}, material }, fixedUnitPriceCents: null })
    : null;

  const notSetUp = !form.setUp && (
    <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600" role="note">
      Not set up in this database yet: every item is priced by the bands above.
    </p>
  );

  return (
    <>
      {!form.readable && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          A saved price tier or the material rule could not be read, so items are priced by the bands until it is saved again.
        </p>
      )}

      {dispensing && (
        <SectionCard title="Medicine price tiers" subtitle="A different markup and dispensing fee for some patients. A group that is off pays the bands above." icon="solar:pills-3-bold-duotone" tone={STOCK_COLOR.tone}>
          <fieldset disabled={!editable}>
            <legend className="sr-only">Medicine price tiers</legend>
            <ol className="space-y-2">
              {MEDICINE_TIERS.map(key => {
                const tier = draft.tiers[key];
                const id = `stock-tier-${key}`;
                return (
                  <li key={key} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                    <label className="col-span-2 flex items-start gap-3 sm:col-span-1">
                      <input
                        type="checkbox"
                        checked={tier.on}
                        onChange={event => setTier(key, { on: event.target.checked })}
                        aria-describedby={`${id}-help`}
                        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{TIER_LABELS[key]}</span>
                        <span id={`${id}-help`} className="block text-xs text-gray-500">{TIER_HELP[key]}</span>
                      </span>
                    </label>
                    <div>
                      <label htmlFor={`${id}-markup`} className={LABEL_SMALL}>Markup (%)</label>
                      <input id={`${id}-markup`} inputMode="decimal" className={INPUT} value={tier.markup} placeholder="0" disabled={!editable || !tier.on} onChange={event => setTier(key, { markup: event.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`${id}-fee`} className={LABEL_SMALL}>Dispensing fee (N$)</label>
                      <input id={`${id}-fee`} inputMode="decimal" className={INPUT} value={tier.fee} placeholder="0.00" disabled={!editable || !tier.on} onChange={event => setTier(key, { fee: event.target.value })} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
          <p className="mt-3 text-xs text-gray-500">
            A tier is cost + its markup + its dispensing fee per line, then VAT. Items with their own selling price keep it. A medicine&apos;s fund reference
            price is kept on the medicine (Stock &gt; Items &gt; the medicine): a medical aid patient is billed at most that.
          </p>
          {notSetUp}
        </SectionCard>
      )}

      <SectionCard title="Materials" subtitle="NAMAF rule 013: materials at cost plus a handling fee. Off: materials are priced by the bands above." icon="solar:box-bold-duotone" tone={STOCK_COLOR.tone}>
        <fieldset disabled={!editable}>
          <legend className="sr-only">Materials at cost plus a handling fee</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              role="switch"
              checked={draft.material.on}
              onChange={event => setMaterial({ on: event.target.checked })}
              aria-describedby="stock-material-help"
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">Price materials at cost plus a handling fee</span>
              <span id="stock-material-help" className="block text-sm text-gray-500">
                Every stock item that is not a medicine (it is claimed under 0201 with its NAPPI code). Items with their own selling price keep it.
              </span>
            </span>
          </label>
          {draft.material.on && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="stock-material-lower" className={LABEL_SMALL}>Handling fee up to the limit (%)</label>
                  <input id="stock-material-lower" inputMode="decimal" className={INPUT} value={draft.material.lower} placeholder="35" onChange={event => setMaterial({ lower: event.target.value })} />
                </div>
                <div>
                  <label htmlFor="stock-material-limit" className={LABEL_SMALL}>Cost limit (N$)</label>
                  <input id="stock-material-limit" inputMode="decimal" className={INPUT} value={draft.material.threshold} placeholder="4240.20" onChange={event => setMaterial({ threshold: event.target.value })} />
                </div>
                <div>
                  <label htmlFor="stock-material-upper" className={LABEL_SMALL}>Handling fee above the limit (%)</label>
                  <input id="stock-material-upper" inputMode="decimal" className={INPUT} value={draft.material.upper} placeholder="10" onChange={event => setMaterial({ upper: event.target.value })} />
                </div>
                <div>
                  <label htmlFor="stock-material-max" className={LABEL_SMALL}>Largest handling fee (N$)</label>
                  <input id="stock-material-max" inputMode="decimal" className={INPUT} value={draft.material.maxFee} placeholder="No limit" onChange={event => setMaterial({ maxFee: event.target.value })} />
                </div>
              </div>
              {/* The figures are rule 013 as the 2025 dental schedule words it: named so, for a practice of any discipline */}
              <button type="button" className={SECONDARY} onClick={fillNamaf}>
                <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Fill in the NAMAF 2025 dental figures
              </button>
            </div>
          )}
        </fieldset>
        {draft.material.on && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm" aria-live="polite">
            {material ? (
              <div className="flex flex-wrap items-center gap-2 text-gray-700">
                <label htmlFor="stock-material-try">A material that costs N$</label>
                <input id="stock-material-try" inputMode="decimal" className={`${INPUT} w-28`} value={tryCost} onChange={event => setTryCost(event.target.value)} />
                <span>
                  {example
                    ? <>sells for <strong>{nad(example.totalCents)}</strong> including VAT ({nad(example.feeCents)} handling fee, {nad(example.vatCents)} VAT).</>
                    : 'Type a cost to see its price.'}
                </span>
              </div>
            ) : (
              <p className="text-gray-600">Fill in the figures to see what a material sells for.</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              The fee is a percentage of the cost up to the limit plus another of the cost above it, never more than the largest fee. NAMAF changes
              the figures each year: check them against the current schedule.
            </p>
          </div>
        )}
        {notSetUp}
      </SectionCard>
      {form.problem && (
        <p className="text-sm text-red-700" role="alert">{form.problem}</p>
      )}
    </>
  );
};

export default PricingRulesCards;
