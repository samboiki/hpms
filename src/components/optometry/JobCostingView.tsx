import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, LINK, PRIMARY, QUIET, SECONDARY, day, errorText, nad } from '../stock/stockUi';
import { invoiceLink, patientEyesLink } from '../billing/invoiceLinks';
import { formatPercent } from '../finance/financeFormat';
import { loadPatientNames } from '../../services/stock/stockService';
import { loadJobCosting } from '../../services/optometry/optometryReportsService';
import { saveJobCosts } from '../../services/optometry/frameUnitsService';
import { fromCents } from '../../utils/billing/money';
import { JOB_GAP_LABELS, jobCosting, validateCosts, type CostsDraft, type JobInput, type JobRow } from '../../utils/optometry/jobCosting';
import { jobCostingTable } from './optometryDocuments';
import { BarcodesNotSetUp, ExportButtons, NUM, ReportStatus, TABLE_BOX, TD, TH } from './reportParts';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_set_up' }
  | { status: 'ready'; jobs: JobInput[]; patients: Map<string, string> };

const amount = (cents: number | null): string => (cents === null ? '' : fromCents(cents).toFixed(2));

/** The lab's charge for the lenses, the practice's labour and the lab's invoice number on one job */
const CostsSheet: React.FC<{ job: JobRow | null; onClose: () => void; onSaved: () => void }> = ({ job, onClose, onSaved }) => {
  const [draft, setDraft] = useState<CostsDraft>({ lensCost: '', labourCost: '', labInvoiceRef: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof CostsDraft, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    setDraft({ lensCost: amount(job.lensCostCents), labourCost: amount(job.labourCostCents), labInvoiceRef: job.labInvoiceRef ?? '' });
    setErrors({});
    setFormError(null);
  }, [job]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!job) return;
    const checked = validateCosts(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await saveJobCosts(job.orderId, checked.payload);
      toast.success(`Costs of job #${job.orderNo} saved.`);
      onSaved();
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={job !== null}
      onClose={onClose}
      title={job ? `Costs of job #${job.orderNo}` : 'Costs'}
      subtitle="What the lab charged for the lenses (from its invoice, without VAT) and the practice's own labour. Empty: not entered yet."
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="optometry-job-costs-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save costs
          </button>
        </div>
      }
    >
      <form id="optometry-job-costs-form" onSubmit={save} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lenses (excl. VAT)" error={errors.lensCost}>
            {props => <input {...props} className={INPUT} inputMode="decimal" placeholder="0.00" value={draft.lensCost} disabled={busy} onChange={event => setDraft(current => ({ ...current, lensCost: event.target.value }))} />}
          </Field>
          <Field label="Labour" error={errors.labourCost}>
            {props => <input {...props} className={INPUT} inputMode="decimal" placeholder="0.00" value={draft.labourCost} disabled={busy} onChange={event => setDraft(current => ({ ...current, labourCost: event.target.value }))} />}
          </Field>
        </div>
        <Field label="Lab's invoice number (optional)" error={errors.labInvoiceRef}>
          {props => <input {...props} className={INPUT} maxLength={40} value={draft.labInvoiceRef} disabled={busy} onChange={event => setDraft(current => ({ ...current, labInvoiceRef: event.target.value }))} />}
        </Field>
      </form>
    </ListSheet>
  );
};

/**
 * Job costing for spectacles: every lab order placed in the period against what the patient was charged (the visit's
 * invoice without VAT), less the frame, the lenses and the labour. Jobs missing a cost say so, because their profit
 * is overstated until it is entered.
 */
