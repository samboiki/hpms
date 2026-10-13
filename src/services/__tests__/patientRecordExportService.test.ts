import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Invented rows per table; each query answers with its table's rows
const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  files: {} as Record<string, Uint8Array>,
  rpc: vi.fn()
}));
vi.mock('../../lib/supabase', () => {
  const query = (table: string) => {
    // An `or` list keeps a row when one of its parts holds, as PostgREST does (only the filters the visit rule uses)
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const rows = () => ((db.tables[table] ?? []) as Record<string, unknown>[]).filter(row => filters.every(keep => keep(row)));
    const result = () => ({ data: rows(), error: null });
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'order', 'range']) builder[method] = () => builder;
    builder.or = (list: string) => {
      filters.push(row =>
        list.split(',').some(part => {
          const [column, operator, ...rest] = part.split('.');
          const value = row[column] ?? null;
          if (operator === 'is' && rest.join('.') === 'null') return value === null;
          if (operator === 'neq') return value !== null && value !== rest.join('.');
          throw new Error(`An or filter this mock does not know: ${part}`);
        })
      );
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return builder;
  };
  return {
    supabase: {
      from: query,
      rpc: (...args: unknown[]) => db.rpc(...args),
      storage: {
        from: () => ({
          // The storage client answers with a Blob; jsdom's has no arrayBuffer(), so a Blob-like stands in
          download: (path: string) =>
            Promise.resolve(
              db.files[path]
                ? { data: { arrayBuffer: () => Promise.resolve(db.files[path].slice().buffer) }, error: null }
                : { data: null, error: { message: 'Object not found' } }
            )
        })
      }
    }
  };
});
vi.mock('../../components/quotes/quoteService', () => ({
  loadLetterhead: () =>
    Promise.resolve({ id: 'practice-1', name: 'Example Family Practice', address: null, city: 'Windhoek', country: 'Namibia', postalCode: null, contactPhone: null, contactEmail: null, practiceNumber: null, primaryColor: '#123456' })
}));
vi.mock('../patientSafetyService', () => ({ loadPatientSafety: () => Promise.reject(new Error('not set up')) }));
vi.mock('../patientLettersService', () => ({ listLetters: () => Promise.resolve([]), listSickNotes: () => Promise.resolve([]) }));
vi.mock('../patientConsentsService', () => ({ listConsents: () => Promise.resolve([]) }));
vi.mock('../patientNotesService', () => ({ loadPatientNotes: () => Promise.resolve([]) }));
const privateNotes = vi.hoisted(() => ({ loadPrivateNotes: vi.fn() }));
vi.mock('../privateNotesService', () => privateNotes);
vi.mock('../invoiceContextService', () => ({ loadPracticeStaff: () => Promise.resolve([{ id: 'user-1', full_name: 'Dr A Example' }]) }));
vi.mock('../../components/finance/receipts/arService', () => ({
  loadPatientBalances: () => Promise.resolve({ state: 'not_set_up', balances: {} }),
  loadPatientReceipts: () => Promise.resolve({ state: 'not_set_up', receipts: [] })
}));

import { exportRecordSummary, exportRecordZip, loadPatientRecord } from '../patientRecordExportService';
import { CARRIER_VISIT_SOURCE } from '../../utils/carrierVisits';

const PRACTICE = '11111111-1111-4111-8111-111111111111';
const saved: Blob[] = [];
const names: string[] = [];

/** The names of the files inside a ZIP (its central directory) */
async function zipNames(blob: Blob): Promise<string[]> {
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const view = new DataView(bytes.buffer);
  const end = bytes.byteLength - 22;
  let offset = view.getUint32(end + 16, true);
  const result: string[] = [];
  for (let i = 0; i < view.getUint16(end + 10, true); i += 1) {
    const length = view.getUint16(offset + 28, true);
    result.push(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length)));
    offset += 46 + length;
  }
  return result;
}

