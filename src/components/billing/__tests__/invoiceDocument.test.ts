import { describe, expect, it } from 'vitest';
import { benchmarkStatement, buildInvoiceDocument, memberNameOf, missingRuleEight, type InvoiceDocumentInput, type InvoiceDocumentLine } from '../invoiceDocument';
import { renderInvoicePdf } from '../invoicePdf';

const line = (overrides: Partial<InvoiceDocumentLine> = {}): InvoiceDocumentLine => ({
  id: 'l1',
  serviceDate: '2026-10-07',
  code: '8341',
  description: 'Amalgam, one surface',
  icd10: ['K02.1'],
  teeth: ['16'],
  quantity: 1,
  unitPrice: 500.1,
  discount: 0,
  total: 500.1,
  medicalAid: 475.09,
  patient: 25.01,
  practitionerId: null,
  ...overrides
});

// Invented practice and people: no real records in tests
const input = (overrides: Partial<InvoiceDocumentInput> = {}): InvoiceDocumentInput => ({
  invoice: { id: 'inv-1', invoiceNumber: 'INV-000123', issueDate: '2026-10-07', dueDate: '2026-11-06', paymentStatus: 'pending', practitionerId: 'doc-1' },
  practice: {
    id: 'p1',
    name: 'Example Dental Studio',
    contactPhone: '061 000 000',
    contactEmail: 'desk@example.na',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: '9000',
    practiceNumber: '0540000001',
    licenseNumber: null,
    taxNumber: '0000000-01-5',
    primaryColor: '#30b4be',
    bankName: 'Example Bank',
    accountNumber: '00000000000',
    branchCode: '280172',
    practiceType: 'dental'
  },
  patient: { firstName: 'Ndapewa Maria', lastName: 'Example', dateOfBirth: '2015-04-02', phone: null, email: null },
  medicalAid: {
    fundName: 'PSEMAS',
    fundReference: 'MAG1',
    membershipNumber: '12345678901',
    planOption: null,
    mainMemberName: 'Johannes Petrus Example',
    relationshipToMain: 'child',
    dependantCode: '02'
  },
  visit: { date: '2026-10-07', practitionerId: 'doc-1' },
  practitioners: [{ id: 'doc-1', fullName: 'Anna Tester', role: 'doctor', hpcnaNumber: 'DEN00001' }],
  lines: [line(), line({ id: 'l2', code: '8109', description: 'Infection control', teeth: [], icd10: ['Z01.2'], unitPrice: 25, total: 25, medicalAid: 23.75, patient: 1.25 })],
  offBenchmarkCodes: [],
  ...overrides
});

