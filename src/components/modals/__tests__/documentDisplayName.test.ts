import { describe, it, expect } from 'vitest';
import { documentDisplayName } from '../documentDisplayName';

// Staff retitle each file in the upload modal before it is attached to the patient record. The
// title is saved as original_name, which the document list shows and downloads are named after.
describe('documentDisplayName', () => {
  it('saves the title staff typed instead of the scanner or phone file name', () => {
    expect(documentDisplayName('Lab results March', 'IMG_20261006_0912.pdf')).toBe('Lab results March.pdf');
  });

  it('keeps the extension so the downloaded file still opens in the right program', () => {
    expect(documentDisplayName('Referral letter', 'scan.PDF')).toBe('Referral letter.PDF');
    expect(documentDisplayName('Referral letter.pdf', 'scan.pdf')).toBe('Referral letter.pdf');
  });

  it('falls back to the original file name when no title was typed', () => {
    expect(documentDisplayName(undefined, 'blood-test.pdf')).toBe('blood-test.pdf');
    expect(documentDisplayName('   ', 'blood-test.pdf')).toBe('blood-test.pdf');
  });

  it('does not invent an extension for files that have none', () => {
    expect(documentDisplayName('Notes', 'README')).toBe('Notes');
    expect(documentDisplayName('Notes', '.hidden')).toBe('Notes');
  });

  it('names camera photos as before: the photo title plus .jpg', () => {
    const title = 'ID Document - 6 Oct 2026 09:12';
    expect(documentDisplayName(title, `${title}.jpg`)).toBe(`${title}.jpg`);
  });
});
