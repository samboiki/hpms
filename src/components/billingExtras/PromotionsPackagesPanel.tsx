import React, { useCallback, useEffect, useId, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  endPromotion,
  loadPackageTypes,
  loadPromotions,
  savePackageType,
  savePromotion,
  type ExtrasLoad
} from '../../services/billing/billingExtrasService';
import { addDaysToKey, todayKey } from '../../utils/billing/dates';
import {
  describePackageType,
  draftFromPackageType,
  packageTypePayload,
  type PackageType,
  type PackageTypeDraft
} from '../../utils/billing/packages';
import {
  describePromotion,
  draftFromPromotion,
  promotionPayload,
  promotionState,
  type Promotion,
  type PromotionDraft,
  type PromotionState
} from '../../utils/billing/promotions';

interface PromotionsPackagesPanelProps {
  practiceId: string;
  /** Practice administrators change promotions and packages (the database checks the same) */
  canEdit: boolean;
}

// The look of the Tariffs page's panels (CopaymentPanel)
const SECTION = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6';
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50';
const SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50';
const LINK = 'rounded text-xs font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50';

const STATE_LABEL: Record<PromotionState, { text: string; className: string }> = {
  running: { text: 'Running', className: 'bg-emerald-50 text-emerald-700' },
  upcoming: { text: 'Starts later', className: 'bg-blue-50 text-blue-700' },
  over: { text: 'Over', className: 'bg-gray-100 text-gray-600' },
  ended: { text: 'Ended early', className: 'bg-gray-100 text-gray-600' }
};