describe('the printed invoice (NAMAF rule 008)', () => {
  const doc = buildInvoiceDocument(input());
  const everything = [
    doc.title,
    doc.number,
    ...doc.meta,
    doc.practiceName,
    ...doc.practiceLines,
    ...doc.blocks.flatMap(block => [block.heading, ...block.lines]),
    ...doc.rows.flatMap(row => Object.values(row)),
    ...doc.totals.flatMap(total => [total.label, total.value]),
    ...doc.statements
  ].join('\n');

  // Each of these is a reason a fund or patient can refuse the account
  it('carries the practice name and number, and the treating practitioner with the HPCNA number', () => {
    expect(doc.practiceName).toBe('Example Dental Studio');
    expect(doc.practiceLines[0]).toBe('Practice no 0540000001');
    expect(everything).toContain('Dr. Anna Tester (HPCNA DEN00001)');
  });

  // A child is claimed under the main member: surname and initials of the member, then the patient's own name
  it('names the main member by surname and initials, then the patient with the dependant code', () => {
    expect(everything).toContain('Main member: EXAMPLE, JP');
    expect(doc.blocks[0].lines.slice(0, 2)).toEqual(['Ndapewa Maria Example', 'Dependant code 02']);
    expect(everything).toContain('Fund: PSEMAS (MAG1)');
    expect(everything).toContain('Membership no: 12345678901');
  });

  it('shows per line the date, ICD-10, code, tooth (dental), quantity, unit price and amount', () => {
    expect(doc.columns.tooth).toBe(true);
    expect(doc.rows[0]).toMatchObject({ date: '7 Oct 2026', code: '8341', icd10: 'K02.1', tooth: '16', quantity: '1', unitPrice: 'N$ 500.10', total: 'N$ 500.10' });
  });

  it('shows what the fund pays and what the patient pays, adding up to the total', () => {
    expect(doc.totals).toEqual([
      { label: 'Invoice total', value: 'N$ 525.10', bold: true },
      { label: 'Medical aid pays (MAG1)', value: 'N$ 498.84' },
      { label: 'Patient pays', value: 'N$ 26.26', bold: true }
    ]);
    expect(doc.rows[0]).toMatchObject({ medicalAid: 'N$ 475.09', patient: 'N$ 25.01' });
  });

  it('states whether the fees follow the NAMAF benchmark tariff', () => {
    expect(doc.statements[0]).toBe('Fees: charged at the NAMAF benchmark tariff (dental).');
    expect(benchmarkStatement(['8341'], 'dental')).toBe(
      "Fees: code 8341 is charged at the fund's or an agreed rate, not the NAMAF benchmark tariff (dental); the other codes at the benchmark tariff."
    );
    expect(benchmarkStatement(null, null)).toBe('Fees: not compared with the NAMAF benchmark tariff.');
  });

  // Privacy: an account is not a clinical record
  it('never prints clinical notes such as the chief complaint', () => {
    expect(everything).not.toMatch(/complaint/i);
  });

  it('is complete under rule 008 when every field is there', () => {
    expect(doc.missing).toEqual([]);
  });

  // A GP or specialist does not bill teeth: no empty tooth column on their accounts
  it('has no tooth column outside dental practices and no fund columns for a private patient', () => {
    const gp = buildInvoiceDocument(input({ practice: { ...input().practice, practiceType: 'General Practitioner' }, medicalAid: null }));
    expect(gp.columns).toEqual({ tooth: false, discount: false, portions: false });
    expect(gp.blocks[1].lines).toEqual(['Private patient: no medical aid on file']);
    expect(gp.totals.map(total => total.label)).toEqual(['Invoice total', 'Patient pays']);
  });

  it('lists every treating practitioner when a line was done by someone else', () => {
    const shared = buildInvoiceDocument(
      input({
        practitioners: [...input().practitioners, { id: 'nurse-1', fullName: 'Ben Helper', role: 'nurse', hpcnaNumber: 'RN0002' }],
        lines: [line(), line({ id: 'l3', practitionerId: 'nurse-1' })]
      })
    );
    expect(shared.blocks[2]).toEqual({ heading: 'Treating practitioners', lines: ['Dr. Anna Tester (HPCNA DEN00001)', 'Ben Helper (HPCNA RN0002)'] });
  });

  it('shows a discount column and the discount given only when there is one', () => {
    const discounted = buildInvoiceDocument(input({ medicalAid: null, lines: [line({ discount: 50, total: 450.1, medicalAid: 0, patient: 450.1 })] }));
    expect(discounted.columns.discount).toBe(true);
    expect(discounted.totals[0]).toEqual({ label: 'Discount given', value: 'N$ 50.00' });
  });
});

describe('details carried over from the earlier invoice template', () => {
  // A patient pays into the account printed on the invoice: it must be the practice's own, never an example
  it("prints only the practice's own bank details, and none when they are not set", () => {
    expect(buildInvoiceDocument(input()).footerRight).toEqual(['Example Bank, account 00000000000, branch 280172', 'Pay with reference INV-000123']);
    expect(buildInvoiceDocument(input({ practice: { ...input().practice, bankName: null, accountNumber: null } })).footerRight).toEqual([]);
  });

  // A reprint must show the same due date as the original, not 30 days from the day it is printed
  it('shows the dates stored on the invoice', () => {
    expect(buildInvoiceDocument(input()).meta).toEqual(['Date: 7 Oct 2026', 'Due: 6 Nov 2026']);
  });

  it('marks a paid, part-paid or cancelled invoice on its face', () => {
    expect(buildInvoiceDocument(input({ invoice: { ...input().invoice, paymentStatus: 'paid' } })).statusLabel).toBe('PAID');
    expect(buildInvoiceDocument(input({ invoice: { ...input().invoice, paymentStatus: 'partial' } })).statusLabel).toBe('PART PAID');
    expect(buildInvoiceDocument(input()).statusLabel).toBeNull();
  });
});

