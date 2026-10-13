import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { invoiceLink } from '../billing/invoiceLinks';
import {
  cancelPackage,
  loadPatientPackages,
  loadPatientPlans,
  postDueInstalments,
  stopPaymentPlan,
  type PatientPlans
} from '../../services/billing/billingExtrasService';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { canRaiseInvoices } from '../../utils/billing/invoiceRights';
import { formatCodeList } from '../../utils/billing/codeList';
import { describePackageBalance, packageState, type PackageState, type PatientPackage } from '../../utils/billing/packages';
import { describePosting, planProgress, type PaymentPlan, type PlanState } from '../../utils/billing/paymentPlans';
import PaymentPlanSheet from './PaymentPlanSheet';
import SellPackageSheet from './SellPackageSheet';

interface PatientPlansPanelProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  /** Invoices were added (instalments posted, a package sold): the invoice list reloads */
  onInvoicesChanged?: () => void;
}

// The look of the other sections of the patient's Billing tab (PatientClaimRegisters)
const PRIMARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
const LINK = 'font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded disabled:opacity-50';
const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';

const PLAN_CHIP: Record<PlanState, { label: string; className: string; icon: string }> = {
  active: { label: 'Running', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone' },
  completed: { label: 'All posted', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:check-read-bold-duotone' },
  stopped: { label: 'Stopped', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: 'solar:stop-circle-bold-duotone' }
};

const PACKAGE_CHIP: Record<PackageState, { label: string; className: string; icon: string }> = {
  active: { label: 'In use', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone' },
  used_up: { label: 'Used up', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:check-read-bold-duotone' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200', icon: 'solar:clock-circle-bold-duotone' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:close-circle-bold-duotone' }
};

const Chip: React.FC<{ className: string; icon: string; children: React.ReactNode }> = ({ className, icon, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}>
    <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
    {children}
  </span>
);

const SectionHeader: React.FC<{ icon: string; title: string; subtitle: string; children?: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-50 text-cyan-700">
        <Icon icon={icon} className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>
);

/** A reason typed under a list entry before it is stopped or cancelled */
const ReasonForm: React.FC<{ label: string; action: string; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }> = ({ label, action, busy, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');
  const fieldId = useId();
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        onConfirm(reason);
      }}
    >
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
        <input id={fieldId} className={INPUT} maxLength={200} value={reason} onChange={event => setReason(event.target.value)} autoFocus disabled={busy} />
      </div>
      <button type="submit" className={LINK} disabled={busy || reason.trim().length < 3}>{busy ? 'Saving...' : action}</button>
      <button type="button" className={LINK} onClick={onCancel} disabled={busy}>Keep it</button>
    </form>
  );
};

type Loaded<T> = { status: 'loading' } | { status: 'not_set_up' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/**
 * Payment plans and prepaid packages on the patient's Billing tab (parity D16, D17). Opening the tab posts the plans'
 * instalments that are due (there is no scheduler: Finance > Overview has "Post due instalments" for the whole
 * practice); a plan is agreed and a package sold from here; each posted instalment and each sale opens its invoice.
 */
const PatientPlansPanel: React.FC<PatientPlansPanelProps> = ({ practiceId, patientId, patientName, onInvoicesChanged }) => {
  const user = useAuthStore(state => state.user);
  const canBill = canRaiseInvoices(user);
  const canCancelPackages = user?.role === 'admin' || user?.role === 'doctor';
  const [plans, setPlans] = useState<Loaded<PatientPlans>>({ status: 'loading' });
  const [packages, setPackages] = useState<Loaded<PatientPackage[]>>({ status: 'loading' });
  const [sheet, setSheet] = useState<'plan' | 'package' | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();
  // Posted once per patient opened: the posting is safe to repeat (the database posts each instalment once)
  const postedFor = useRef<string | null>(null);
  const invoicesChanged = useRef(onInvoicesChanged);
  useEffect(() => {
    invoicesChanged.current = onInvoicesChanged;
  }, [onInvoicesChanged]);

  const reload = useCallback(async () => {
    const [planLoad, packageLoad] = await Promise.all([loadPatientPlans(patientId), loadPatientPackages(patientId)]);
    setPlans(planLoad.status === 'ready' ? { status: 'ready', data: planLoad.data } : planLoad);
    setPackages(packageLoad.status === 'ready' ? { status: 'ready', data: packageLoad.data } : packageLoad);
  }, [patientId]);

  const postDue = useCallback(async () => {
    try {
      const result = await postDueInstalments(practiceId, patientId);
      const said = describePosting(result);
      if (said) setNotice(said);
      if (result.posted > 0) invoicesChanged.current?.();
    } catch (failure) {
      setError(failure instanceof Error ? plainWords(failure.message) : 'The due instalments could not be posted.');
    }
  }, [practiceId, patientId]);

  useEffect(() => {
    let live = true;
    const run = async () => {
      if (canBill && postedFor.current !== patientId) {
        postedFor.current = patientId;
        const first = await loadPatientPlans(patientId);
        // Only a patient with a running plan has anything to post
        if (first.status === 'ready' && first.data.plans.some(plan => planProgress(plan, today).dueNow.length > 0)) await postDue();
      }
      if (live) await reload();
    };
    void run();
    return () => {
      live = false;
    };
  }, [patientId, canBill, today, postDue, reload]);

  const stopPlan = async (plan: PaymentPlan, reason: string) => {
    setBusyId(plan.id);
    setError(null);
    try {
      await stopPaymentPlan(plan.id, reason.trim());
      setNotice(`"${plan.title}" is stopped: no more instalments go on the account. Those already posted stay.`);
      setStopping(null);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? plainWords(failure.message) : 'The plan could not be stopped.');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (pack: PatientPackage, reason: string) => {
    setBusyId(pack.id);
    setError(null);
    try {
      await cancelPackage(pack.id, reason.trim());
      setNotice(`"${pack.name}" is cancelled: no more sessions can be used from it. Credit its invoice in Finance if money goes back.`);
      setStopping(null);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? plainWords(failure.message) : 'The package could not be cancelled.');
    } finally {
      setBusyId(null);
    }
  };

  if (plans.status === 'not_set_up' || packages.status === 'not_set_up') {
    return (
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader icon="solar:wallet-money-bold-duotone" title="Payment plans and packages" subtitle="Instalments agreed with the patient, and sessions paid up front." />
        <p className="px-4 py-4 text-sm text-gray-600">Payment plans and prepaid packages are not set up in this database yet.</p>
      </section>
    );
  }

  const planList = plans.status === 'ready' ? plans.data.plans : [];
  const invoiceNumbers = plans.status === 'ready' ? plans.data.invoiceNumbers : {};
  const packageList = packages.status === 'ready' ? packages.data : [];

  return (
    <div className="space-y-6">
      {(notice || error) && (
        <div className={`flex items-start justify-between gap-3 p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`} role={error ? 'alert' : 'status'}>
          <span className="flex items-start gap-2">
            <Icon icon={error ? 'solar:danger-triangle-bold-duotone' : 'solar:check-circle-bold-duotone'} className="mt-0.5 w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {error ?? notice}
          </span>
          <button type="button" onClick={() => { setNotice(null); setError(null); }} className="font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Payment plans (D16) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader
          icon="solar:wallet-money-bold-duotone"
          title="Payment plans"
          subtitle="A total agreed with the patient, paid in instalments. An instalment goes on the account on its date when this tab is opened, or with Post due instalments in Finance > Overview: there is no overnight run yet."
        >
          {canBill && (
            <button type="button" className={PRIMARY} onClick={() => setSheet('plan')} disabled={plans.status !== 'ready'}>
              <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              New payment plan
            </button>
          )}
        </SectionHeader>
        <div className="p-4">
          {plans.status === 'loading' ? (
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" role="status" aria-label="Loading payment plans" />
          ) : plans.status === 'error' ? (
            <p className="text-sm text-red-700" role="alert">{plans.message}</p>
          ) : planList.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No payment plans. Agree one when the patient pays a treatment off over months.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {planList.map(plan => {
                const progress = planProgress(plan, today);
                const chip = PLAN_CHIP[progress.state];
                const expanded = openPlan === plan.id;
                return (
                  <li key={plan.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 break-words">{plan.title}</p>
                        <p className="mt-0.5 text-sm text-gray-700">
                          {formatNad(fromCents(plan.totalCents))}: {progress.postedCount} of {progress.count} posted ({formatNad(fromCents(progress.postedCents))})
                          {progress.state === 'active' && progress.next ? `. Next ${formatNad(fromCents(progress.next.amountCents))} on ${formatServiceDate(progress.next.dueOn)}` : ''}
                          {progress.state === 'stopped' && plan.stopReason ? `. Stopped: ${plan.stopReason}` : ''}
                        </p>
                        {plan.notes && <p className="mt-0.5 text-xs text-gray-500 break-words">{plan.notes}</p>}
                      </div>
                      <Chip className={chip.className} icon={chip.icon}>{chip.label}</Chip>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <button type="button" className={LINK} onClick={() => setOpenPlan(expanded ? null : plan.id)} aria-expanded={expanded}>
                        {expanded ? 'Hide the instalments' : 'Show the instalments'}
                      </button>
                      {canBill && progress.state === 'active' && stopping !== plan.id && (
                        <button type="button" className={LINK} onClick={() => setStopping(plan.id)} disabled={busyId === plan.id}>Stop the plan</button>
                      )}
                    </div>
                    {stopping === plan.id && (
                      <ReasonForm label="Why is the plan stopped?" action="Stop the plan" busy={busyId === plan.id} onCancel={() => setStopping(null)} onConfirm={reason => void stopPlan(plan, reason)} />
                    )}
                    {expanded && (
                      <ol className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
                        {plan.instalments.map(item => (
                          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                            <span className="text-gray-700">{item.number}. {formatServiceDate(item.dueOn)}</span>
                            <span className="flex flex-wrap items-center gap-3">
                              <span className="tabular-nums text-gray-900">{formatNad(fromCents(item.amountCents))}</span>
                              {item.postedOn && item.invoiceId ? (
                                <Link to={invoiceLink(item.invoiceId)} className={LINK} title="Open the invoice">
                                  {invoiceNumbers[item.invoiceId] || 'Invoice'}{item.postedOn !== item.dueOn ? `, dated ${formatServiceDate(item.postedOn)}` : ''}
                                </Link>
                              ) : item.postedOn ? (
                                <span className="text-gray-500">Posted</span>
                              ) : progress.state === 'stopped' ? (
                                <span className="text-gray-400">Not posted</span>
                              ) : item.dueOn <= today ? (
                                <span className="text-amber-700">Due: posts when this tab is opened</span>
                              ) : (
                                <span className="text-gray-500">To come</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Prepaid packages (D17) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader
          icon="solar:ticket-bold-duotone"
          title="Prepaid packages"
          subtitle="Sessions paid up front. A visit billing a code the package covers is paid from it by itself."
        >
          {canBill && (
            <button type="button" className={PRIMARY} onClick={() => setSheet('package')} disabled={packages.status !== 'ready'}>
              <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              Sell a package
            </button>
          )}
        </SectionHeader>
        <div className="p-4">
          {packages.status === 'loading' ? (
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" role="status" aria-label="Loading prepaid packages" />
          ) : packages.status === 'error' ? (
            <p className="text-sm text-red-700" role="alert">{packages.message}</p>
          ) : packageList.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No packages. Sell one when the patient pays for several sessions up front.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {packageList.map(pack => {
                const state = packageState(pack, today);
                const chip = PACKAGE_CHIP[state];
                return (
                  <li key={pack.id} className={`py-3 ${state === 'cancelled' ? 'text-gray-400' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 break-words">{pack.name}</p>
                        <p className="mt-0.5 text-sm text-gray-700">{describePackageBalance(pack, today)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Covers {formatCodeList(pack.codes)}. Sold on {formatServiceDate(pack.soldOn)} for {formatNad(fromCents(pack.priceCents))}
                          {pack.saleInvoiceId && (
                            <>
                              {' on '}
                              <Link to={invoiceLink(pack.saleInvoiceId)} className={LINK}>{pack.saleInvoiceNumber || 'its invoice'}</Link>
                            </>
                          )}
                        </p>
                      </div>
                      <Chip className={chip.className} icon={chip.icon}>{chip.label}</Chip>
                    </div>
                    {canCancelPackages && state !== 'cancelled' && stopping !== pack.id && (
                      <div className="mt-2 text-sm">
                        <button type="button" className={LINK} onClick={() => setStopping(pack.id)} disabled={busyId === pack.id}>Cancel the package</button>
                      </div>
                    )}
                    {stopping === pack.id && (
                      <ReasonForm label="Why is the package cancelled?" action="Cancel the package" busy={busyId === pack.id} onCancel={() => setStopping(null)} onConfirm={reason => void cancel(pack, reason)} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {sheet === 'plan' && (
        <PaymentPlanSheet
          practiceId={practiceId}
          patientId={patientId}
          patientName={patientName}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            setNotice('The payment plan is agreed.');
            // An instalment due today or earlier goes on the account straight away
            void postDue().then(reload);
          }}
        />
      )}
      {sheet === 'package' && (
        <SellPackageSheet
          practiceId={practiceId}
          patientId={patientId}
          patientName={patientName}
          onClose={() => setSheet(null)}
          onSold={(sold, type) => {
            setSheet(null);
            setNotice(`${type.name} sold on invoice ${sold.invoiceNumber ?? ''} (${formatNad(fromCents(type.priceCents))}), valid until ${formatServiceDate(sold.expiresOn)}. Take the payment with Receive payment.`);
            invoicesChanged.current?.();
            void reload();
          }}
        />
      )}
    </div>
  );
};

export default PatientPlansPanel;
