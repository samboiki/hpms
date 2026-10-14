import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import type { ServiceSelection } from '../../types/billing';
import { formatNad, fromCents } from '../../utils/billing/money';
import { isValidFdiTooth } from '../../utils/billing/pricing';
import { MAX_AUTHORISATION_LENGTH, parseAuthorisationNumber } from '../../utils/billing/lineSplit';
import { parseOwnPrice } from '../../utils/billing/practiceTariffs';
import { useAuthStore } from '../../stores/authStore';
import { loadInvoicingSetup } from '../../services/invoicingSetup';
import type { VisitTariff } from '../visits/visitBillingLines';
import type { LineContext } from './billingLines';
import {
  BUNDLE_COLOUR_STYLES,
  amountsNeeded,
  applyBundles,
  bundleCodesSummary,
  describeApplication,
  isStockBundleLine,
  previewBundle,
  teethNeeded,
  type CodeBundle
} from './bundles';
import BundleManager from './BundleManager';
import { useBundles } from './useBundles';
import { useBundleStock } from './useBundleStock';
import { QuotesNotEnabled, inputClass, primaryButton, secondaryButton } from './QuoteBits';

interface BundleMenuProps {
  practiceId: string | null;
  practiceType?: string | null;
  /** Tariffs that may be billed on the service date (visit date or quote date) */
  tariffs: readonly VisitTariff[];
  /** The lines already on the visit or quote */
  lines: readonly ServiceSelection[];
  hasMedicalAid: boolean;
  /** Dental: 8109 once per visit and 8346 with restorations, as on the visit screens */
  autoInfectionControl?: boolean;
  /** 8109 quantity: the practice's clinical staff count (1-3) */
  infectionControlStaff?: number;
  /** On a visit: a bundle that needs the fund's authorisation number asks for it (a quote has its own pre-auth) */
  askAuthorisation?: boolean;
  onApply: (lines: ServiceSelection[]) => void;
  disabled?: boolean;
  disabledReason?: string;
}

type View = { name: 'pick' } | { name: 'details'; bundle: CodeBundle } | { name: 'manage' };

/** Whether the fund's authorisation number can be kept on the lines: null while it is being checked. */
type AuthorisationSetup = boolean | null;

/**
 * "Code bundles": adds a practice bundle to the visit or quote in one click, priced from the tariffs in
 * effect for it. Codes charged once per visit are not added again; teeth are asked for only when a code
 * needs one, and the fund's authorisation number only for a bundle that needs one (on a medical aid visit).
 * A code with no fixed amount in the price list (NAMAF: by rule, at cost, by arrangement) asks for its amount, as the
 * visit's "Add a service" and the quote editor do; it is never added at N$ 0.
 * A line's fixed ICD-10 code and fee come with it, stock items are priced as "From stock" lines are.
 * "Manage bundles" opens the practice's list and the starter suggestions.
 */
