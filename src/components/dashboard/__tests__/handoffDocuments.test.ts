/**
 * A handed-off visit card prints the visit's prescription, leave form and invoice. Each save of the visit stores new
 * copies and the old ones stay, so after a change (a medicine swapped) the card printed the first copy, not the visit
 * as it is now.
 */
import { describe, expect, it } from 'vitest';
import { latestDocumentByType } from '../handoffDocuments';

describe('latestDocumentByType', () => {
  it('prints the newest copy of each document, whatever order they come in', () => {
    const docs = [
      { document_type: 'prescription', file_path: 'rx-new.pdf', created_at: '2026-10-13T10:05:00Z' },
      { document_type: 'prescription', file_path: 'rx-old.pdf', created_at: '2026-10-13T09:00:00Z' },
      { document_type: 'invoice', file_path: 'inv-old.pdf', storage_bucket: 'records', created_at: '2026-10-13T09:00:00Z' },
      { document_type: 'invoice', file_path: 'inv-new.pdf', storage_bucket: 'records', created_at: '2026-10-13T10:05:00Z' }
    ];
    expect(latestDocumentByType(docs)).toEqual({
      prescription: { path: 'rx-new.pdf', bucket: null },
      invoice: { path: 'inv-new.pdf', bucket: 'records' }
    });
  });

  it('skips rows without a type or a file', () => {
    expect(latestDocumentByType([{ document_type: null, file_path: 'x.pdf' }, { document_type: 'leave_form', file_path: null }])).toEqual({});
  });
});