beforeEach(() => {
  saved.length = 0;
  names.length = 0;
  db.rpc.mockReset().mockResolvedValue({ data: null, error: { code: '22023', message: 'Unknown event' } });
  privateNotes.loadPrivateNotes.mockReset().mockResolvedValue([]);
  db.tables = {
    patients: [{ id: 'patient-1', first_name: 'Maria', last_name: 'Example', id_number: 'TEMP-123', date_of_birth: '1990-01-01', gender: 'female', pregnancy_due_date: '2027-03-14' }],
    visits: [{ id: 'visit-1', visit_date: '2026-10-12', visit_type: 'consultation', status: 'completed', diagnosis: 'Acute bronchitis', doctor: { full_name: 'Dr A Example' } }],
    patient_media: [
      { title: 'Rash', storage_path: `${PRACTICE}/patient-media/patient-1/a.jpg`, storage_bucket: 'records', subcategory: 'clinical_photo', mime_type: 'image/jpeg', uploaded_at: '2026-10-12T08:00:00Z' },
      { title: 'Lost scan', storage_path: `${PRACTICE}/patient-media/patient-1/gone.pdf`, storage_bucket: 'records', category: 'document', uploaded_at: '2026-10-11T08:00:00Z' }
    ]
  };
  db.files = { [`${PRACTICE}/patient-media/patient-1/a.jpg`]: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) };
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (blob: Blob) => (saved.push(blob), 'blob:invented'), revokeObjectURL: () => undefined }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const options = { practiceId: PRACTICE, patientId: 'patient-1', userId: 'user-1', includeMyPrivateNotes: false };

describe('exporting one patient record', () => {
  it('saves one ZIP with the summary PDF and every document that could be fetched, and counts the one that could not', async () => {
    const progress: string[] = [];
    const result = await exportRecordZip({ ...options, onProgress: step => progress.push(step.stage) });
    expect(result.fileName).toMatch(/^record-maria-example-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(result).toMatchObject({ documentsAdded: 1, documentsMissing: 1 });
    expect(names).toEqual([result.fileName]);
    const files = await zipNames(saved[0]);
    const base = result.fileName.replace(/\.zip$/, '');
    expect(files).toEqual([`${base}/${base}.pdf`, `${base}/documents/2026-10-12 Clinical photo - Rash.jpg`]);
    expect(progress).toEqual(expect.arrayContaining(['reading', 'documents', 'packing']));
  });

  it("never reads private notes unless the practitioner asks for their own", async () => {
    await exportRecordSummary(options);
    expect(privateNotes.loadPrivateNotes).not.toHaveBeenCalled();
    await exportRecordSummary({ ...options, includeMyPrivateNotes: true });
    expect(privateNotes.loadPrivateNotes).toHaveBeenCalledWith('patient-1', 'user-1');
  });

  it('offers every export to the record-access log, and a refusal there never stops the export', async () => {
    const result = await exportRecordSummary(options);
    expect(result.fileName).toMatch(/^record-maria-example-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(db.rpc).toHaveBeenCalledWith('log_record_access', { p_event: 'record_exported', p_patient_id: 'patient-1', p_screen: 'patient_file' });
    expect(saved).toHaveLength(1);
  });

  // A payment plan's, a package's or an opening balance's invoices hang on a row the system makes: it is not a visit,
  // so the record a patient or another practice receives lists only real visits (those invoices stay under Invoices)
  it('lists the visits, never a row that only carries invoices', async () => {
    db.tables.visits = [
      ...db.tables.visits,
      { id: 'carrier-1', visit_date: '2026-10-13', visit_type: 'consultation', status: 'cancelled', automation_source: CARRIER_VISIT_SOURCE }
    ];
    const loaded = await loadPatientRecord(options);
    expect(loaded.record.visits.map(visit => visit.date)).toEqual(['2026-10-12']);
    expect(loaded.record.visits[0]).toMatchObject({ diagnosis: 'Acute bronchitis', status: 'Completed' });
  });

  it("refuses a patient who is not on the practice's files, and saves nothing", async () => {
    db.tables.patients = [];
    await expect(exportRecordZip(options)).rejects.toThrow("This patient is not on your practice's files.");
    expect(saved).toHaveLength(0);
  });
});
