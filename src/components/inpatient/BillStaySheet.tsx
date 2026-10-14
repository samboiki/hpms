import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { ListSheet } from '../patientLists/ListSheet';
import { refreshAfterSave } from '../../lib/queryClient';
import { usePracticeTariffs } from '../../contexts/PracticeTariffsContext';
import { invoiceService } from '../../services/invoiceService';
import { invoiceLink } from '../billing/invoiceLinks';
import { loadPatientVisits, markStayBilled, type AdmissionDetail, type WardBoard } from '../../services/inpatientService';
import { stayBill, stayNights, type WardBilling } from '../../utils/inpatient/inpatientRules';
import { useWardTariffs, wardTariffLookup } from './useWardTariffs';
import { toCents } from '../../utils/billing/money';
import { parseOwnPrice } from '../../utils/billing/practiceTariffs';
import { Field } from '../stock/stockParts';
import { INPUT, LINK, PRIMARY, SECONDARY, day, errorText, nad } from '../stock/stockUi';
import { patientName, staySegments } from './inpatientData';

/**
 * Bill the stay: one line per night at the bed's daily rate under the ward's bed-day code, plus the ward's daily codes,
 * on an invoice for the stay's visit made by the app's invoice service (its checks, co-payments and claim rules apply).
 * A bed with no daily rate is billed at the code's amount on the price list (NAMAF's for the hospital ward fees); where
 * the list has none either, the amount is typed here. Each line says where its amount came from.
 * The invoice is then linked to the stay both ways, so it is never billed twice.
 */
