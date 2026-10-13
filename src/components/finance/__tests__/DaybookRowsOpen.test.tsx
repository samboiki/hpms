import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DaybookEntry } from '../../../services/ledgerService';

// Two invented lines of one day: an invoice raised and the payment taken for it
const entry = (overrides: Partial<DaybookEntry>): DaybookEntry => ({
  number: 1,
  recordedAt: '2026-10-13T08:00:00Z',
  recordedOn: '2026-10-13',
  businessDate: '2026-10-13',
  kind: 'invoice_raised',
  adjustmentKind: null,
  documentNumber: 'INV-000042',
  relatedDocument: null,
  invoiceId: 'inv-1',
  receiptId: null,
  patientId: 'patient-1',
  portion: null,
  method: null,
  amountCents: 45000,
  effectCents: 45000,
  actor: null,
  ...overrides
});
const ENTRIES = [entry({}), entry({ number: 2, kind: 'receipt', documentNumber: 'RC-000007', invoiceId: null, receiptId: 'rc-1', method: 'cash', effectCents: -45000 })];
vi.mock('../controls/controlsService', () => ({
  loadDaybook: vi.fn(async () => ({ state: 'ready', error: null, entries: ENTRIES, prints: [], staffNames: {} })),
  recordDaybookPrint: vi.fn()
}));
const opener = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../practiceReports/ReportOpener', () => ({ useReportOpener: () => ({ open: opener.open, element: null }) }));

import { DaybookPanel } from '../controls/DaybookPanel';

afterEach(() => {
  cleanup();
  opener.open.mockReset();
});

describe('Finance > Payments > Daybook', () => {
  // Every line carried its invoice, payment and patient but opened nothing: checking a day meant searching elsewhere
  it('opens the invoice of an invoice line and the payment of a payment line', async () => {
    render(<DaybookPanel practiceId="practice-1" practiceName="Example Practice" patientNames={{ 'patient-1': 'Example Patient' }} />);
    fireEvent.click(await screen.findByRole('row', { name: 'Open daybook entry 1' }));
    fireEvent.click(screen.getByRole('row', { name: 'Open daybook entry 2' }));
    expect(opener.open.mock.calls).toEqual([[{ kind: 'invoice', id: 'inv-1' }], [{ kind: 'receipt', id: 'rc-1' }]]);
  });
});
