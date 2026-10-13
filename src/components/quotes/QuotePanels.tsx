import React, { useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import FormModal from '../modals/FormModal';
import { SectionCard } from '../finance/FinanceUI';
import { todayKey } from '../../utils/billing/dates';
import type { VisitTariff } from '../visits/visitBillingLines';
import BundleManager from './BundleManager';
import QuoteList from './QuoteList';
import type { QuotePatient } from './QuoteEditor';
import { billableOn, loadTariffSet } from './quoteService';
import { useBundles } from './useBundles';
import { QuotesNotEnabled, secondaryButton } from './QuoteBits';

/** Patient file > Billing: this patient's quotes and "New quote". */
export const PatientQuotesPanel: React.FC<{ practiceId: string | null | undefined; patient: QuotePatient | null }> = ({ practiceId, patient }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4" aria-label="Quotes">
    <div className="mb-3 flex items-center gap-3">
      <div className="flex-shrink-0 rounded-lg bg-cyan-100 p-2.5 text-cyan-600">
        <Icon icon="solar:bill-list-bold-duotone" className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">Quotes</h3>
        <p className="text-xs text-gray-500">Treatment estimates with the medical aid and patient portions</p>
      </div>
    </div>
    {patient ? <QuoteList practiceId={practiceId ?? null} patient={patient} /> : <p className="text-sm text-gray-500">Open a patient to see their quotes.</p>}
  </section>
);

type TariffState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; practiceType: string | null; tariffs: VisitTariff[] };

/** "Code bundles" from Finance: the practice's bundles and the starter suggestions, checked against today's tariffs. */
const BundleManagerModal: React.FC<{ practiceId: string; isOpen: boolean; onClose: () => void }> = ({ practiceId, isOpen, onClose }) => {
  const { state, reload } = useBundles(practiceId, isOpen);
  const [tariffs, setTariffs] = useState<TariffState>({ status: 'loading' });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadTariffSet(practiceId)
      .then(set => {
        if (!cancelled) setTariffs({ status: 'ready', practiceType: set.practiceType, tariffs: billableOn(set, todayKey()) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setTariffs({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the tariff list.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, isOpen]);

  let body: React.ReactNode;
  if (state.status === 'not_enabled') body = <QuotesNotEnabled compact />;
  else if (state.status === 'error') body = <p className="text-sm text-red-700" role="alert">{state.message}</p>;
  else if (tariffs.status === 'error') body = <p className="text-sm text-red-700" role="alert">{tariffs.message}</p>;
  else if (state.status !== 'ready' || tariffs.status !== 'ready') body = <p className="text-sm text-gray-500" role="status">Loading the bundles and the tariff list...</p>;
  else body = <BundleManager practiceId={practiceId} practiceType={tariffs.practiceType} tariffs={tariffs.tariffs} bundles={state.bundles} onChanged={reload} />;

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Manage code bundles" icon="solar:layers-bold-duotone" className="max-w-2xl">
      {body}
    </FormModal>
  );
};

/**
 * Finance > Quotes: every quote of the practice, what is accepted but not invoiced, and the code bundles. onChanged:
 * a quote was made into an invoice (or otherwise changed), so Finance reloads its figures.
 */
export const QuotesTab: React.FC<{ practiceId: string | null; onChanged?: () => void }> = ({ practiceId, onChanged }) => {
  const [bundlesOpen, setBundlesOpen] = useState(false);
  return (
    <SectionCard
      title="Quotes"
      subtitle="Treatment estimates: open, accepted and invoiced"
      icon="solar:bill-list-bold-duotone"
      actions={
        practiceId ? (
          <button type="button" className={secondaryButton} onClick={() => setBundlesOpen(true)}>
            <Icon icon="solar:layers-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Code bundles
          </button>
        ) : undefined
      }
    >
      <QuoteList practiceId={practiceId} onChanged={onChanged} />
      {practiceId && <BundleManagerModal practiceId={practiceId} isOpen={bundlesOpen} onClose={() => setBundlesOpen(false)} />}
    </SectionCard>
  );
};