describe('what an invoice lacks under rule 008', () => {
  it('names each missing field and where to fix it', () => {
    const gaps = missingRuleEight(
      input({
        practice: { ...input().practice, practiceNumber: null },
        practitioners: [{ id: 'doc-1', fullName: 'Anna Tester', role: 'doctor', hpcnaNumber: '' }],
        medicalAid: { ...input().medicalAid!, membershipNumber: ' ', mainMemberName: null },
        lines: [line({ icd10: [] })],
        offBenchmarkCodes: null
      })
    );
    expect(gaps).toEqual([
      "The practice number is missing: add it to the practice's details.",
      'Dr. Anna Tester has no HPCNA number on record: add it under Settings > Users.',
      "The main member's name is missing: add it to the patient's medical aid details.",
      'The membership number is missing.',
      "No ICD-10 code for 8341: add it on the line in the visit's Billing tab.",
      'The fees could not be compared with the NAMAF benchmark tariff (the tariff list could not be read).'
    ]);
  });

  it('asks for a treating practitioner when none is recorded', () => {
    expect(missingRuleEight(input({ invoice: { ...input().invoice, practitionerId: null }, visit: null }))).toContain(
      'No treating practitioner is recorded: choose one on the visit.'
    );
  });

  it('takes the main member from the patient when the patient is the member', () => {
    expect(memberNameOf({ patient: { firstName: 'Anna Maria', lastName: 'Tester', dateOfBirth: null, phone: null, email: null }, medicalAid: { ...input().medicalAid!, relationshipToMain: 'self' } })).toEqual({
      surname: 'TESTER',
      initials: 'AM'
    });
  });
});

describe('the invoice PDF', () => {
  // Rule 008 accounts must be readable by people and machines: a screenshot PDF has no text layer
  it('is a text PDF: the practice number, member, codes and amounts are real text', () => {
    const pdf = renderInvoicePdf(buildInvoiceDocument(input()));
    const raw = new TextDecoder('latin1').decode(pdf.output('arraybuffer'));
    expect(raw.startsWith('%PDF-')).toBe(true);
    for (const text of ['Practice no 0540000001', 'INV-000123', 'Main member: EXAMPLE, JP', 'K02.1', '8341', 'N$ 525.10', 'NAMAF benchmark']) {
      expect(raw).toContain(text);
    }
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);
  });

  // Parity D1: a line's narrative (what staff wrote for it on the visit's Billing tab) is printed under the line, so the
  // patient and the fund read it with the service it explains; a line without one prints as before
  it("prints a line's narrative under its description, as real text", () => {
    const doc = buildInvoiceDocument(input({ lines: [line({ narrative: '  After-hours call-out ' }), line({ id: 'l2', narrative: null })] }));
    expect(doc.rows.map(row => row.description)).toEqual(['Amalgam, one surface\nAfter-hours call-out', 'Amalgam, one surface']);
    const raw = new TextDecoder('latin1').decode(renderInvoicePdf(doc).output('arraybuffer'));
    expect(raw).toContain('After-hours call-out');
  });

  it('runs onto more pages with the header and page numbers for long accounts', () => {
    const lines = Array.from({ length: 70 }, (_, index) => line({ id: `l${index}`, code: String(8100 + (index % 50)) }));
    const pdf = renderInvoicePdf(buildInvoiceDocument(input({ lines })));
    const pages = pdf.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    const raw = new TextDecoder('latin1').decode(pdf.output('arraybuffer'));
    expect(raw).toContain(`Page ${pages} of ${pages}`);
  });
});

