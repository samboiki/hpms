import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toCents } from '../../../utils/billing/money';
import { invoiceLink } from '../../billing/invoiceLinks';
import { fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { FORMAT_LABELS, KIND_LABELS, LINE_STATUS_LABELS } from '../../../utils/remittance/types';
import type { ArReceipt } from '../../../services/ledgerService';
import { DataTable, type TableColumn } from '../DataTable';
import { EmptyState, ErrorState, LoadingState, SectionCard } from '../FinanceUI';
import { ErrorBox, SecondaryButton, Sheet } from '../receipts/ArUi';
import { loadReceiptEntries } from '../receipts/arService';
import { ReceiptDetailModal } from '../receipts/ReceiptDetailModal';
import { loadDocumentLines, loadDocuments, type DocumentSummary, type SetupState, type StoredLine } from './remittanceService';
import { Chip, formatDateKey, nad, POSTING_STATUS_LABELS } from './remittanceUi';

interface PostedSectionProps {
  practiceId: string;
  practiceName: string;
  setup: SetupState;
  /** A posted fund payment's receipt was refunded, reversed or allocated: Finance reloads its figures */
  onChanged?: () => void;
}

const cents = (value: number | string | null | undefined): number => toCents(Number(value ?? 0) || 0);

/** Every document imported for the practice, what it posted, and its lines */
export const PostedSection: React.FC<PostedSectionProps> = ({ practiceId, practiceName, setup, onChanged }) => {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<DocumentSummary | null>(null);

  const load = useCallback(async () => {
    if (setup !== 'ready') return;
    setError(null);
    try {
      setDocuments(await loadDocuments(practiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the remittances.');
    }
  }, [practiceId, setup]);

  useEffect(() => {
    void load();
  }, [load]);

  if (setup !== 'ready') {
    return <EmptyState icon="solar:checklist-minimalistic-bold-duotone" title="Nothing imported yet" message="Imported remittances are listed here once remittance import is set up in the database." />;
  }
  if (error) return <div className="rounded-2xl border border-gray-200 bg-white shadow-sm"><ErrorState title="Could not load the remittances" message={error} onRetry={load} /></div>;
  if (!documents) return <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"><LoadingState label="Loading remittances" rows={4} /></div>;

  const columns: TableColumn<DocumentSummary>[] = [
    {
      key: 'fund',
      header: 'Fund',
      render: doc => (
        <div className="flex min-w-0 items-center gap-2">
          <MedicalAidLogo name={doc.fund_code ?? doc.fund_name} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{fundLabel(doc.fund_code, doc.fund_name)}</p>
            <p className="max-w-[220px] truncate text-xs text-gray-500" title={doc.file_name}>{KIND_LABELS[doc.kind]} · {doc.file_name}</p>
          </div>
        </div>
      )
    },
    { key: 'date', header: 'Paid', render: doc => formatDateKey(doc.payment_date ?? doc.document_date) },
    { key: 'reference', header: 'Reference', hideBelow: 'lg', render: doc => doc.payment_reference ?? doc.statement_number ?? '-' },
    { key: 'lines', header: 'Lines', align: 'right', hideBelow: 'md', render: doc => `${doc.matched}/${doc.lineCount}` },
    {
      key: 'status',
      header: 'Status',
      render: doc => doc.status === 'posted'
        ? <Chip tone="green" icon="solar:check-circle-bold-duotone">{doc.receiptNumber ?? 'Recorded'}</Chip>
        : doc.status === 'duplicate'
          ? <Chip tone="gray">Posted from another file</Chip>
          : <Chip tone="amber">Not posted</Chip>
    },
    { key: 'amount', header: 'Amount', align: 'right', render: doc => (doc.kind === 'payment' || doc.kind === 'month_summary' ? nad(cents(doc.total_paid)) : '-') }
  ];

  return (
    <>
      <SectionCard title="Imported remittances" subtitle="Most recent first; open one to see its lines and receipt" icon="solar:checklist-minimalistic-bold-duotone" tone="green">
        <DataTable
          rows={documents}
          columns={columns}
          rowKey={doc => doc.id}
          onRowClick={setOpened}
          rowLabel={doc => `Open ${doc.file_name}`}
          itemLabel="documents"
          empty={<EmptyState compact icon="solar:document-text-bold-duotone" title="Nothing imported yet" message="Post a remittance from Import and it is listed here." />}
        />
      </SectionCard>
      {opened && (
        <DocumentSheet
          doc={opened}
          practiceId={practiceId}
          practiceName={practiceName}
          onClose={() => setOpened(null)}
          onChanged={() => {
            void load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
};

const DocumentSheet: React.FC<{ doc: DocumentSummary; practiceId: string; practiceName: string; onClose: () => void; onChanged: () => void }> = ({ doc, practiceId, practiceName, onClose, onChanged }) => {
  const [lines, setLines] = useState<StoredLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ArReceipt | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDocumentLines(doc.id)
      .then(rows => { if (!cancelled) setLines(rows); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the lines.'); });
    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const openReceipt = async () => {
    if (!doc.receipt_id) return;
    try {
      const entries = await loadReceiptEntries(doc.receipt_id);
      setReceipt(entries.receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the receipt.');
    }
  };

  return (
    <>
      <Sheet
        open={!receipt}
        onClose={onClose}
        size="xl"
        title={`${fundLabel(doc.fund_code, doc.fund_name)}: ${KIND_LABELS[doc.kind].toLowerCase()}`}
        subtitle={(
          <span className="inline-flex items-center gap-2">
            <MedicalAidLogo name={doc.fund_code ?? doc.fund_name} />
            {`${FORMAT_LABELS[doc.format]} · ${doc.file_name}`}
          </span>
        )}
        icon="solar:bill-list-bold-duotone"
        footer={doc.receipt_id ? <SecondaryButton icon="solar:wallet-money-bold-duotone" onClick={openReceipt}>Open receipt {doc.receiptNumber ?? ''}</SecondaryButton> : undefined}
      >
        {error && <ErrorBox>{error}</ErrorBox>}
        {doc.receipt_id && (
          <p className="mb-3 text-sm text-gray-600">
            Receipt {doc.receiptNumber}: {nad(doc.allocatedCents)} allocated{doc.unallocatedCents > 0 ? `, ${nad(doc.unallocatedCents)} still unallocated (open the receipt to allocate it)` : ''}.
          </p>
        )}
        {!lines ? (
          <LoadingState label="Loading the lines" rows={3} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {lines.map(line => (
              <li key={line.id} className="grid grid-cols-1 gap-1 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <span className="font-mono font-medium text-gray-900">{line.tariff_code ?? 'Claim'}</span>
                  <span className="ml-2 text-gray-700">{line.patient_name ?? ''}</span>
                  <span className="ml-2 text-xs text-gray-500">{formatDateKey(line.service_date)}</span>
                  {line.reason_codes.length > 0 && <p className="text-xs text-gray-500" title={line.reason_texts.join(' / ') || undefined}>Code {line.reason_codes.join('/')}</p>}
                  {/* The invoice the line was matched to (as on a rejection) */}
                  {line.invoice_id && (
                    <Link to={invoiceLink(line.invoice_id)} className="text-xs font-medium text-cyan-700 hover:underline">
                      Open the invoice
                    </Link>
                  )}
                </div>
                <span className="tabular-nums text-gray-700">{LINE_STATUS_LABELS[line.line_status]} {nad(cents(line.paid))} of {nad(cents(line.claimed))}</span>
                <Chip tone={line.posting_status === 'queued' || line.posting_status === 'suspense' ? 'amber' : line.posting_status === 'held' ? 'violet' : 'gray'}>
                  {POSTING_STATUS_LABELS[line.posting_status] ?? line.posting_status}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {receipt && (
        <ReceiptDetailModal
          practiceId={practiceId}
          practiceName={practiceName}
          receipt={receipt}
          patientNames={{}}
          onClose={() => setReceipt(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
};
