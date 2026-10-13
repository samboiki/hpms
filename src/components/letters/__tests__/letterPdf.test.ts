import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReferralLetter, type LetterContext } from '../../../utils/clinical/letters';

// A jsPDF stand-in that records what is drawn on which page: nothing is written to disk
const { drawn } = vi.hoisted(() => ({ drawn: [] as { page: number; text: string }[] }));
vi.mock('jspdf', () => {
  class FakePdf {
    pages = 1;
    current = 1;
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    getNumberOfPages() {
      return this.pages;
    }
    text(value: string | string[]) {
      (Array.isArray(value) ? value : [value]).forEach(text => drawn.push({ page: this.current, text }));
    }
    splitTextToSize(value: string, width: number) {
      const perLine = Math.max(1, Math.floor(width * 0.6));
      const lines: string[] = [];
      for (let start = 0; start < value.length; start += perLine) lines.push(value.slice(start, start + perLine));
      return lines.length ? lines : [''];
    }
    addPage() {
      this.pages += 1;
      this.current = this.pages;
    }
    setPage(page: number) {
      this.current = page;
    }
    output() {
      return 'data:application/pdf;filename=generated.pdf;base64,JVBERi0xLjM=';
    }
    setFillColor() {}
    rect() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    save() {}
  }
  return { default: FakePdf, jsPDF: FakePdf };
});

import { letterPdfBase64, renderLetterPdf } from '../letterPdf';

// Invented practice, practitioner and patient
const ctx: LetterContext = {
  practice: {
    name: 'Example Family Practice',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: null,
    contactPhone: '061 000 0000',
    contactEmail: null,
    practiceNumber: '0000000',
    primaryColor: '#123456'
  },
  author: { name: 'Dr A Example', title: null, hpcnaNumber: 'MP 00000' },
  patient: { name: 'Ndapewa Shilongo', dateOfBirth: '1990-05-14', idNumber: null },
  letterDate: '2026-10-07',
  medicines: [],
  allergies: ['Penicillin (severe: anaphylaxis)'],
  problems: []
};

const referral = (history = '') =>
  buildReferralLetter(
    {
      toName: 'Dr M Example',
      toPractice: '',
      toSpecialty: 'Cardiology',
      toEmail: '',
      urgency: 'routine',
      reason: 'Blood pressure not controlled.',
      history,
      includeDiagnosis: false,
      includeMedicines: false,
      includeAllergies: true,
      includeProblems: false,
      validUntil: ''
    },
    ctx
  );

beforeEach(() => {
  drawn.length = 0;
});

describe('renderLetterPdf', () => {
  it('prints the letterhead, the patient, the reason, the allergies and the signature', () => {
    renderLetterPdf(referral());
    const text = drawn.map(item => item.text).join('\n');
    expect(text).toContain('Example Family Practice');
    expect(text).toContain('REFERRAL LETTER');
    expect(text).toContain('7 October 2026');
    expect(text).toContain('Re: Ndapewa Shilongo (born 14 May 1990)');
    expect(text).toContain('Dear Dr M Example,');
    expect(text).toContain('Penicillin (severe: anaphylaxis)');
    expect(text).toContain('Dr A Example');
    expect(text).toContain('HPCNA no: MP 00000');
  });

  it('runs onto more pages for a long history and numbers every page, with the letterhead on each', () => {
    renderLetterPdf(referral('Long history. '.repeat(400)));
    const pages = Math.max(...drawn.map(item => item.page));
    expect(pages).toBeGreaterThan(1);
    for (let page = 1; page <= pages; page += 1) {
      expect(drawn).toContainEqual({ page, text: `Page ${page} of ${pages}` });
      expect(drawn).toContainEqual({ page, text: 'Example Family Practice' });
    }
  });

  it('gives the PDF as plain base64 for an email attachment', () => {
    expect(letterPdfBase64(renderLetterPdf(referral()))).toBe('JVBERi0xLjM=');
  });
});
