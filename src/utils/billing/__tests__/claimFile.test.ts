import { describe, it, expect } from 'vitest';
import {
  buildClaimFile,
  claimFileName,
  detailFields,
  headerFields,
  parseClaimFile,
  sanitizeField,
  trailerFields,
  DETAIL_FIELD_COUNT,
  DETAIL_FIELD_NAMES,
  HEADER_FIELD_COUNT,
  TRAILER_EMPTY_FIELDS,
  type ClaimFileHeader
} from '../claimFile';
import type { ClaimLine } from '../claimLine';
import { REAL_PRICES, intBetween, pick, seededRandom } from './generators';

const header: ClaimFileHeader = {
  practiceNumber: '0540001133241',
  batchNumber: 38,
  batchDate: '2026-10-06',
  fundReference: 'NHPM',
  systemIdentification: 1,
  transactionType: 'D',
  sourceSoftware: null,
  sourceSoftwareVersion: null
};

const line = (overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: 'k1',
  transactionNumber: 1,
  systemTransactionNumber: 50123,
  invoiceId: 'inv-1',
  invoiceNumber: '417',
  visitId: 'v-1',
  fundReference: 'NHPM',
  membershipNumber: '12345678901',
  memberSurname: 'Shilongo',
  memberInitials: 'e.m.',
  patientName: 'Elisabeth Shilongo',
  patientDateOfBirth: '1990-05-17',
  patientIdNumber: '90051700123',
  patientReference: '1234',
  gender: 'female',
  tariffCode: '8101',
  description: 'Full mouth examination, charting and treatment planning',
  serviceDate: '2026-09-20',
  quantity: 1,
  amount: 254.7,
  unitPrice: 254.7,
  practiceNumber: '0540001133241',
  treatingDoctorHpcnaNumber: 'DEN00417',
  icd10Primary: 'z012',
  icd10Secondary: ['K02.1'],
  icd10Confirmed: true,
  toothNumbers: '36',
  ...overrides
});

// Business rule: the claim file must have exactly the layout the funds accepted from the practice's
// previous accredited software (format 1.6): a 9-field header, 53-field detail records and a trailer.
// One field too many or too few shifts every later value (e.g. the ID number lands in the wrong
// column) and the whole batch is rejected.
describe('field positions of a detail record', () => {
  const fields = detailFields(line());
  const expected: Array<[number, string]> = [
    [1, 'D'], [2, '1'], [3, '50123'], [4, '0001234'], [5, 'T'], [6, 'NHPM'], [7, ''], [8, '12345678901'],
    [9, 'SHILONGO'], [10, 'EM'], [11, 'ELISABETH SHILONGO'], [12, '19900517'], [13, '8101'], [14, '254.70'],
    [15, 'Full mouth examination chartin'], [16, '0.00'], [17, '20260920'], [18, '1.00'], [19, '7'],
    [20, ''], [21, ''], [22, ''], [23, ''], [24, '417'], [25, ''], [26, ''], [27, ''], [28, ''],
    [29, '0540001133241'], [30, ''], [31, ''], [32, ''], [33, 'Z01.2'], [34, 'D'], [35, ''], [36, 'DEN00417'],
    [37, '36'], [38, 'F'], [39, 'T'], [40, ''], [41, ''], [42, ''], [43, ''], [44, ''], [45, ''], [46, ''],
    [47, ''], [48, '90051700123'], [49, ''], [50, ''], [51, ''], [52, ''], [53, '']
  ];

  it('has 53 fields and 53 field names', () => {
    expect(fields).toHaveLength(DETAIL_FIELD_COUNT);
    expect(DETAIL_FIELD_NAMES).toHaveLength(DETAIL_FIELD_COUNT);
  });

  it.each(expected)('field %i', (position, value) => {
    expect(fields[position - 1]).toBe(value);
  });

  it('passes stored optional fields through to their own columns', () => {
    const withExtras = detailFields(line({
      authorisationNumber: 'AUTH-77',
      resubmissionFlag: 'R',
      extra: { modifier1: '0009', nappiCode: '7012345', discountAmount: 12.5, serviceFee: 8, dateOfInjury: '2026-09-19', placeOfService: '11' }
    }));
    expect(withExtras[19]).toBe('0009');
    expect(withExtras[25]).toBe('7012345');
    expect(withExtras[15]).toBe('12.50');
    expect(withExtras[18]).toBe('8');
    expect(withExtras[30]).toBe('AUTH-77');
    expect(withExtras[31]).toBe('R');
    expect(withExtras[41]).toBe('11');
    expect(withExtras[51]).toBe('20260919');
  });
});

describe('header and trailer', () => {
  it('writes the header with the batch number (also in the file name), date and format 1.6', () => {
    expect(headerFields(header)).toEqual(['1', '0540001133241', '1', 'D', '38', '20261006', 'ONEHEALTH', '01.00.00', '1.6']);
    expect(headerFields(header)).toHaveLength(HEADER_FIELD_COUNT);
    expect(headerFields({ ...header, systemIdentification: null, transactionType: '', sourceSoftware: 'HPMS', sourceSoftwareVersion: '02.01.00' }))
      .toEqual(['1', '0540001133241', '1', 'D', '38', '20261006', 'HPMS', '02.01.00', '1.6']);
    expect(claimFileName(header)).toBe('0540001133241_38_NHPM.Dat');
  });

  it('writes the trailer as Z, line count, plain total and 22 empty fields', () => {
    const trailer = trailerFields(114, 2365241);
    expect(trailer.slice(0, 3)).toEqual(['Z', '114', '23652.41']);
    expect(trailer).toHaveLength(3 + TRAILER_EMPTY_FIELDS);
    expect(trailer.join(',')).toBe(`Z,114,23652.41${','.repeat(22)}`);
  });
});

