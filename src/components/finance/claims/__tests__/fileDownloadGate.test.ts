import { describe, expect, it } from 'vitest';
import { downloadBlockedReason } from '../fileDownloadGate';

// Why this matters: a file downloaded from a batch with errors (above all a line without an ICD-10 code, which the funds do
// not pay) could be emailed or uploaded by hand, which is exactly what Submit refuses to do.
describe('downloading a claim file', () => {
  it('is held back for an open batch with errors, and the reason names how many', () => {
    const reason = downloadBlockedReason({ open: true, canSubmit: false, errorCount: 3 });
    expect(reason).toMatch(/Fix the 3 error\(s\) first/);
    expect(reason).toMatch(/previewed here but not downloaded/);
  });

  it('is open for an open batch that passes every check', () => {
    expect(downloadBlockedReason({ open: true, canSubmit: true, errorCount: 0 })).toBeNull();
  });

  // The file of a sent batch is what the fund received; its lines may fail checks today (a deadline that has since passed)
  it('stays open for a batch that was already sent, whatever the lines say now', () => {
    expect(downloadBlockedReason({ open: false, canSubmit: false, errorCount: 12 })).toBeNull();
  });
});