// Parity D8: the patient and the fund must see why a line is all the patient's, and the authorisation the claim carries
describe("the patient's own lines on the printed invoice", () => {
  it('marks a line the patient pays all of, says it is not claimed, and prints its authorisation number', () => {
    const doc = buildInvoiceDocument(
      input({
        lines: [
          line({ id: 'own', code: '9901', description: 'Whitening', medicalAid: 0, patient: 500.1, paidBy: 'patient' }),
          line({ id: 'auth', authorisationNumber: 'PA-77' })
        ]
      })
    );
    expect(doc.rows.find(row => row.code === '9901')?.description).toBe('Whitening\nPatient pays this line: not claimed from the medical aid');
    expect(doc.rows.find(row => row.code === '8341')?.description).toBe('Amalgam, one surface\nAuthorisation PA-77');
    expect(doc.statements).toEqual(expect.arrayContaining([expect.stringMatching(/not claimed from the medical aid: they are payable by the main member/)]));
  });

  it('prints neither for a private patient, whose lines are all theirs anyway', () => {
    const doc = buildInvoiceDocument(input({ medicalAid: null, lines: [line({ paidBy: 'patient', authorisationNumber: 'PA-77' })] }));
    expect(doc.rows[0].description).toBe('Amalgam, one surface');
    expect(doc.statements.join(' ')).not.toMatch(/not claimed/);
  });
});

// Parity D5: NAMAF and the funds read a filling by its tooth and surfaces, and a code billed per quadrant by its
// quadrant; the account says the same as the claim ("Tooth 46, MO")
describe('teeth, surfaces and quadrants on the printed invoice', () => {
  it('prints the surfaces of a filling with its tooth, and the quadrant of a code billed per quadrant', () => {
    const doc = buildInvoiceDocument(
      input({ lines: [line({ code: '8368', teeth: ['46'], surfaces: 'MO' }), line({ id: 'l2', code: '8182', teeth: [], quadrant: 1 })] })
    );
    expect(doc.rows.map(row => [row.code, row.tooth])).toEqual([['8368', '46, MO'], ['8182', 'Q1']]);
  });
});

// Parity D31: when partners treat a patient together, the account names who treated each line and the practice
// number each partner bills under, as the claim does (field 29)
describe('several practitioners on one invoice', () => {
  it("names who treated each line, and a partner's own practice number", () => {
    const doc = buildInvoiceDocument(
      input({
        practitioners: [
          ...input().practitioners,
          { id: 'partner-1', fullName: 'Bea Partner', role: 'doctor', hpcnaNumber: 'DEN00002', ownPracticeNumber: '0999888777666' }
        ],
        lines: [line(), line({ id: 'l3', practitionerId: 'partner-1' })]
      })
    );
    expect(doc.blocks[2].lines).toEqual(['Dr. Anna Tester (HPCNA DEN00001)', 'Dr. Bea Partner (HPCNA DEN00002), bills under practice no 0999888777666']);
    expect(doc.rows.map(row => row.description.split('\n')[1])).toEqual(['Treated by Dr. Anna Tester', 'Treated by Dr. Bea Partner']);
  });

  it('adds nothing to the lines when one practitioner treated them all', () => {
    expect(buildInvoiceDocument(input()).rows.every(row => !row.description.includes('Treated by'))).toBe(true);
  });
});