// Business rule: whatever staff typed (commas in descriptions, accents in names, line breaks in
// notes) can never add, remove or break a field, and the file is plain ASCII with CRLF line ends.
describe('generated files are always well-formed', () => {
  const random = seededRandom(1610);
  const nasty = ['Extraction, surgical', 'Müller-Ñandú', 'line\r\nbreak', 'tab\there', 'quote "x"', 'emoji-free text', ''];
  const batches = Array.from({ length: 250 }, (_, batchIndex) => {
    const count = intBetween(random, 1, 25);
    const lines = Array.from({ length: count }, (_, index) => {
      const unit = pick(random, REAL_PRICES.filter(price => Number.isInteger(Math.round(price * 100 * 1000) / 1000)));
      const quantity = intBetween(random, 1, 5);
      return line({
        key: `b${batchIndex}-l${index}`,
        transactionNumber: count - index,
        systemTransactionNumber: 1000 + batchIndex * 100 + index,
        description: pick(random, nasty),
        memberSurname: pick(random, ['Shilongo', 'Müller', "O'Neil", 'van der Merwe']),
        patientName: pick(random, nasty),
        quantity,
        amount: Math.round(unit * 100) * quantity / 100,
        icd10Primary: pick(random, ['J06.9', 'k021', 'I10', '']),
        toothNumbers: pick(random, ['', '11', '48', '85'])
      });
    });
    return { batchIndex, lines };
  });

  it.each(batches)('batch $batchIndex', ({ lines }) => {
    const file = buildClaimFile(header, lines);
    expect(file.content.endsWith('\r\n')).toBe(true);
    expect(/^[\x20-\x7E\r\n]*$/.test(file.content)).toBe(true);
    const records = file.content.slice(0, -2).split('\r\n');
    expect(records).toHaveLength(lines.length + 2);
    expect(records.every(record => !record.includes('\n') && !record.includes('\r'))).toBe(true);

    const parsed = parseClaimFile(file.content);
    expect(parsed.unknown).toEqual([]);
    expect(parsed.header).toHaveLength(HEADER_FIELD_COUNT);
    expect(parsed.details).toHaveLength(lines.length);
    parsed.details.forEach(fields => {
      expect(fields).toHaveLength(DETAIL_FIELD_COUNT);
      expect(fields[13]).toMatch(/^\d+\.\d{2}$/);
      expect(fields[17]).toMatch(/^\d+\.\d{2}$/);
      expect(fields[3]).toMatch(/^\d{7}$/);
      expect(fields[11]).toMatch(/^\d{8}$/);
      expect(fields[16]).toMatch(/^\d{8}$/);
      expect(fields[14].length).toBeLessThanOrEqual(30);
    });
    // Lines are written in line-number order
    expect(parsed.details.map(fields => Number(fields[1]))).toEqual([...lines.map(l => l.transactionNumber)].sort((a, b) => a - b));
    // The trailer counts the lines and its total equals the sum of the line amounts, to the cent
    const sumCents = parsed.details.reduce((sum, fields) => sum + Math.round(Number(fields[13]) * 100), 0);
    expect(parsed.trailer?.slice(0, 3)).toEqual(['Z', String(lines.length), (sumCents / 100).toFixed(2)]);
    expect(file.totalCents).toBe(sumCents);
    expect(file.lineCount).toBe(lines.length);
  });
});

describe('cleaning field values', () => {
  it.each([
    { input: 'Extraction, surgical', output: 'Extraction surgical' },
    { input: 'Müller', output: 'Muller' },
    { input: '  two   spaces  ', output: 'two spaces' },
    { input: 'line\nbreak', output: 'line break' },
    { input: 'quote "x"', output: 'quote x' },
    { input: 'naïve café', output: 'naive cafe' },
    { input: 'ok nbsp', output: 'ok nbsp' },
    { input: null, output: '' },
    { input: undefined, output: '' },
    { input: 42, output: '42' }
  ])('$input', ({ input, output }) => {
    expect(sanitizeField(input)).toBe(output);
  });

  it('cuts descriptions to 30 characters without a trailing space', () => {
    expect(sanitizeField('Full mouth examination, charting and treatment planning', 30)).toBe('Full mouth examination chartin');
    expect(sanitizeField('Intra-oral radiographs per film X', 30)).toBe('Intra-oral radiographs per fil');
    expect(sanitizeField('Twenty-nine characters here!! x', 30)).toBe('Twenty-nine characters here!!');
  });

  it('normalises dates written in other formats and keeps unknown values empty', () => {
    const fields = detailFields(line({ serviceDate: '2026-09-20T08:30:00+02:00', patientDateOfBirth: '19900517' }));
    expect(fields[16]).toBe('20260920');
    expect(fields[11]).toBe('19900517');
    expect(detailFields(line({ serviceDate: 'not a date' }))[16]).toBe('');
  });

  it('writes the gender as M/F and leaves an unknown gender empty for validation to catch', () => {
    expect(detailFields(line({ gender: 'Male' }))[37]).toBe('M');
    expect(detailFields(line({ gender: 'unknown' }))[37]).toBe('');
  });

  it('writes 0 when the system transaction number is missing, as the database function did', () => {
    expect(detailFields(line({ systemTransactionNumber: null }))[2]).toBe('0');
  });
});
