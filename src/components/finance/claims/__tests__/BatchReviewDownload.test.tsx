/**
 * Claim review: a claim file can be sent by hand (attached to an email, uploaded on a fund's portal), which would skip every
 * check Submit makes, and a claim line without an ICD-10 code is not paid (NAMAF Circular 4 of 2025). So Download follows
 * Submit: off while the batch has errors, the preview still opens as a draft (its Download off too), and a batch is only
 * submitted with its confirmed codes saved. A batch that was already sent keeps its file available. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ClaimLine } from '../../../../utils/billing/claimLine';
import type { BatchHeaderRow, FundProvider, PracticeInfo } from '../types';

const state = vi.hoisted(() => ({
  lines: [] as unknown[],
  savedCode: '',
  drafts: {} as Record<string, unknown>,
  downloaded: [] as string[]
}));

vi.mock('../../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../claimsService', async importOriginal => ({
  ...(await importOriginal<typeof import('../claimsService')>()),
  loadBatchLineSources: async () => ({
    details: [{ id: 'line-1', batch_header_id: 'b1', invoice_id: 'inv-1', visit_id: null, patient_id: 'p1', diagnostic_code: state.savedCode }],
    patients: new Map(),
    medicalAid: new Map(),
    visits: new Map(),
    doctors: new Map(),
    invoiceServices: [],
    lineCodes: true,
    tariffRows: [],
    warnings: []
  }),
  loadLineOutcomes: async () => new Map()
}));
vi.mock('../buildClaimLines', async importOriginal => ({
  ...(await importOriginal<typeof import('../buildClaimLines')>()),
  buildClaimLines: () => state.lines,
  matchInvoiceServices: () => new Map()
}));
vi.mock('../reviewCodes', async importOriginal => ({ ...(await importOriginal<typeof import('../reviewCodes')>()), initialDrafts: () => state.drafts }));
vi.mock('../download', () => ({ downloadTextFile: (fileName: string) => state.downloaded.push(fileName) }));
vi.mock('../preSendHistory', () => ({ loadPreSendHistory: async () => ({ history: { remittanceLines: null, earlierRejections: new Map() }, note: null }) }));
vi.mock('../claimCorrectionsService', async importOriginal => ({ ...(await importOriginal<typeof import('../claimCorrectionsService')>()), loadReversals: async () => [] }));
vi.mock('../../practiceReports/ClaimLineStorySheet', () => ({ ClaimLineStoryButton: () => null }));
vi.mock('../../../../services/icd10DefaultsService', () => ({ loadTariffIcd10Defaults: async () => ({ status: 'ready', defaults: new Map(), message: null }) }));
vi.mock('../../../../hooks/useIcd10Search', () => ({ useIcd10Entries: () => ({ status: 'loading' }) }));
vi.mock('../../../billing/Icd10SearchInput', () => ({ default: () => <input aria-label="ICD-10 code" readOnly /> }));
vi.mock('../../../billing/Icd10CodeInput', () => ({ default: () => null }));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));

import BatchReview from '../BatchReview';

const validLine = (overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: 'line-1',
  transactionNumber: 1,
  systemTransactionNumber: 50123,
  invoiceId: 'inv-1',
  invoiceNumber: 'INV2610001',
  visitId: null,
  fundReference: 'NMC1',
  membershipNumber: '12345678',
  memberSurname: 'Shilongo',
  memberInitials: 'EM',
  patientName: 'Elisabeth Shilongo',
  patientDateOfBirth: '1990-05-17',
  patientIdNumber: '90051700123',
  patientReference: '1234',
  gender: 'F',
  tariffCode: '8101',
  description: 'Full mouth examination',
  serviceDate: '2026-09-20',
  quantity: 1,
  amount: 254.7,
  unitPrice: 254.7,
  practiceNumber: '0540001133241',
  treatingDoctorHpcnaNumber: 'DEN00417',
  doctorHpcnaNumber: 'DEN00417',
  icd10Primary: 'Z01.2',
  icd10Secondary: [],
  icd10Confirmed: true,
  toothNumbers: '',
  requiresTooth: false,
  ...overrides
});

const practice: PracticeInfo = { id: 'p1', name: 'Example Practice', practice_number: '0540001133241', practice_type: 'medical', contact_email: null };
const fund: FundProvider = { id: 'f1', name: 'Namibia Medical Care', short_name: 'NMC', email: 'claims@fund.example', medical_aid_reference: 'NMC1', logo_url: null, theme_color: null };
const openBatch = {
  id: 'b1', practice_id: 'p1', practice_number: '0540001133241', batch_number: 38, batch_date: '2026-10-01', medical_aid_reference: 'NMC1',
  status: 'active', total_amount: 254.7, total_invoices: 1, generated_file_content: null, recipient_email: null, sent_at: null,
  confirmed_at: null, created_at: null, transaction_type: 'D', source_software: null, source_software_version: null, system_identification: 1
} as BatchHeaderRow;
const sentBatch = { ...openBatch, status: 'sent', sent_at: '2026-10-02T10:00:00Z' } as BatchHeaderRow;
const savedDraft = { 'line-1': { primary: 'Z01.2', secondary: [], confirmed: true, source: 'saved' } };

function review(batch: BatchHeaderRow) {
  render(
    <MemoryRouter>
      <BatchReview practice={practice} batch={batch} fund={fund} userId="user-1" onBack={() => undefined} onChanged={() => undefined} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  // The checks count days to the fund's deadline from today
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T08:00:00'));
  state.lines = [];
  state.savedCode = '';
  state.drafts = {};
  state.downloaded = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('claim review: Download follows Submit', () => {
  it('a line without an ICD-10 code switches Download and Submit off, and Download says why', async () => {
    state.lines = [validLine({ icd10Primary: '', icd10Confirmed: false })];
    review(openBatch);

    const download = await screen.findByRole('button', { name: 'Download' });
    expect(download).toBeDisabled();
    expect(download.getAttribute('title')).toMatch(/Fix the 1 error\(s\) first/);
    expect(screen.getByRole('button', { name: /Submit to fund/ })).toBeDisabled();

    fireEvent.click(download);
    expect(state.downloaded).toEqual([]);
  });

  it('the draft can still be previewed, but its Download is off too', async () => {
    state.lines = [validLine({ icd10Primary: '', icd10Confirmed: false })];
    review(openBatch);

    fireEvent.click(await screen.findByRole('button', { name: /Preview file/ }));
    const preview = await screen.findByRole('dialog');
    expect(within(preview).getByText(/Draft: 1 error\(s\) must be fixed/)).toBeTruthy();
    expect(within(preview).getByRole('button', { name: 'Download' })).toBeDisabled();
  });

  it('a correct batch with its codes saved can be downloaded and submitted', async () => {
    state.lines = [validLine()];
    state.savedCode = 'Z01.2';
    state.drafts = savedDraft;
    review(openBatch);

    const download = await screen.findByRole('button', { name: 'Download' });
    expect(download).toBeEnabled();
    expect(screen.getByRole('button', { name: /Submit to fund/ })).toBeEnabled();

    fireEvent.click(download);
    expect(state.downloaded).toEqual(['0540001133241_38_NMC1.Dat']);
  });

  // The database refuses to record a batch as sent while a line has no code saved, so Submit waits for the save
  it('codes that are confirmed but not saved yet hold Submit back, and say to save them', async () => {
    state.lines = [validLine()];
    state.savedCode = '';
    state.drafts = savedDraft;
    review(openBatch);

    const submit = await screen.findByRole('button', { name: /Submit to fund/ });
    expect(submit).toBeDisabled();
    expect(submit.getAttribute('title')).toMatch(/Save the ICD-10 codes first/);
    expect(screen.getByRole('button', { name: /Save ICD-10 codes \(1\)/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });

  // What went to the fund is a record, whatever today's checks say about its lines
  it('a batch that was already sent can still be downloaded', async () => {
    state.lines = [validLine({ icd10Primary: '', icd10Confirmed: false })];
    review(sentBatch);

    expect(await screen.findByRole('button', { name: 'Download' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Submit to fund/ })).toBeNull();
  });
});