export const BillStaySheet: React.FC<{ data: AdmissionDetail; board: WardBoard; practiceId: string; onClose: () => void }> = ({ data, board, practiceId, onClose }) => {
  const { admission } = data;
  const { allTariffs, isLoading: listLoading, practiceType } = usePracticeTariffs();
  // Ward codes missing from the practice's list come from the NAMAF lists (useWardTariffs)
  const namaf = useWardTariffs(practiceId, practiceType);
  const isLoading = listLoading || namaf.isLoading;
  const visits = useQuery({ queryKey: ['inpatient', 'visits', admission.patient_id], queryFn: () => loadPatientVisits(admission.patient_id), enabled: !admission.visit_id });
  const [visitId, setVisitId] = useState(admission.visit_id ?? '');
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<{ id: string; number: string } | null>(null);
  // The amounts typed (as text) for nights that have none on the bed or the list, by ask
  const [typed, setTyped] = useState<Record<string, string>>({});
  const typedAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    for (const [key, text] of Object.entries(typed)) {
      const amount = parseOwnPrice(text);
      if (amount !== null && amount > 0) amounts[key] = amount;
    }
    return amounts;
  }, [typed]);

  const bill = useMemo(() => {
    const nights = stayNights(staySegments(data.allocations, board), admission.actual_discharge_date ?? new Date().toISOString());
    const wards = new Map<string, WardBilling>(board.wards.map(ward => [ward.id, { bedDayCode: ward.bed_day_code, dailyCodes: ward.daily_codes ?? [] }]));
    const tariffByCode = wardTariffLookup(allTariffs, namaf.data?.practiceList ?? [], namaf.data?.wardDayCodes ?? []);
    return stayBill({
      nights,
      wards,
      tariffByCode,
      typedAmounts,
      practitionerId: admission.attending_doctor_id,
      icd10Codes: [admission.primary_diagnosis_code, ...(admission.secondary_diagnosis_codes ?? [])].filter((code): code is string => !!code),
      authorisationNumber: admission.pre_authorization_number
    });
  }, [data.allocations, board, admission, allTariffs, namaf.data, typedAmounts]);

  const create = async () => {
    if (!visitId) return void toast.error('Choose the visit the stay is billed on.');
    setSaving(true);
    try {
      const created = await invoiceService.createInvoice({
        patientId: admission.patient_id,
        visitId,
        services: bill.lines,
        practiceId,
        practitionerId: admission.attending_doctor_id,
        notes: `Inpatient stay ${admission.admission_number}`
      });
      await markStayBilled(admission.id, created.id);
      await refreshAfterSave('inpatient');
      setInvoice({ id: created.id, number: created.invoiceNumber });
      toast.success(`Invoice ${created.invoiceNumber} made for the stay.`);
    } catch (error) {
      toast.error(errorText(error, 'Could not bill the stay.'));
    } finally {
      setSaving(false);
    }
  };

  // One row per code, price and source of the amount: nights of the same bed and code are counted together on screen (the invoice has a line per night)
  const summary = useMemo(() => {
    const rows = new Map<string, { code: string; description: string; count: number; cents: number; unitCents: number; source: string }>();
    for (const line of bill.lines) {
      const unitCents = toCents(line.unitPrice);
      const source = bill.sources[line.id] ?? '';
      const key = `${line.code}|${unitCents}|${source}`;
      const row = rows.get(key) ?? { code: line.code, description: line.notes ? `${line.description} (${line.notes})` : line.description, count: 0, cents: 0, unitCents, source };
      row.count += 1;
      row.cents += unitCents;
      rows.set(key, row);
    }
    return [...rows.values()];
  }, [bill.lines, bill.sources]);

  return (
    <ListSheet open onClose={onClose} size="lg" title={`Bill ${patientName(admission)}'s stay`} subtitle={`${admission.admission_number} · ${bill.nights} night${bill.nights === 1 ? '' : 's'}`} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>{invoice ? 'Done' : 'Later'}</button>
          {!invoice && (
            <button type="button" onClick={() => void create()} disabled={saving || isLoading || bill.problems.length > 0 || bill.lines.length === 0} className={PRIMARY}>
              {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Make the invoice
            </button>
          )}
        </div>
      }>
      {invoice ? (
        <p className="text-sm text-gray-700">
          Invoice {invoice.number} was made for the stay. <Link to={invoiceLink(invoice.id)} className={LINK}>Open the invoice</Link>
        </p>
      ) : (
        <div className="space-y-4">
          {bill.problems.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
              {bill.problems.map(problem => <li key={problem}>{problem}</li>)}
            </ul>
          )}
          {bill.asks.length > 0 && (
            <div className="space-y-3">
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Some nights have no amount yet. Type the amount for one night below and the bill is made up.
              </p>
              {bill.asks.map(ask => {
                const text = typed[ask.key] ?? '';
                const wrong = text.trim() !== '' && typedAmounts[ask.key] === undefined;
                return (
                  <Field key={ask.key} label={`${ask.what}: amount for one night (N$)`}
                    hint={`${ask.why} It is billed for ${ask.nights} night${ask.nights === 1 ? '' : 's'}.`}
                    error={wrong ? 'Enter the amount in N$, such as 1250 or 1250.00.' : undefined}>
                    {props => <input {...props} inputMode="decimal" value={text} onChange={event => setTyped(current => ({ ...current, [ask.key]: event.target.value }))} className={INPUT} placeholder="e.g. 1250.00" />}
                  </Field>
                );
              })}
            </div>
          )}
          {!admission.visit_id && (
            <Field label="Visit to bill on" hint="The stay has no visit: choose one of the patient's visits">
              {props => (
                <select {...props} value={visitId} onChange={event => setVisitId(event.target.value)} className={INPUT}>
                  <option value="">Choose a visit</option>
                  {(visits.data ?? []).map(visit => <option key={visit.id} value={visit.id}>{day(visit.visit_date ?? visit.scheduled_date)}{visit.chief_complaint ? `: ${visit.chief_complaint.slice(0, 40)}` : ''}</option>)}
                </select>
              )}
            </Field>
          )}
          {summary.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2 font-medium">Code</th>
                    <th className="py-2 pr-2 font-medium">What</th>
                    <th className="py-2 pr-2 text-right font-medium">Nights</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map(row => (
                    <tr key={`${row.code}|${row.unitCents}|${row.source}`}>
                      <td className="py-2 pr-2 text-gray-900">{row.code}</td>
                      <td className="py-2 pr-2 text-gray-700">{row.description}<span className="block text-xs text-gray-500">{nad(row.unitCents)} a night{row.source ? ` · ${row.source}` : ''}</span></td>
                      <td className="py-2 pr-2 text-right tabular-nums text-gray-900">{row.count}</td>
                      <td className="py-2 text-right tabular-nums text-gray-900">{nad(row.cents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-gray-900">
                    <td colSpan={3} className="pt-2 text-right">Total</td>
                    <td className="pt-2 text-right tabular-nums">{nad(bill.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Each night is its own line, dated that night, with the stay&apos;s diagnosis and authorisation number, as funds pay per day.
            A night is billed at the bed&apos;s daily rate; a bed without one is billed at the code&apos;s amount on the price list (the NAMAF list for ward fees).
            The medical aid and patient shares follow the practice&apos;s usual rules.
          </p>
        </div>
      )}
    </ListSheet>
  );
};
