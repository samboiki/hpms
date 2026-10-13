// @vitest-environment node
/**
 * Some funds send password-protected PDFs (13 of the practice's files are). The importer must ask
 * for the password instead of failing, say when it is wrong, and pass it only to pdf.js.
 */
import { describe, expect, it, vi } from 'vitest';

const getDocument = vi.fn();
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: (options: unknown) => getDocument(options),
  GlobalWorkerOptions: { workerSrc: '' },
  Util: { transform: () => [1, 0, 0, 1, 0, 0] }
}));

import { extractPdfPages, PdfPasswordError } from '../pdfExtract';

const protectedTask = (code: number) => ({
  get promise() {
    return Promise.reject(Object.assign(new Error('password'), { name: 'PasswordException', code }));
  },
  destroy: vi.fn().mockResolvedValue(undefined)
});

describe('password-protected PDFs', () => {
  it('asks for the password, then says when the one given is wrong', async () => {
    getDocument.mockReturnValueOnce(protectedTask(1));
    const first = await extractPdfPages(new Uint8Array([37, 80, 68, 70, 45])).catch(error => error);
    expect(first).toBeInstanceOf(PdfPasswordError);
    expect(first).toMatchObject({ incorrect: false });

    const task = protectedTask(2);
    getDocument.mockReturnValueOnce(task);
    const second = await extractPdfPages(new Uint8Array([37, 80, 68, 70, 45]), { password: 'typed-by-staff' }).catch(error => error);
    expect(second).toMatchObject({ name: 'PdfPasswordError', incorrect: true });
    expect(getDocument.mock.calls[1][0]).toMatchObject({ password: 'typed-by-staff' });
    // The document is always released, so nothing of the protected file stays in memory
    expect(task.destroy).toHaveBeenCalled();
  });
});
