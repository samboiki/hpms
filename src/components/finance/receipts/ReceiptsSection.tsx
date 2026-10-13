import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../../stores/authStore';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  RECEIPT_METHOD_LABELS,
  isEffective,
  isInRange,
  normalizePaymentMethod,
  payerLabel,
  type ArReceipt,
  type DateRange,
  type PaymentMethodKey
} from '../../../services/ledgerService';
import { PAYMENT_METHOD_META } from '../financeTheme';
import { pluralize } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, FilterPill, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { ReceivePaymentDialog } from './ReceivePaymentDialog';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import { loadDrafts } from './fundPaymentService';
import { formatDay } from './receiptDocuments';

const nad = (cents: number) => formatNad(fromCents(cents));

interface ReceiptsSectionProps {
  practiceId: string;
  practiceName: string;
  receipts: ArReceipt[];
  /** Effective receipts with unallocated money, any date */
  unallocated: ArReceipt[];
  range: DateRange;
  rangeLabel: string;
  patientNames: Record<string, string>;
  onChanged: () => void;
}

type PayerFilter = 'all' | 'patients' | 'funds';

/**
 * Finance > Payments once receipts are in use: record a payment or a fund's lump sum, the
 * receipts of the period (filter, export, open one to print, allocate, refund or reverse) and the
 * money that is not allocated to any invoice yet (credit and suspense).
 */