describe('discounts and the practice message on the invoice (parity D19, D22)', () => {
  // Invented: the patient was charged N$ 26.26 on this medical aid invoice and got 10% off it
  const discounted = buildInvoiceDocument(input({ discounts: [{ number: 'DS-000001', amountCents: 263, percent: 10, reason: 'Pensioner' }] }));

  it('shows the discount after what the patient pays, and what the patient pays after it, while the fund total is unchanged', () => {
    const labels = discounted.totals.map(total => `${total.label} ${total.value}`);
    expect(labels).toContain('Medical aid pays (MAG1) N$ 498.84');
    expect(labels).toContain('Patient pays N$ 26.26');
    expect(labels).toContain('Discount DS-000001 -N$ 2.63');
    expect(labels).toContain('Patient pays after discount N$ 23.63');
  });

  it('says what the discount was for and that the medical aid claim is not changed by it', () => {
    expect(discounted.statements).toContain('Discount DS-000001 of 10%: Pensioner.');
    expect(discounted.statements.some(statement => statement.includes('The medical aid is claimed for its portion as billed'))).toBe(true);
    // The claim lines themselves keep their amounts
    expect(discounted.rows.map(row => row.medicalAid)).toEqual(['N$ 475.09', 'N$ 23.75']);
  });

  it('prints nothing about discounts on an invoice without one', () => {
    const plain = buildInvoiceDocument(input());
    expect(plain.totals.map(total => total.label)).not.toContain('Patient pays after discount');
    expect(plain.statements.join(' ')).not.toContain('Discount');
  });

  it("prints the practice's message only when the practice chose invoices for it", () => {
    const settings = { message: 'Accounts are payable within 30 days.', printOn: { invoice: true, quote: false, statement: true }, leaveSettledOff: false };
    const onInvoices = buildInvoiceDocument(input({ practice: { ...input().practice, documentSettings: settings } }));
    expect(onInvoices.statements).toContain('Accounts are payable within 30 days.');
    const notOnInvoices = buildInvoiceDocument(input({ practice: { ...input().practice, documentSettings: { ...settings, printOn: { invoice: false, quote: true, statement: true } } } }));
    expect(notOnInvoices.statements).not.toContain('Accounts are payable within 30 days.');
  });

  it('still draws as a text PDF with the extra totals rows', () => {
    expect(() => renderInvoicePdf(discounted)).not.toThrow();
  });
});

// A14, A19: an invoice billed to the patient's employer or to the compensation fund is the account's to pay and is not
// claimed from the medical aid; it must say who pays and carry the case details the fund asks for (claim number)
describe('an invoice billed to a company or fund account', () => {
  const billedTo = {
    name: "Employees' Compensation Fund (Social Security Commission)",
    accountNumber: 'AC-0002',
    postalAddress: 'Private Bag 1\nWindhoek',
    caseTitle: 'Injury on duty, 1 Oct 2026',
    caseDetails: 'Employer Test Builders, employee no E-17, claim no ECF/2026/9'
  };
  const lines = [line({ medicalAid: 0, patient: 500.1, paidBy: 'patient' })];

  it('names the account and the case in place of the medical aid, and the account as who pays', () => {
    const doc = buildInvoiceDocument(input({ billedTo, lines }));
    const block = doc.blocks.find(item => item.heading === 'Billed to');
    expect(block?.lines).toEqual([
      "Employees' Compensation Fund (Social Security Commission) (account AC-0002)",
      'Private Bag 1',
      'Windhoek',
      'Injury on duty, 1 Oct 2026',
      'Employer Test Builders, employee no E-17, claim no ECF/2026/9',
      'Not claimed from the medical aid'
    ]);
    expect(doc.blocks.some(item => item.heading === 'Medical aid')).toBe(false);
    expect(doc.totals.map(total => total.label)).toEqual(['Invoice total', "Employees' Compensation Fund (Social Security Commission) pays"]);
  });

  it('does not tell the patient a line is theirs or that the medical aid is claimed, nor ask for the membership details', () => {
    const doc = buildInvoiceDocument(input({ billedTo, lines, medicalAid: { ...input().medicalAid!, membershipNumber: null } }));
    expect(doc.rows[0].description).toBe('Amalgam, one surface');
    expect(doc.statements.join(' ')).not.toMatch(/medical aid is claimed|payable by the main member/);
    expect(doc.columns.portions).toBe(false);
    expect(doc.missing.join(' ')).not.toMatch(/membership number/);
    expect(() => renderInvoicePdf(doc)).not.toThrow();
  });
});
