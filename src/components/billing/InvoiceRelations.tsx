import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { loadInvoicingSetup } from '../../services/invoicingSetup';
import { downloadInvoicePdf } from '../../services/invoiceDocumentService';
import { describeAuditEvents, formatAuditTime, type AuditEntry, type InvoiceAuditEvent } from './invoiceAudit';
import { claimBatchLink, patientBillingLink, quoteLink, visitLink } from './invoiceLinks';
import TeethChartLink from '../dental/TeethChartLink';
import { ClaimLineListSheet } from '../finance/practiceReports/ClaimLineStorySheet';

// quotes, invoice_audit_events and remittance_lines are not in the generated types yet
const db = supabase as unknown as SupabaseClient;

interface InvoiceRelationsProps {
  invoice: { id: string; invoiceNumber: string; patientId: string | null; visitId: string | null; batchId: string | null };
  /** Called before following a link (for example to close the dialog) */
  onNavigate?: () => void;
  /** False where the screen already links to the patient's billing */
  showPatientLink?: boolean;
}

interface Related {
  quote: { id: string; number: string } | null;
  remittanceLines: number;
  changes: AuditEntry[];
  names: Record<string, string>;
  /** Other batches with this invoice's claim lines: lines sent again (field 32) and credit files with its reversals */
  otherBatches: Array<{ id: string; number: number; credit: boolean }>;
}

/** Everyone an audit event mentions: who made the change and practitioners before and after. */
const peopleIn = (events: readonly InvoiceAuditEvent[]): string[] => {
  const ids = events.flatMap(event => [
    event.changed_by,
    event.field === 'practitioner_id' ? event.old_value : null,
    event.field === 'practitioner_id' ? event.new_value : null,
    event.line_before?.practitioner_id,
    event.line_after?.practitioner_id
  ]);
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
};

const linkClass = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-cyan-700 hover:bg-cyan-50';

/**
 * Everything an invoice is linked to, one tap away: its visit, the patient's billing, the claim batch (and any batch a
 * line was sent again in, or reversed in by a credit file), fund answers (remittances), the quote it came from and the
 * text PDF; and, once the invoicing update is applied, who changed its note, practitioner, dates or lines and when,
 * including claim lines corrected or sent again.
 */