export const ReceiptsSection: React.FC<ReceiptsSectionProps> = ({ practiceId, practiceName, receipts, unallocated, range, rangeLabel, patientNames, onChanged }) => {
  const user = useAuthStore(state => state.user);
  const [dialog, setDialog] = useState<'patient' | 'fund' | null>(null);
  const [opened, setOpened] = useState<ArReceipt | null>(null);
  const [method, setMethod] = useState<'all' | PaymentMethodKey>('all');
  const [payer, setPayer] = useState<PayerFilter>('all');
  const [onlyUnallocated, setOnlyUnallocated] = useState(false);
  const [showReversed, setShowReversed] = useState(false);
  // Fund payments saved part way (fund_payment_drafts): shown so a colleague can carry on
  const [keyingCount, setKeyingCount] = useState(0);
  useEffect(() => {
    if (dialog) return;
    let live = true;
    loadDrafts(practiceId)
      .then(result => {
        if (live) setKeyingCount(result.drafts.length);
      })
      .catch(error => console.warn('Payments: the fund payments being keyed could not be loaded', error));
    return () => {
      live = false;
    };
  }, [practiceId, dialog]);

  const inPeriod = useMemo(() => receipts.filter(receipt => isInRange(receipt.receivedOn, range)), [receipts, range]);
  const methodCounts = useMemo(() => {
    const counts = new Map<PaymentMethodKey, number>();
    inPeriod.filter(isEffective).forEach(receipt => {
      const key = normalizePaymentMethod(receipt.method);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()];
  }, [inPeriod]);

  const rows = useMemo(() => {
    const source = onlyUnallocated ? unallocated : inPeriod;
    return source
      .filter(receipt => showReversed || isEffective(receipt))
      .filter(receipt => method === 'all' || normalizePaymentMethod(receipt.method) === method)
      .filter(receipt => payer === 'all' || (payer === 'funds') === (receipt.payerType === 'medical_aid'))
      .sort((a, b) => (b.receivedOn ?? '').localeCompare(a.receivedOn ?? '') || b.number.localeCompare(a.number));
  }, [onlyUnallocated, unallocated, inPeriod, showReversed, method, payer]);

  const reversedCount = inPeriod.filter(receipt => !isEffective(receipt)).length;
  const unallocatedCents = unallocated.reduce((sum, receipt) => sum + receipt.unallocatedCents, 0);
  const fundSuspense = unallocated.filter(receipt => receipt.payerType === 'medical_aid');

  const columns: TableColumn<ArReceipt>[] = [
    {
      key: 'receipt',
      header: 'Receipt',
      render: receipt => (
        <div className="min-w-0">
          <p className={`font-mono text-sm font-medium ${receipt.reversal ? 'text-gray-400 line-through' : 'text-cyan-700'}`}>{receipt.number}</p>
          <p className="max-w-[220px] truncate text-xs text-gray-500">{payerLabel(receipt, patientNames)}</p>
        </div>
      )
    },
    { key: 'date', header: 'Received', render: receipt => formatDay(receipt.receivedOn) },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'sm',
      render: receipt => {
        const meta = PAYMENT_METHOD_META[normalizePaymentMethod(receipt.method)];
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <Icon icon={meta.icon} className="h-4 w-4" style={{ color: meta.color }} aria-hidden="true" />
            {meta.label}
          </span>
        );
      }
    },
    { key: 'allocated', header: 'Allocated', align: 'right', hideBelow: 'lg', render: receipt => nad(receipt.allocatedCents) },
    {
      key: 'unallocated',
      header: 'Unallocated',
      align: 'right',
      hideBelow: 'md',
      render: receipt => (receipt.unallocatedCents > 0 ? <span className="font-medium text-amber-700">{nad(receipt.unallocatedCents)}</span> : <span className="text-gray-400">—</span>)
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: receipt => (
        <span className={receipt.reversal ? 'text-gray-400 line-through' : 'font-semibold text-gray-900'}>
          {nad(receipt.amountCents)}
          {receipt.reversal && <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-700 no-underline">Reversed</span>}
        </span>
      )
    }
  ];

  const exportRows = () => {
    const csv = toCsv(
      [
        { header: 'Receipt', type: 'text' },
        { header: 'Received', type: 'date' },
        { header: 'Payer', type: 'text' },
        { header: 'Method', type: 'text' },
        { header: 'Reference', type: 'text' },
        { header: 'Amount', type: 'money' },
        { header: 'Allocated', type: 'money' },
        { header: 'Refunded', type: 'money' },
        { header: 'Unallocated', type: 'money' },
        { header: 'Reversed', type: 'text' }
      ],
      rows.map(receipt => [
        receipt.number, receipt.receivedOn, payerLabel(receipt, patientNames), RECEIPT_METHOD_LABELS[receipt.method], receipt.reference,
        fromCents(receipt.amountCents), fromCents(receipt.allocatedCents), fromCents(receipt.refundedCents), fromCents(receipt.unallocatedCents),
        receipt.reversal ? `Yes: ${receipt.reversal.reason}` : ''
      ])
    );
    downloadCsv(exportFileName(`receipts ${range.startKey} to ${range.endKey}`), csv);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton variant="primary" icon="solar:hand-money-bold-duotone" label="Receive payment" onClick={() => setDialog('patient')} />
        <ActionButton icon="solar:heart-pulse-bold-duotone" label="Medical aid payment" onClick={() => setDialog('fund')} title="Key a fund's payment line by line against the total on its remittance" />
      </div>

      {keyingCount > 0 && (
        <Notice
          tone="info"
          title={`${pluralize(keyingCount, 'medical aid payment is', 'medical aid payments are')} being keyed`}
          action={<ActionButton icon="solar:pen-new-square-bold-duotone" label="Carry on" onClick={() => setDialog('fund')} />}
        >
          Saved part way, by you or a colleague. Carry on keying and post it once its lines add up to the amount received.
        </Notice>
      )}

      {unallocated.length > 0 && (
        <Notice
          tone="warning"
          title={`${nad(unallocatedCents)} received but not allocated to invoices`}
          action={<ActionButton icon="solar:eye-bold-duotone" label={onlyUnallocated ? 'Show all' : 'Show them'} onClick={() => setOnlyUnallocated(value => !value)} />}
        >
          {pluralize(unallocated.length, 'receipt has', 'receipts have')} money not yet on an invoice
          {fundSuspense.length > 0 ? `, of which ${pluralize(fundSuspense.length, 'is a medical aid payment', 'are medical aid payments')} still to match (suspense)` : ''}.
          Open a receipt to allocate the credit or refund it.
        </Notice>
      )}

      <SectionCard
        title={onlyUnallocated ? 'Receipts with unallocated money' : 'Receipts'}
        subtitle={onlyUnallocated ? 'Any date, oldest first in the list order below' : `Received ${rangeLabel}, most recent first`}
        icon="solar:checklist-minimalistic-bold-duotone"
        tone="green"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportRows} disabled={rows.length === 0} />}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Method</span>
          <FilterPill active={method === 'all'} onClick={() => setMethod('all')}>All</FilterPill>
          {methodCounts.map(([key, count]) => (
            <FilterPill key={key} active={method === key} onClick={() => setMethod(key)} icon={PAYMENT_METHOD_META[key].icon} count={count}>
              {PAYMENT_METHOD_META[key].label}
            </FilterPill>
          ))}
          <span className="ml-2 text-xs text-gray-500">Paid by</span>
          <FilterPill active={payer === 'all'} onClick={() => setPayer('all')}>All</FilterPill>
          <FilterPill active={payer === 'patients'} onClick={() => setPayer('patients')}>Patients and others</FilterPill>
          <FilterPill active={payer === 'funds'} onClick={() => setPayer('funds')}>Medical aids</FilterPill>
          {reversedCount > 0 && (
            <FilterPill active={showReversed} onClick={() => setShowReversed(value => !value)} count={reversedCount}>Show reversed</FilterPill>
          )}
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={receipt => receipt.id}
          onRowClick={setOpened}
          rowLabel={receipt => `Open receipt ${receipt.number}`}
          resetKey={`${method}|${payer}|${onlyUnallocated}|${showReversed}|${range.startKey}|${range.endKey}`}
          itemLabel="receipts"
          empty={
            <EmptyState
              compact
              icon="solar:wallet-bold-duotone"
              title={onlyUnallocated ? 'No unallocated money' : 'No receipts in this period'}
              message="Use Receive payment when money comes in. Invoices marked paid in the status menu also get a receipt."
            />
          }
        />
      </SectionCard>

      {dialog && (
        <ReceivePaymentDialog
          practiceId={practiceId}
          practiceName={practiceName}
          staffName={user?.name ?? null}
          initialPayer={dialog === 'fund' ? 'medical_aid' : 'patient'}
          onClose={() => setDialog(null)}
          onSaved={onChanged}
        />
      )}
      {opened && (
        <ReceiptDetailModal
          practiceId={practiceId}
          practiceName={practiceName}
          receipt={opened}
          patientNames={patientNames}
          onClose={() => setOpened(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
};
