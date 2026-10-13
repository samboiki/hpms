import { describe, expect, it } from 'vitest';
import { labOrderSlipHtml, prescriptionSlipHtml } from '../slips';
import { toLabOrder, toPrescription } from '../../../utils/optometry/records';

const practice = { name: 'Test Optometrists <Windhoek>', phone: '061 000 000', address: '1 Test Street, Windhoek', practiceNumber: '0000000' };
const patient = { name: 'Test & Patient', dateOfBirth: '1980-05-17' };
const rx = toPrescription({
  id: 'rx', patient_id: 'p', kind: 'spectacles', prescribed_on: '2026-10-08', valid_until: '2028-10-08',
  r_sphere: '-1.25', r_cylinder: '-0.50', r_axis: 90, r_add: '2.00', l_sphere: '0', l_add: '2.00',
  recorder: { full_name: 'Optometrist A', hpcsa_number: 'OPT00001' }
});

// Business rule: the patient takes the printed prescription to any optical shop; it must carry both eyes, the date,
// how long it is valid and the registered practitioner, and print a name exactly as typed (never as page markup)
describe('the printed prescription', () => {
  const html = prescriptionSlipHtml(practice, patient, rx);

  it('carries the practice, the patient, both eyes, the dates and the practitioner\'s registration', () => {
    expect(html).toContain('Spectacles prescription');
    expect(html).toContain('8 Oct 2026');
    expect(html).toContain('Valid until</dt><dd>8 Oct 2028');
    expect(html).toContain('-1.25');
    expect(html).toContain('Plano');
    expect(html).toContain('+2.00');
    expect(html).toContain('HPCNA OPT00001');
    expect(html).toContain('17 May 1980');
  });

  it('escapes names, so a typed "<" or "&" cannot change the page', () => {
    expect(html).toContain('Test Optometrists &lt;Windhoek&gt;');
    expect(html).toContain('Test &amp; Patient');
    expect(html).not.toContain('<Windhoek>');
  });
});

describe('the lab order slip', () => {
  it('gives the lab only the eye ordered, with its measurements, lens and tint', () => {
    const order = toLabOrder({
      id: 'o', order_no: 7, status: 'ordered', ordered_on: '2026-10-08', eyes: 'right', lens_type: 'multifocal', material: 'polycarbonate',
      coatings: ['anti_reflective', 'tint'], tint_percent: 35, tint_colour: 'grey', pd_right: '31.5', height_right: '18', frame_note: 'Own frame',
      supplier: { name: 'Lab One' }
    });
    const html = labOrderSlipHtml(practice, patient, order, rx);
    expect(html).toContain('Lab order 7');
    expect(html).toContain('Right eye only');
    expect(html).toContain('31.5 mm');
    expect(html).toContain('18.0 mm');
    expect(html).toContain('35 % grey');
    expect(html).toContain('Lab One');
    // The left eye's row is not on a right-eye order
    expect(html.match(/<td><strong>L<\/strong><\/td>/g)).toBeNull();
  });
});