const JobCostingView: React.FC<{ practiceId: string; from: string; to: string }> = ({ practiceId, from, to }) => {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [editing, setEditing] = useState<JobRow | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async (): Promise<State> => {
      const result = await loadJobCosting(practiceId, from, to);
      if (result.status === 'not_set_up') return { status: 'not_set_up' };
      const patients = await loadPatientNames(result.data.jobs.map(job => job.patientId));
      return { status: 'ready', jobs: result.data.jobs, patients };
    })()
      .then(next => !cancelled && setState(next))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorText(error, 'Could not build the job costing.') }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, from, to, version]);

  const costing = useMemo(() => (state.status === 'ready' ? jobCosting(state.jobs) : null), [state]);

  if (state.status !== 'ready' || !costing) {
    return (
      <ReportStatus
        status={state.status === 'ready' ? 'loading' : state.status}
        message={state.status === 'error' ? state.message : undefined}
        onRetry={() => setVersion(value => value + 1)}
        notSetUp={<BarcodesNotSetUp />}
      />
    );
  }
  const patients = state.patients;

  return (
    <section aria-label="Job costing" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">
          Jobs: {costing.rows.length} · price {nad(costing.priceCents)} · cost {nad(costing.costCents)} · profit {nad(costing.profitCents)}
          {costing.margin !== null ? ` (${formatPercent(costing.margin)})` : ''}
        </h4>
        {costing.rows.length > 0 && (
          <ExportButtons practiceId={practiceId} log={{ report: 'optometry_job_costing', from, to }} table={() => jobCostingTable(costing, from, to, patients)} />
        )}
      </div>
      {costing.incomplete > 0 && (
        <p className="text-xs text-amber-800">{costing.incomplete} job{costing.incomplete === 1 ? ' is' : 's are'} still missing a cost or the invoice: the profit shown is higher than it will be.</p>
      )}
      {costing.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No lab order was placed in this period.</p>
      ) : (
        <div className={TABLE_BOX}>
          <table className="w-full min-w-[44rem]">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className={TH}>Job</th>
                <th scope="col" className={TH}>Patient and invoice</th>
                <th scope="col" className={`${TH} text-right`}>Price</th>
                <th scope="col" className={`${TH} text-right`}>Frame</th>
                <th scope="col" className={`${TH} text-right`}>Lenses</th>
                <th scope="col" className={`${TH} text-right`}>Labour</th>
                <th scope="col" className={`${TH} text-right`}>Profit</th>
                <th scope="col" className={TH}><span className="sr-only">Costs</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costing.rows.map(row => (
                <tr key={row.orderId}>
                  <td className={`${TD} whitespace-nowrap`}>
                    #{row.orderNo}
                    <span className="block text-xs text-gray-500">{day(row.orderedOn)}</span>
                  </td>
                  <td className={TD}>
                    <Link to={patientEyesLink(row.patientId)} className={LINK}>{patients.get(row.patientId) ?? 'Patient'}</Link>
                    {row.invoiceId ? (
                      <Link to={invoiceLink(row.invoiceId)} className={`${LINK} block text-xs`}>{row.invoiceNumber || 'Invoice'}</Link>
                    ) : null}
                    {row.gaps.length > 0 && <span className="block text-xs text-amber-800">{row.gaps.map(gap => JOB_GAP_LABELS[gap]).join('; ')}</span>}
                  </td>
                  <td className={NUM}>{nad(row.priceCents)}</td>
                  <td className={NUM}>{nad(row.frameCostCents)}</td>
                  <td className={NUM}>{row.lensCostCents === null ? '-' : nad(row.lensCostCents)}</td>
                  <td className={NUM}>{row.labourCostCents === null ? '-' : nad(row.labourCostCents)}</td>
                  <td className={NUM}>
                    {nad(row.profitCents)}
                    {row.margin !== null && <span className="block text-xs text-gray-500">{formatPercent(row.margin)}</span>}
                  </td>
                  <td className={`${TD} text-right`}>
                    <button type="button" className={QUIET} onClick={() => setEditing(row)}>Costs</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Price: the visit&apos;s invoice without VAT. Frame: its stock value, or what is owed to the supplier for a consignment frame.</p>
      <CostsSheet job={editing} onClose={() => setEditing(null)} onSaved={() => setVersion(value => value + 1)} />
    </section>
  );
};

export default JobCostingView;
