import { describe, expect, it } from 'vitest';
import type { DentalLabOrder } from '../../../utils/dental/labOrderRecords';
import { dentalLabSlipHtml } from '../labSlipPrint';

const practice = { name: 'Rehearsal Dental', phone: '061 000 000', address: '1 Test Street, Windhoek', practiceNumber: '0540000000001' };
const order: DentalLabOrder = {
  id: 'o-1',
  orderNo: 12,
  patientId: 'p-1',
  visitId: null,
  visitDate: null,
  billedVisitId: null,
  billedVisitDate: null,
  status: 'sent',
  statusOn: '2026-10-07',
  sentOn: '2026-10-07',
  dueOn: '2026-10-14',
  supplierId: 's-1',
  labName: 'Alpha Dental Lab',
  workType: 'crown',
  teeth: ['11'],
  jaw: null,
  shade: 'A2',
  notes: 'Metal collar <lingual> only',
  slipNumber: null,
  slipLines: [],
  createdBy: 'Dr Test Practitioner',
  events: []
};

// Business rule: the lab makes the work from the slip alone, so it carries the work, the teeth (named, so 11 and 21
// cannot be mixed up), the shade, the dates and the notes; once the lab's invoice is in, its lines and the 8099 total
describe('the dental lab slip', () => {
  it('prints what the lab needs, day-first dates and the practitioner who ordered', () => {
    const html = dentalLabSlipHtml(practice, { name: 'Alex Tester', dateOfBirth: null }, order);
    expect(html).toContain('Lab order 12');
    expect(html).toContain('Crown');
    expect(html).toContain('11 (upper right central incisor)');
    expect(html).toContain('A2');
    expect(html).toContain('7 Oct 2026');
    expect(html).toContain('14 Oct 2026');
    expect(html).toContain('Alpha Dental Lab');
    expect(html).toContain('Dr Test Practitioner');
    expect(html).not.toContain("The lab's invoice");
  });

  it('escapes what was typed', () => {
    const html = dentalLabSlipHtml(practice, { name: 'Alex <b>Tester</b>', dateOfBirth: null }, order);
    expect(html).toContain('Metal collar &lt;lingual&gt; only');
    expect(html).toContain('Alex &lt;b&gt;Tester&lt;/b&gt;');
  });

  it('prints the lab\'s invoice lines with the total billed under 8099', () => {
    const html = dentalLabSlipHtml(practice, { name: 'Alex Tester', dateOfBirth: null }, {
      ...order,
      status: 'received',
      slipNumber: 'LS-4471',
      slipLines: [
        { code: '9330', description: 'Porcelain fused to metal crown', amountCents: 185000 },
        { code: null, description: 'Model and die', amountCents: 12000 }
      ]
    });
    expect(html).toContain("The lab's invoice LS-4471");
    expect(html).toContain('N$ 1,850.00');
    expect(html).toContain('N$ 120.00');
    expect(html).toContain('Total, billed under 8099');
    expect(html).toContain('N$ 1,970.00');
    expect(html).toContain('Back from the lab');
  });
});