const InvoiceRelations: React.FC<InvoiceRelationsProps> = ({ invoice, onNavigate, showPatientLink = true }) => {
  const [related, setRelated] = useState<Related | null>(null);
  const [downloading, setDownloading] = useState(false);
  // What the funds answered on this invoice's claim lines, each line's story one tap further
  const [answersOpen, setAnswersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const setup = await loadInvoicingSetup();
      const [quote, remittances, events, claimLines, reversals] = await Promise.all([
        db.from('quotes').select('id, quote_number').eq('converted_invoice_id', invoice.id).limit(1),
        db.from('remittance_lines').select('id', { count: 'exact', head: true }).eq('invoice_id', invoice.id),
        setup.audit
          ? db.from('invoice_audit_events').select('id, action, field, old_value, new_value, line_code, line_before, line_after, changed_by, changed_at').eq('invoice_id', invoice.id).order('changed_at', { ascending: false }).limit(200)
          : Promise.resolve({ data: [], error: null }),
        db.from('batch_details').select('batch_header_id').eq('invoice_id', invoice.id),
        // Reversal lines carry no invoice id: the reversals say which credit files hold this invoice's (claim corrections)
        db.from('claim_reversals').select('batch_id').eq('invoice_id', invoice.id).not('batch_id', 'is', null)
      ]);
      const creditIds = new Set(((reversals.error ? [] : reversals.data) ?? []).map(row => String((row as { batch_id: string }).batch_id)));
      const batchIds = [...new Set([
        ...((claimLines.error ? [] : claimLines.data) ?? []).map(row => String((row as { batch_header_id: string | null }).batch_header_id ?? '')),
        ...creditIds
      ])].filter(id => id && id !== invoice.batchId);
      const { data: batchRows } = batchIds.length > 0 ? await db.from('batch_headers').select('id, batch_number').in('id', batchIds) : { data: [] };
      const eventRows = ((events.error ? [] : events.data) ?? []) as InvoiceAuditEvent[];
      const personIds = peopleIn(eventRows);
      const { data: people } = personIds.length > 0 ? await supabase.from('users').select('id, full_name').in('id', personIds) : { data: [] };
      if (cancelled) return;
      const quoteRow = (quote.error ? null : (quote.data ?? [])[0]) as { id: string; quote_number: string } | null | undefined;
      const names: Record<string, string> = Object.fromEntries(
        ((people ?? []) as Array<{ id: string; full_name: string | null }>).map(person => [person.id, person.full_name ?? 'A staff member'])
      );
      setRelated({
        quote: quoteRow ? { id: quoteRow.id, number: quoteRow.quote_number } : null,
        remittanceLines: remittances.error ? 0 : remittances.count ?? 0,
        changes: describeAuditEvents(eventRows, names),
        names,
        otherBatches: ((batchRows ?? []) as Array<{ id: string; batch_number: number }>)
          .map(row => ({ id: row.id, number: row.batch_number, credit: creditIds.has(row.id) }))
          .sort((a, b) => a.number - b.number)
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [invoice.id, invoice.batchId]);

  const download = async () => {
    setDownloading(true);
    try {
      const doc = await downloadInvoicePdf(invoice.id);
      if (doc.missing.length > 0) toast(`Invoice downloaded. NAMAF rule 008 also asks for: ${doc.missing.join(' ')}`, { duration: 10000 });
    } catch (error) {
      toast.error(`Could not make the invoice PDF: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void download()} disabled={downloading} className={`${linkClass} disabled:opacity-60`}>
          <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {downloading ? 'Making the PDF...' : 'Invoice PDF'}
        </button>
        {invoice.patientId && invoice.visitId && (
          <Link to={visitLink(invoice.patientId, invoice.visitId)} onClick={onNavigate} className={linkClass}>
            <Icon icon="solar:stethoscope-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Visit
          </Link>
        )}
        {showPatientLink && invoice.patientId && (
          <Link to={patientBillingLink(invoice.patientId)} onClick={onNavigate} className={linkClass}>
            <Icon icon="solar:user-id-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Patient billing
          </Link>
        )}
        {invoice.batchId && (
          <Link to={claimBatchLink(invoice.batchId)} onClick={onNavigate} className={linkClass}>
            <Icon icon="solar:box-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Claim batch
          </Link>
        )}
        {related?.otherBatches.map(batch => (
          <Link key={batch.id} to={claimBatchLink(batch.id)} onClick={onNavigate} className={linkClass}>
            <Icon icon={batch.credit ? 'solar:document-add-bold-duotone' : 'solar:restart-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
            {batch.credit ? `Credit file ${batch.number}` : `Also claimed in batch ${batch.number}`}
          </Link>
        ))}
        {related && related.remittanceLines > 0 && (
          // It opened Remittances on its import screen, where nothing about this invoice shows
          <button type="button" onClick={() => setAnswersOpen(true)} className={linkClass}>
            <Icon icon="solar:inbox-in-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Fund answers ({related.remittanceLines})
          </button>
        )}
        {related?.quote && (
          <Link to={quoteLink(related.quote.id)} onClick={onNavigate} className={linkClass}>
            <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Quote {related.quote.number}
          </Link>
        )}
        {/* Dental practices: the tooth chart, where the work on this invoice shows per tooth */}
        <TeethChartLink patientId={invoice.patientId} onNavigate={onNavigate} className={linkClass} />
      </div>

      {related && related.changes.length > 0 && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">Changes to this invoice ({related.changes.length})</summary>
          <ul className="divide-y divide-gray-100 text-sm">
            {related.changes.map(change => (
              <li key={change.key} className="px-3 py-2">
                <p className="text-gray-900">{change.text}</p>
                <p className="text-xs text-gray-500">
                  {(change.by && related.names[change.by]) || 'Someone'}, {formatAuditTime(change.at)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {answersOpen && (
        <ClaimLineListSheet
          title={`What the funds answered on ${invoice.invoiceNumber}`}
          filter={{ invoiceId: invoice.id }}
          onClose={() => setAnswersOpen(false)}
        />
      )}
    </div>
  );
};

export default InvoiceRelations;