const Heading: React.FC<{ id: string; icon: string; title: string; children?: React.ReactNode }> = ({ id, icon, title, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 id={id} className="flex items-center gap-2 text-lg font-semibold text-gray-900">
      <Icon icon={icon} className="h-5 w-5 text-[#01b9d4]" aria-hidden="true" />
      {title}
    </h2>
    {children}
  </div>
);

/**
 * Admin > Tariffs > Contracts and co-payments, under the co-payments (parity D18, D17): the practice's promotions (a percentage or an amount off
 * chosen codes between two days, applied on a private patient's bill and listed in Finance > Reports > Discounts given)
 * and the prepaid packages it sells (from the patient's Account tab; each visit that bills a covered code uses one).
 */
const PromotionsPackagesPanel: React.FC<PromotionsPackagesPanelProps> = ({ practiceId, canEdit }) => {
  const formId = useId();
  const today = todayKey();
  const [promotions, setPromotions] = useState<ExtrasLoad<Promotion[]> | null>(null);
  const [types, setTypes] = useState<ExtrasLoad<PackageType[]> | null>(null);
  const [promotionDraft, setPromotionDraft] = useState<PromotionDraft | null>(null);
  const [packageDraft, setPackageDraft] = useState<PackageTypeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ form: 'promotion' | 'package'; text: string } | null>(null);

  const reload = useCallback(() => {
    void loadPromotions(practiceId).then(setPromotions);
    void loadPackageTypes(practiceId).then(setTypes);
  }, [practiceId]);
  useEffect(reload, [reload]);

  const notSetUp = promotions?.status === 'not_set_up' || types?.status === 'not_set_up';

  const savePromotionDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promotionDraft) return;
    const built = promotionPayload(promotionDraft, practiceId);
    if (built.error !== null) {
      setProblem({ form: 'promotion', text: built.error });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await savePromotion(built.payload);
      toast.success(`Promotion "${built.payload.name}" saved`);
      setPromotionDraft(null);
      reload();
    } catch (error) {
      setProblem({ form: 'promotion', text: error instanceof Error ? plainWords(error.message) : 'The promotion could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const end = async (promotion: Promotion) => {
    if (!window.confirm(`End "${promotion.name}" now? Lines that already have it keep their discount; new lines get none.`)) return;
    try {
      await endPromotion(promotion.id);
      toast.success(`"${promotion.name}" has ended`);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The promotion could not be ended.');
    }
  };

  const savePackageDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!packageDraft) return;
    const built = packageTypePayload(packageDraft, practiceId);
    if (built.error !== null) {
      setProblem({ form: 'package', text: built.error });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await savePackageType(built.payload);
      toast.success(`Package "${built.payload.name}" saved`);
      setPackageDraft(null);
      reload();
    } catch (error) {
      setProblem({ form: 'package', text: error instanceof Error ? plainWords(error.message) : 'The package could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelling = async (type: PackageType) => {
    const built = packageTypePayload({ ...draftFromPackageType(type), isActive: !type.isActive }, practiceId);
    if (built.error !== null) return;
    try {
      await savePackageType(built.payload);
      toast.success(type.isActive ? `"${type.name}" is no longer sold. Packages already sold can still be used.` : `"${type.name}" is sold again.`);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The package could not be changed.');
    }
  };

  if (notSetUp) {
    return (
      <section className={SECTION}>
        <Heading id={`${formId}-heading`} icon="solar:sale-bold-duotone" title="Promotions and packages" />
        <p className="mt-2 text-sm text-gray-600">Promotions and prepaid packages are not set up in this database yet.</p>
      </section>
    );
  }

  const promotionList = promotions?.status === 'ready' ? promotions.data : [];
  const typeList = types?.status === 'ready' ? types.data : [];

  return (
    <div className="space-y-6">
      <section className={SECTION} aria-labelledby={`${formId}-promotions`}>
        <Heading id={`${formId}-promotions`} icon="solar:sale-bold-duotone" title="Promotions">
          {canEdit && !promotionDraft && (
            <button type="button" className={PRIMARY} onClick={() => { setProblem(null); setPromotionDraft(draftFromPromotion(null, today, addDaysToKey(today, 30))); }}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              New promotion
            </button>
          )}
        </Heading>
        <p className="mt-1 text-sm text-gray-600">
          A percentage or an amount off chosen codes between two days. On a private patient&apos;s bill it comes off the line by itself, named, and
          Finance &gt; Reports &gt; Discounts given lists it. A medical aid line is claimed at the agreed price, so it gets no promotion.
        </p>

        {promotionDraft && (
          <form onSubmit={event => void savePromotionDraft(event)} className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" noValidate>
            <label className="block lg:col-span-2">
              <span className={labelClass}>Name</span>
              <input className={inputClass} maxLength={60} value={promotionDraft.name} onChange={event => setPromotionDraft({ ...promotionDraft, name: event.target.value })} placeholder="Spring smile" />
            </label>
            <label className="block">
              <span className={labelClass}>Takes off</span>
              <select className={inputClass} value={promotionDraft.kind} onChange={event => setPromotionDraft({ ...promotionDraft, kind: event.target.value === 'amount' ? 'amount' : 'percent' })}>
                <option value="percent">A percentage</option>
                <option value="amount">An amount each</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{promotionDraft.kind === 'percent' ? 'Percentage' : 'Amount (N$)'}</span>
              <input className={inputClass} inputMode="decimal" value={promotionDraft.value} onChange={event => setPromotionDraft({ ...promotionDraft, value: event.target.value })} placeholder={promotionDraft.kind === 'percent' ? '10' : '50.00'} />
            </label>
            <label className="block lg:col-span-2">
              <span className={labelClass}>Codes</span>
              <input className={inputClass} value={promotionDraft.codes} onChange={event => setPromotionDraft({ ...promotionDraft, codes: event.target.value })} placeholder="8261, 8262" />
            </label>
            <label className="block lg:col-span-2">
              <span className={labelClass}>First day</span>
              <input type="date" className={inputClass} value={promotionDraft.startsOn} onChange={event => setPromotionDraft({ ...promotionDraft, startsOn: event.target.value })} />
            </label>
            <label className="block lg:col-span-2">
              <span className={labelClass}>Last day</span>
              <input type="date" className={inputClass} min={promotionDraft.startsOn || undefined} value={promotionDraft.endsOn} onChange={event => setPromotionDraft({ ...promotionDraft, endsOn: event.target.value })} />
            </label>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-2">
              <button type="button" className={SECONDARY} onClick={() => { setPromotionDraft(null); setProblem(null); }} disabled={saving}>Cancel</button>
              <button type="submit" className={PRIMARY} disabled={saving}>{saving ? 'Saving...' : 'Save promotion'}</button>
            </div>
            {problem?.form === 'promotion' && <p className="text-xs text-red-700 sm:col-span-2 lg:col-span-6" role="alert">{problem.text}</p>}
          </form>
        )}

        {promotions === null ? (
          <p className="mt-4 text-sm text-gray-500" role="status">Loading the promotions...</p>
        ) : promotions.status === 'error' ? (
          <p className="mt-4 text-sm text-red-700" role="alert">The promotions could not be loaded: {promotions.message}</p>
        ) : promotionList.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No promotions.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {promotionList.map(promotion => {
              const state = promotionState(promotion, today);
              return (
                <li key={promotion.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-gray-900">{promotion.name}</span>
                    <span className="block text-gray-600">{describePromotion(promotion)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_LABEL[state].className}`}>{STATE_LABEL[state].text}</span>
                    {canEdit && state !== 'ended' && state !== 'over' && (
                      <>
                        <button type="button" className={LINK} onClick={() => { setProblem(null); setPromotionDraft(draftFromPromotion(promotion, today, promotion.endsOn)); }}>Change</button>
                        <button type="button" className={LINK} onClick={() => void end(promotion)}>End now</button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!canEdit && <p className="mt-3 text-xs text-gray-500">Only a practice administrator can change promotions.</p>}
      </section>

      <section className={SECTION} aria-labelledby={`${formId}-packages`}>
        <Heading id={`${formId}-packages`} icon="solar:ticket-bold-duotone" title="Prepaid packages">
          {canEdit && !packageDraft && (
            <button type="button" className={PRIMARY} onClick={() => { setProblem(null); setPackageDraft(draftFromPackageType(null)); }}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              New package
            </button>
          )}
        </Heading>
        <p className="mt-1 text-sm text-gray-600">
          Sessions a patient pays for up front, sold on the patient&apos;s Account tab on their own invoice. A visit that bills a covered code is paid
          from the package; what is left and until when shows on the patient file and at billing.
        </p>

        {packageDraft && (
          <form onSubmit={event => void savePackageDraft(event)} className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" noValidate>
            <label className="block lg:col-span-2">
              <span className={labelClass}>Name</span>
              <input className={inputClass} maxLength={60} value={packageDraft.name} onChange={event => setPackageDraft({ ...packageDraft, name: event.target.value })} placeholder="10 physio sessions" />
            </label>
            <label className="block lg:col-span-2">
              <span className={labelClass}>Codes a session covers</span>
              <input className={inputClass} value={packageDraft.codes} onChange={event => setPackageDraft({ ...packageDraft, codes: event.target.value })} placeholder="0190" />
            </label>
            <label className="block">
              <span className={labelClass}>Sessions</span>
              <input className={inputClass} inputMode="numeric" value={packageDraft.sessions} onChange={event => setPackageDraft({ ...packageDraft, sessions: event.target.value })} />
            </label>
            <label className="block">
              <span className={labelClass}>Price (N$)</span>
              <input className={inputClass} inputMode="decimal" value={packageDraft.price} onChange={event => setPackageDraft({ ...packageDraft, price: event.target.value })} placeholder="4500.00" />
            </label>
            <label className="block">
              <span className={labelClass}>Valid (months)</span>
              <input className={inputClass} inputMode="numeric" value={packageDraft.validMonths} onChange={event => setPackageDraft({ ...packageDraft, validMonths: event.target.value })} />
            </label>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-5">
              <button type="button" className={SECONDARY} onClick={() => { setPackageDraft(null); setProblem(null); }} disabled={saving}>Cancel</button>
              <button type="submit" className={PRIMARY} disabled={saving}>{saving ? 'Saving...' : 'Save package'}</button>
            </div>
            {problem?.form === 'package' && <p className="text-xs text-red-700 sm:col-span-2 lg:col-span-6" role="alert">{problem.text}</p>}
          </form>
        )}

        {types === null ? (
          <p className="mt-4 text-sm text-gray-500" role="status">Loading the packages...</p>
        ) : types.status === 'error' ? (
          <p className="mt-4 text-sm text-red-700" role="alert">The packages could not be loaded: {types.message}</p>
        ) : typeList.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No packages.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {typeList.map(type => (
              <li key={type.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${type.isActive ? '' : 'text-gray-400'}`}>
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{type.name}</span>
                  <span className="block text-gray-600">{describePackageType(type)}</span>
                </span>
                <span className="flex items-center gap-3">
                  {!type.isActive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Not sold</span>}
                  {canEdit && (
                    <>
                      <button type="button" className={LINK} onClick={() => { setProblem(null); setPackageDraft(draftFromPackageType(type)); }}>Change</button>
                      <button type="button" className={LINK} onClick={() => void toggleSelling(type)}>{type.isActive ? 'Stop selling' : 'Sell again'}</button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!canEdit && <p className="mt-3 text-xs text-gray-500">Only a practice administrator can change the packages.</p>}
      </section>
    </div>
  );
};

export default PromotionsPackagesPanel;
