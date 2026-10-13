import { describe, expect, it } from 'vitest';
import { renderLetterPdf } from '../letterPdf';
import { buildConsentDocument } from '../../../utils/clinical/consent';
import { buildGeneralLetter, type LetterContext } from '../../../utils/clinical/letters';

// Invented practice, practitioner and patient; the real jsPDF draws the page
const ctx: LetterContext = {
  practice: {
    name: 'Example Family Practice',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: null,
    contactPhone: null,
    contactEmail: null,
    practiceNumber: null,
    primaryColor: '#123456'
  },
  author: { name: 'Dr A Example', title: null, hpcnaNumber: null },
  patient: { name: 'Maria Example' },
  letterDate: '2026-10-13'
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const pdfText = (doc: Parameters<typeof renderLetterPdf>[0]): string =>
  new TextDecoder('latin1').decode(renderLetterPdf(doc).output('arraybuffer') as ArrayBuffer);

describe('a signed consent form as a PDF', () => {
  it('embeds the signature drawn on the screen above the signature line, so the kept PDF is the signed form', () => {
    const doc = buildConsentDocument(
      { name: 'Consent to treatment', parts: { title: 'CONSENT TO TREATMENT', recipient: '', subject: '', greeting: '', body: 'I consent.' } },
      ctx,
      { signedBy: 'patient', signerName: 'Maria Example', image: PNG, signedAt: new Date('2026-10-13T08:42:00Z') }
    );
    const text = pdfText(doc);
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('(Signature:)');
    expect(text).not.toContain('(Signature:,)');
    expect(text).toContain('Signed on 13 October 2026 at 10:42');
  });

  it('leaves ordinary letters as they were: no image, "Kind regards," with its comma', () => {
    const text = pdfText(buildGeneralLetter({ toName: '', toEmail: '', subject: 'Fit to travel', body: 'Invented text.' }, ctx));
    expect(text).not.toContain('/Subtype /Image');
    expect(text).toContain('(Kind regards,)');
  });
});
