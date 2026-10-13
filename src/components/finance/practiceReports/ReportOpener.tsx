import React, { useCallback, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ArReceipt } from '../../../services/ledgerService';
import { DEFAULT_ENCOUNTERS_PLACE, encountersPath } from '../../../utils/encounters/encounterLinks';
import { claimBatchLink, patientBillingLink } from '../../billing/invoiceLinks';
import { ReceiptDetailModal } from '../receipts/ReceiptDetailModal';
import { loadReceiptEntries } from '../receipts/arService';
import { BatchListSheet } from './BatchListSheet';
import { ClaimLineListSheet, ClaimLineStorySheet } from './ClaimLineStorySheet';
import { RecordListSheet } from './RecordListSheet';
import type { RecordItem, ReportTarget } from './reportTargets';

type Opened =
  | { kind: 'receipt'; receipt: ArReceipt }
  | { kind: 'batches'; ids: string[]; label: string }
  | { kind: 'claim_line'; id: string }
  | { kind: 'claim_lines'; ids: string[]; label: string }
  | { kind: 'records'; label: string; items: RecordItem[] };

interface OpenerOptions {
  practiceId: string;
  practiceName: string;
  patientNames: Record<string, string>;
  /** After a change made from an opened payment (a refund, a reversal) */
  onChanged: () => void;
}

/**
 * Opens what a report row counts: the patient's file, an invoice (Finance's own invoice view), a payment, a claim
 * batch or several, a claim line's story or several lines, the visits behind a diagnosis, the records behind a summary
 * row (a list, each opening its own) or the place a record is kept. `element` renders the sheets and must be placed
 * once in the report.
 */
export function useReportOpener({ practiceId, practiceName, patientNames, onChanged }: OpenerOptions): { open: (target: ReportTarget) => void; element: React.ReactNode } {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [opened, setOpened] = useState<Opened | null>(null);

  const open = useCallback((target: ReportTarget) => {
    switch (target.kind) {
      case 'patient':
        navigate(target.tab === 'audit' ? `/patients?${new URLSearchParams({ patientId: target.id, tab: 'audit' }).toString()}` : patientBillingLink(target.id));
        return;
      case 'invoice':
        // Finance opens ?invoice= in its invoice view, on the tab the user is on
        setSearchParams(previous => {
          const next = new URLSearchParams(previous);
          next.set('invoice', target.id);
          return next;
        });
        return;
      case 'receipt':
        loadReceiptEntries(target.id)
          .then(entries => {
            if (entries.receipt) setOpened({ kind: 'receipt', receipt: entries.receipt });
            else toast.error('That payment could not be found.');
          })
          .catch(error => toast.error(error instanceof Error ? plainWords(error.message) : 'Could not open the payment.'));
        return;
      case 'batch':
        navigate(claimBatchLink(target.id));
        return;
      case 'batches':
        setOpened({ kind: 'batches', ids: target.ids, label: target.label });
        return;
      case 'claim_line':
        setOpened({ kind: 'claim_line', id: target.id });
        return;
      case 'claim_lines':
        setOpened({ kind: 'claim_lines', ids: target.ids, label: target.label });
        return;
      case 'visits':
        navigate(encountersPath({ ...DEFAULT_ENCOUNTERS_PLACE, tab: 'encounters' }), { state: { visitFocus: { label: target.label, visitIds: target.ids } } });
        return;
      case 'records':
        setOpened({ kind: 'records', label: target.label, items: target.items });
        return;
      case 'link':
        navigate(target.href);
        return;
    }
  }, [navigate, setSearchParams]);

  const close = () => setOpened(null);
  let element: React.ReactNode = null;
  if (opened?.kind === 'receipt') {
    element = (
      <ReceiptDetailModal
        practiceId={practiceId}
        practiceName={practiceName}
        receipt={opened.receipt}
        patientNames={patientNames}
        onClose={close}
        onChanged={onChanged}
      />
    );
  } else if (opened?.kind === 'batches') {
    element = <BatchListSheet ids={opened.ids} label={opened.label} onClose={close} />;
  } else if (opened?.kind === 'claim_line') {
    element = <ClaimLineStorySheet claimLineId={opened.id} onClose={close} />;
  } else if (opened?.kind === 'claim_lines') {
    element = <ClaimLineListSheet title={`Claim lines: ${opened.label}`} filter={{ ids: opened.ids }} onClose={close} />;
  } else if (opened?.kind === 'records') {
    element = <RecordListSheet label={opened.label} items={opened.items} onOpen={open} onClose={close} />;
  }
  return { open, element };
}
