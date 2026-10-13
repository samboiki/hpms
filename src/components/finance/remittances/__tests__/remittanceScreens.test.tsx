/**
 * The remittance screens as staff use them, with the database replaced: a document shows how its
 * lines matched and what posting would do; posting stays off until the tables exist; a line the
 * fund says may not be charged (202) offers no "Bill the patient" action. Invented data.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { emptyDocument, emptyLine, type RemittanceDocument } from '../../../../utils/remittance/types';
import type { ClaimCandidate } from '../../../../utils/remittance/matching';

const mocks = vi.hoisted(() => ({
  loadClaimCandidates: vi.fn(),
  attachHistory: vi.fn(),
  isPaymentPosted: vi.fn(),
  loadInvoiceBalances: vi.fn(),
  saveDocument: vi.fn(),
  saveMatches: vi.fn(),
  postDocument: vi.fn(),
  loadClaimLineDetail: vi.fn(),
  loadRejectionEvents: vi.fn(),
  actOnRejection: vi.fn(),
  loadRejections: vi.fn()
}));

vi.mock('../remittanceService', () => ({
  ...mocks,
  fundProviderName: () => 'Namibia Health Plan'
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <input aria-label={label ?? 'Date'} value={value} onChange={event => onChange(event.target.value)} />
  )
}));

import { DocumentReview } from '../DocumentReview';
import { RejectionSheet } from '../RejectionSheet';
import { RejectionsSection } from '../RejectionsSection';
import type { RejectionItem } from '../remittanceService';

const candidate: ClaimCandidate = {
  claimLineId: 'cl1', batchId: 'b1', fundCode: 'NHPM', invoiceId: 'inv1', invoiceNumber: 'INV-2026-000101', patientId: 'p1',
  patientName: 'Anna Example', patientReference: '0000101', membershipNumber: '00000111222', dependantCode: '01', serviceDate: '2026-09-22',
  tariffCode: '0190', quantity: 1, amountCents: 52000, toothNumbers: '', lineNumber: 1, history: null
};

const doc: RemittanceDocument = {
  ...emptyDocument('medscheme_advice', 'payment', 'medscheme'),
  fundCode: 'NHPM', fundName: 'Namibia Health Plan', paymentReference: 'NHP0000001-000042', paymentDate: '2026-10-02', documentDate: '2026-09-29', totalPaidCents: 52000,
  lines: [{ ...emptyLine(1, 2), memberNumber: '00000111222', dependantCode: '01', practiceReference: '0000101', patientName: 'MR A EXAMPLE', serviceDate: '2026-09-22', tariffRaw: '0190', claimedCents: 52000, paidCents: 52000, status: 'paid' }],
  checks: [{ label: 'ACB payment row', expectedCents: 52000, actualCents: 52000, ok: true }]
};

const context = { practice: { id: 'p', name: 'Clinic', practice_number: '1', practice_type: null, contact_email: null }, funds: [], canApproveWriteOffs: false };

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.loadClaimCandidates.mockResolvedValue({ candidates: [candidate], batchCount: 1, warnings: [] });
  mocks.attachHistory.mockImplementation(async (rows: ClaimCandidate[]) => rows);
  mocks.isPaymentPosted.mockResolvedValue(false);
  mocks.loadInvoiceBalances.mockResolvedValue({ inv1: { medicalAidOutstandingCents: 52000, patientOutstandingCents: 0 } });
  mocks.loadClaimLineDetail.mockResolvedValue(null);
  mocks.loadRejectionEvents.mockResolvedValue([]);
});

describe('reviewing a remittance', () => {
  it('shows each visit with the invoice it matched and what posting will do', async () => {
    render(<DocumentReview practiceId="p" practiceName="Clinic" context={context} setup="ready" fileName="advice.pdf" sha256={'a'.repeat(64)} partNumber={1} doc={doc} onBack={vi.fn()} onPosted={vi.fn()} />);
    expect(await screen.findByText(/Invoice INV-2026-000101/)).toBeInTheDocument();
    expect(screen.getAllByText('Matched').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid in full.')).toBeInTheDocument();
  });

  it('keeps posting off until the remittance tables exist, but still shows the matches', async () => {
    render(<DocumentReview practiceId="p" practiceName="Clinic" context={context} setup="not_set_up" fileName="advice.pdf" sha256={'a'.repeat(64)} partNumber={1} doc={doc} onBack={vi.fn()} onPosted={vi.fn()} />);
    expect(await screen.findByText(/Invoice INV-2026-000101/)).toBeInTheDocument();
    expect(screen.getByText(/Posting starts once remittance import is set up/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post N\$ 520\.00/ })).toBeDisabled();
    expect(mocks.attachHistory).not.toHaveBeenCalled();
  });
});

describe('the rejection queue', () => {
  const item = (overrides: Partial<RejectionItem>): RejectionItem => ({
    id: 'r1', document_id: 'd1', remittance_line_id: 'l1', claim_line_id: 'cl1', invoice_id: 'inv1', patient_id: 'p1', fund_code: 'MAG1',
    service_date: '2026-09-15', tariff_code: '8109', claimed: '95.00', paid: '0.00', at_stake: '95.00', reason_codes: ['202'],
    fund_reason: 'TARIFF CODES CANNOT BE CHARGED TOGETHER. MEMBER NOT LIABLE', category: 'write_off', plain_reason: 'These codes may not be charged together.',
    suggested_action: 'write_off', fix_hint: 'Write it off.', needs_approval: true, status: 'open', follow_up_on: null, resubmit_by: null,
    resubmitted_batch_id: null, resubmission_flag: null, adjustment_id: null, notes: null, created_at: '2026-10-07T08:00:00Z', updated_at: '2026-10-07T08:00:00Z',
    resolved_at: null, patientName: 'Anna Example', invoiceNumber: 'INV-2026-000101', linePatientName: 'MRS A EXAMPLE', ...overrides
  });

  it('offers no "Bill the patient" for a line the fund says may not be charged (202), and needs an admin or doctor to write it off', () => {
    render(<MemoryRouter><RejectionSheet item={item({})} canApproveWriteOffs={false} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('radio', { name: /Bill the patient/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only a practice admin or doctor can approve a write-off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('requires a note to resubmit a line refused for a reason a correction cannot change', async () => {
    render(<MemoryRouter><RejectionSheet item={item({ category: 'patient_liable', suggested_action: 'bill_patient', reason_codes: ['467'], needs_approval: false })} canApproveWriteOffs onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('radio', { name: /Fix and resubmit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Say what changed/)).toBeInTheDocument();
    expect(mocks.actOnRejection).not.toHaveBeenCalled();
  });

  // Fixing a rejected line usually means checking the patient's details or the invoice: one tap to each
  it("links the line to the patient's file and to the invoice", () => {
    render(<MemoryRouter><RejectionSheet item={item({})} canApproveWriteOffs={false} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: "Open the patient's file" })).toHaveAttribute('href', '/patients?patientId=p1&tab=billing');
    expect(screen.getByRole('link', { name: 'Open the invoice' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv1');
  });

  // Opened from a patient's file, the queue shows only that patient's lines; one tap shows everyone's again
  it("shows one patient's lines when opened from their file", async () => {
    mocks.loadRejections.mockResolvedValue([item({}), item({ id: 'r2', patient_id: 'p2', patientName: 'Ben Other' })]);
    const showAll = vi.fn();
    render(<MemoryRouter><RejectionsSection practiceId="pr" setup="ready" canApproveWriteOffs={false} patientId="p1" onShowAllPatients={showAll} /></MemoryRouter>);
    expect(await screen.findByText(/One patient: Anna Example/)).toBeInTheDocument();
    expect(screen.queryByText('Ben Other')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all patients' }));
    expect(showAll).toHaveBeenCalled();
  });
});