const BundleMenu: React.FC<BundleMenuProps> = ({
  practiceId,
  practiceType = null,
  tariffs,
  lines,
  hasMedicalAid,
  autoInfectionControl = true,
  infectionControlStaff,
  askAuthorisation = false,
  onApply,
  disabled = false,
  disabledReason
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: 'pick' });
  const [teeth, setTeeth] = useState<Record<string, string>>({});
  // The amount typed (as text) for each code with no fixed amount, by bundle line
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [authorisation, setAuthorisation] = useState('');
  const [authorisationSetup, setAuthorisationSetup] = useState<AuthorisationSetup>(null);
  const userId = useAuthStore(state => state.user?.id ?? null);
  const { state, reload } = useBundles(practiceId, open);
  const hasStockLines = state.status === 'ready' && state.bundles.some(bundle => bundle.lines.some(isStockBundleLine));
  const stock = useBundleStock(practiceId, open && hasStockLines, hasMedicalAid);
  const stockLine = stock.status === 'ready' ? stock.stockLine : undefined;
  const context: LineContext = useMemo(
    () => ({ tariffs, hasMedicalAid, autoInfectionControl, infectionControlStaff }),
    [tariffs, hasMedicalAid, autoInfectionControl, infectionControlStaff]
  );
  const noTariffs = tariffs.length === 0;
  const blocked = disabled || noTariffs || !practiceId;
  const title = disabled
    ? disabledReason
    : noTariffs
      ? 'The tariff list has not loaded yet, so bundles cannot be priced.'
      : 'Add a set of codes in one click';

  const needsAuthorisation = (bundle: CodeBundle) => askAuthorisation && hasMedicalAid && bundle.needsAuthorisation === true;

  // Whether the lines can keep an authorisation number is checked only when a bundle asks for one
  const detailsAskAuthorisation = view.name === 'details' && needsAuthorisation(view.bundle);
  useEffect(() => {
    if (!detailsAskAuthorisation || authorisationSetup !== null) return;
    let cancelled = false;
    void loadInvoicingSetup()
      .then(setup => {
        if (!cancelled) setAuthorisationSetup(setup.linePortions === true);
      })
      .catch(() => {
        if (!cancelled) setAuthorisationSetup(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailsAskAuthorisation, authorisationSetup]);

  const close = () => {
    setOpen(false);
    setView({ name: 'pick' });
    setTeeth({});
    setAmounts({});
    setAuthorisation('');
  };

  const apply = (bundle: CodeBundle, chosenTeeth: Record<string, string>, authorisationNumber: string | null, typedAmounts: Record<string, number> = {}) => {
    const result = applyBundles([bundle], lines, context, chosenTeeth, { stockLine, by: userId, at: new Date().toISOString(), authorisationNumber, amounts: typedAmounts });
    // A code left without an amount is reported like a line that cannot be added: it is never added at N$ 0
    const refused = [...result.problems, ...result.needsAmount];
    refused.forEach(problem => toast.error(problem.message, { id: `bundle-${bundle.id}-${problem.code}`, duration: 8000 }));
    if (result.added.length === 0) {
      if (refused.length === 0) toast(describeApplication(result, formatNad), { duration: 6000 });
      return;
    }
    onApply(result.lines);
    toast.success(`${bundle.name}: ${describeApplication(result, formatNad)}`, { duration: 6000 });
    result.warnings.forEach(warning => toast(warning, { duration: 8000 }));
    close();
  };

  const choose = (bundle: CodeBundle) => {
    if (teethNeeded([bundle], tariffs).length === 0 && amountsNeeded([bundle], tariffs).length === 0 && !needsAuthorisation(bundle)) {
      apply(bundle, {}, null);
      return;
    }
    setTeeth({});
    setAmounts({});
    setAuthorisation('');
    setView({ name: 'details', bundle });
  };

  const renderPick = () => {
    if (state.status === 'not_enabled') return <QuotesNotEnabled compact />;
    if (state.status === 'error') {
      return (
        <div className="space-y-3 text-center" role="alert">
          <p className="text-sm text-red-700">{state.message}</p>
          <button type="button" className={secondaryButton} onClick={reload}>
            Try again
          </button>
        </div>
      );
    }
    if (state.status !== 'ready') {
      return (
        <div className="space-y-2" role="status" aria-live="polite">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
          <span className="sr-only">Loading the code bundles</span>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {state.bundles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
            <Icon icon="solar:layers-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-gray-300" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-800">No code bundles yet</p>
            <p className="mt-1 text-xs text-gray-500">Create your practice's bundles once, then add them to any visit or quote in one click.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {state.bundles.map(bundle => {
              const preview = previewBundle(bundle, context, { stockLine });
              const stockWaiting = bundle.lines.some(isStockBundleLine) && stock.status === 'loading';
              return (
                <li key={bundle.id}>
                  <button
                    type="button"
                    onClick={() => choose(bundle)}
                    disabled={stockWaiting}
                    className={`w-full rounded-xl border p-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${BUNDLE_COLOUR_STYLES[bundle.colour].soft}`}
                  >
                    <span className="flex items-start gap-2">
                      <span className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${BUNDLE_COLOUR_STYLES[bundle.colour].dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">{bundle.name}</span>
                        <span className="block truncate text-xs text-gray-600">{bundleCodesSummary(bundle.lines)}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {preview.needsTooth && (
                            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-gray-700">Asks for a tooth</span>
                          )}
                          {preview.needsAmount && (
                            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-gray-700">Asks for an amount</span>
                          )}
                          {askAuthorisation && bundle.needsAuthorisation && (
                            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-gray-700">Needs an authorisation number</span>
                          )}
                          {!stockWaiting && preview.problems.length > 0 && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                              {preview.problems.length} code(s) cannot be billed
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {stockWaiting ? '...' : formatNad(fromCents(preview.totalCents))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {stock.status === 'unavailable' && hasStockLines && (
          <p className="text-xs text-amber-700" role="status">
            The stock list could not be read ({stock.message}), so bundle lines from stock cannot be added now.
          </p>
        )}
        <p className="text-xs text-gray-500">
          Prices are the practice's tariffs for this date, unless a bundle sets its own fee.
          {autoInfectionControl ? ' Codes charged once per visit (8109, 8110, 8145) are added only if the visit does not have them yet.' : ''}
        </p>
        <button type="button" className={secondaryButton} onClick={() => setView({ name: 'manage' })}>
          <Icon icon="solar:settings-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Manage bundles
        </button>
      </div>
    );
  };

  const renderDetails = (bundle: CodeBundle) => {
    const needs = teethNeeded([bundle], tariffs);
    const invalid = needs.filter(need => !isValidFdiTooth(teeth[need.key] ?? ''));
    const asksAuthorisation = needsAuthorisation(bundle);
    const parsedAuthorisation = parseAuthorisationNumber(authorisation);
    // The number is required once the lines can keep it; before the database update the bundle is added without it
    const authorisationRequired = asksAuthorisation && authorisationSetup === true;
    const authorisationMissing = authorisationRequired && (!parsedAuthorisation.ok || !parsedAuthorisation.value);
    const authorisationWrong = authorisation.trim() !== '' && !parsedAuthorisation.ok;
    // Codes with no fixed amount in the price list: an amount above N$ 0 must be typed for each before anything is added
    const amountNeeds = amountsNeeded([bundle], tariffs);
    const typedAmounts: Record<string, number> = {};
    amountNeeds.forEach(need => {
      const amount = parseOwnPrice(amounts[need.key] ?? '');
      if (amount !== null && amount > 0) typedAmounts[need.key] = amount;
    });
    const amountsMissing = amountNeeds.some(need => typedAmounts[need.key] === undefined);
    const question =
      amountNeeds.length === 0
        ? needs.length > 0 ? ': which tooth is each of these for?' : ': before the lines are added'
        : needs.length === 0 ? ': what is the amount for each of these?' : ': a few details are needed before the lines are added';
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{bundle.name}</span>
          {question}
        </p>
        {needs.map(need => {
          const value = teeth[need.key] ?? '';
          const wrong = value.trim() !== '' && !isValidFdiTooth(value);
          return (
            <label key={need.key} className="block">
              <span className="mb-1 block text-sm text-gray-800">
                <span className="font-semibold">{need.code}</span> {need.description}
              </span>
              <input
                className={`${inputClass} max-w-[8rem]`}
                inputMode="numeric"
                maxLength={2}
                value={value}
                placeholder="e.g. 36"
                aria-invalid={wrong}
                onChange={event => setTeeth(current => ({ ...current, [need.key]: event.target.value.trim() }))}
              />
              {wrong && <span className="mt-1 block text-xs text-red-600">Use an FDI tooth number: 11-48, or 51-85 for milk teeth.</span>}
            </label>
          );
        })}
        {amountNeeds.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              The price list has no fixed amount for {amountNeeds.length === 1 ? 'this code' : 'these codes'} (priced by rule, at cost or by arrangement). Type the amount for one unit.
            </p>
            {amountNeeds.map(need => {
              const value = amounts[need.key] ?? '';
              const wrong = value.trim() !== '' && typedAmounts[need.key] === undefined;
              return (
                <label key={need.key} className="block">
                  <span className="mb-1 block text-sm text-gray-800">
                    <span className="font-semibold">{need.code}</span> {need.description}
                  </span>
                  <input
                    className={`${inputClass} max-w-[10rem]`}
                    inputMode="decimal"
                    value={value}
                    placeholder="e.g. 450.00"
                    aria-label={`Amount per unit (N$) for ${need.code}`}
                    aria-invalid={wrong}
                    onChange={event => setAmounts(current => ({ ...current, [need.key]: event.target.value }))}
                  />
                  {wrong && <span className="mt-1 block text-xs text-red-600">Enter the amount in N$, such as 450 or 450.00.</span>}
                </label>
              );
            })}
          </div>
        )}
        {asksAuthorisation && (
          <label className="block">
            <span className="mb-1 block text-sm text-gray-800">
              <span className="font-semibold">Authorisation number</span> from the medical aid (it goes on every line of this bundle)
            </span>
            <input
              className={`${inputClass} max-w-[16rem]`}
              value={authorisation}
              maxLength={MAX_AUTHORISATION_LENGTH}
              placeholder="For example: 123456"
              aria-invalid={authorisationWrong}
              onChange={event => setAuthorisation(event.target.value)}
            />
            {authorisationWrong && !parsedAuthorisation.ok && <span className="mt-1 block text-xs text-red-600">{parsedAuthorisation.message}</span>}
            {authorisationSetup === false && (
              <span className="mt-1 block text-xs text-amber-700">
                Authorisation numbers can be kept on the lines once the line-portions database update is applied; the lines are added without it.
              </span>
            )}
          </label>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButton} onClick={() => setView({ name: 'pick' })}>
            Back
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={invalid.length > 0 || amountsMissing || authorisationMissing || (asksAuthorisation && authorisationSetup === null)}
            onClick={() => apply(bundle, teeth, authorisationRequired && parsedAuthorisation.ok ? parsedAuthorisation.value : null, typedAmounts)}
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add the lines
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={blocked}
        title={title}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon icon="solar:layers-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        Code bundles
      </button>
      <FormModal isOpen={open} onClose={close} title={view.name === 'manage' ? 'Manage code bundles' : 'Code bundles'} icon="solar:layers-bold-duotone" className="max-w-2xl">
        {view.name === 'pick' && renderPick()}
        {view.name === 'details' && renderDetails(view.bundle)}
        {view.name === 'manage' && practiceId && (
          <div className="space-y-4">
            <button type="button" className={secondaryButton} onClick={() => setView({ name: 'pick' })}>
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Back to the bundles
            </button>
            {state.status === 'ready' ? (
              <BundleManager practiceId={practiceId} practiceType={practiceType} tariffs={tariffs} bundles={state.bundles} onChanged={reload} />
            ) : (
              renderPick()
            )}
          </div>
        )}
      </FormModal>
    </>
  );
};

export default BundleMenu;
