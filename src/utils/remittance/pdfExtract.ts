/**
 * Reads the text of a PDF with positions, using pdf.js (pdfjs-dist, legacy build: it carries the
 * polyfills older phone and tablet browsers need). The page rotation is applied, so a statement
 * printed on portrait pages turned 90 degrees reads left to right as on paper.
 *
 * pdf.js is loaded only when a PDF is opened (it is large), and in the browser its worker file is
 * served by Vite (the ?url import), so parsing never blocks the screen. In Node (tests) pdf.js runs
 * without a separate worker.
 *
 * Password-protected PDFs: pdf.js reports them; this throws PdfPasswordError so the screen can ask
 * for the password. The password is used once and never stored.
 */
import type { PdfPageText, PdfTextItem } from './pdfLayout';

export class PdfPasswordError extends Error {
  /** True when a password was given and it was wrong */
  readonly incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? 'The password is not correct.' : 'This PDF is protected with a password.');
    this.name = 'PdfPasswordError';
    this.incorrect = incorrect;
  }
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfJsPromise: Promise<PdfJs> | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      }
      return pdfjs;
    })();
    // A failed load (e.g. offline) may be retried later
    pdfJsPromise.catch(() => {
      pdfJsPromise = null;
    });
  }
  return pdfJsPromise;
}

interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
}

const isTextItem = (item: unknown): item is RawTextItem =>
  !!item && typeof item === 'object' && typeof (item as RawTextItem).str === 'string' && Array.isArray((item as RawTextItem).transform);

/** Every page's text items, positioned as the page is displayed (rotation applied, y from the top) */
export async function extractPdfPages(data: ArrayBuffer | Uint8Array, options: { password?: string } = {}): Promise<PdfPageText[]> {
  const pdfjs = await loadPdfJs();
  // pdf.js takes ownership of the bytes it is given: pass a copy so the caller's buffer stays usable
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  const task = pdfjs.getDocument({
    data: bytes,
    password: options.password,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0
  });
  try {
    const pdf = await task.promise;
    const pages: PdfPageText[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const raw of content.items) {
        if (!isTextItem(raw) || !raw.str.trim()) continue;
        const [a, b, , , x, y] = pdfjs.Util.transform(viewport.transform, raw.transform);
        items.push({ str: raw.str, x, y, width: raw.width, fontSize: Math.hypot(a, b) });
      }
      pages.push({ pageNumber, width: viewport.width, height: viewport.height, rotation: page.rotate, items });
      page.cleanup();
    }
    return pages;
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'PasswordException') {
      // pdf.js: code 1 = a password is needed, 2 = the password given is wrong
      throw new PdfPasswordError((error as { code?: number }).code === 2);
    }
    throw error;
  } finally {
    // Destroying the loading task also destroys the document and its worker port
    await task.destroy();
  }
}

/** True for content that starts like a PDF file */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}
