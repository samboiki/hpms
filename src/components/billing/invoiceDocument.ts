/**
 * Every word and amount on a printed invoice (the PDF draws exactly this; invoicePdf.ts).
 *
 * NAMAF rule 008 says an account must show (parity D21):
 * - the practice name and practice number;
 * - the treating practitioner's name and HPCNA number;
 * - the main member's surname and initials, the patient's name, the fund and the membership number;
 * - per service: the date, the ICD-10 code(s), the procedure code, the tooth (dental practices), the quantity, the
 *   unit price and the amount;
 * - what the fund pays and what the patient pays;
 * - whether the fees follow the NAMAF benchmark tariff.
 * missingRuleEight() names what this invoice lacks, in plain words, so staff can fix it before the account goes out.
 * Clinical notes (the chief complaint) are never printed: an account is not a clinical record.
 */
import { formatNad, fromCents, sumCents, toCents } from '../../utils/billing/money';
import { formatServiceDate } from '../../utils/billing/dates';
import { initialsFromNames, isDependantRelationship, splitMemberName } from '../../utils/billing/claimLine';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { practitionerLabel } from '../../utils/billing/invoiceRights';
import { practiceMessageFor } from '../../utils/billing/documentSettings';
import { lineTeethCell } from '../../utils/dental/lineTeeth';
import type { PracticeLetterhead } from '../quotes/quotePdf';

export interface InvoiceDocumentPractitioner {
  id: string;
  fullName: string | null;
  role: string | null;
  hpcnaNumber: string | null;
  /** Their own practice number, when their lines bill under it (a partner; practitionerBilling.ts) */
  ownPracticeNumber?: string | null;
}

export interface InvoiceDocumentLine {
  id: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  code: string;
  description: string;
  icd10: string[];
  teeth: string[];
  quantity: number;
  unitPrice: number;
  discount: number;
  /** After the discount */
  total: number;
  medicalAid: number;
  patient: number;
  /** users.id of the treating practitioner of the line (the invoice's when null) */
  practitionerId: string | null;
  /** The narrative staff wrote for the line (invoice_services.notes), printed under its description */
  narrative?: string | null;
  /** Paid by one side only (invoice_services.paid_by): a 'patient' line is never claimed */
  paidBy?: 'fund' | 'patient' | null;
  /** The fund's authorisation number for the line, printed under it */
  authorisationNumber?: string | null;
  /** Surfaces of the line's one tooth ("MO") and the quadrant of a code billed per quadrant (dental) */
  surfaces?: string | null;
  quadrant?: number | null;
}

/** Printed under a line the patient pays all of, so the patient and the fund see why it is not claimed. */
export const PATIENT_ONLY_LINE_NOTE = 'Patient pays this line: not claimed from the medical aid';

/** A discount given on the invoice after it was raised (parity D19): its own entry, off what the patient pays */
export interface InvoiceDocumentDiscount {
  /** DS-000001 */
  number: string;
  amountCents: number;
  /** Given as a percentage (10 = 10%); null when given as an amount */
  percent: number | null;
  /** Why, in the practice's words ("Pensioner") */
  reason: string;
}

/** Said on a medical aid invoice with a discount: the claim is not changed by it */
export const DISCOUNT_CLAIM_NOTE = 'Discounts come off what the patient pays. The medical aid is claimed for its portion as billed.';

export interface InvoiceDocumentInput {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | null;
    dueDate: string | null;
    paymentStatus: string | null;
    /** The invoice's treating practitioner (invoices_enhanced.practitioner_id) */
    practitionerId: string | null;
  };
  practice: PracticeLetterhead & { practiceType: string | null };
  patient: {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
  };
  /** null: a private patient */
  medicalAid: null | {
    fundName: string | null;
    fundReference: string | null;
    membershipNumber: string | null;
    planOption: string | null;
    mainMemberName: string | null;
    relationshipToMain: string | null;
    dependantCode: string | null;
  };
  visit: { date: string | null; practitionerId: string | null } | null;
  practitioners: readonly InvoiceDocumentPractitioner[];
  lines: readonly InvoiceDocumentLine[];
  /**
   * The billed price compared with the practice tariff (the NAMAF benchmark of the discipline) on the service date:
   * the codes billed at another price; null when the comparison could not be made.
   */
  offBenchmarkCodes: readonly string[] | null;
  /** Extra lines for the footer of the account (practice message); optional */
  notes?: string[];
  /** Discounts still standing on the invoice (taken-back ones are left out); optional */
  discounts?: readonly InvoiceDocumentDiscount[];
  /**
   * The company or fund account that pays this invoice (parity A14, A19); optional. The invoice is then not claimed
   * from the medical aid: the account's details, and an injury or accident case's, take the medical aid's place.
   */
  billedTo?: null | {
    name: string;
    accountNumber: string | null;
    postalAddress: string | null;
    /** "Injury on duty, 10 Oct 2026" */
    caseTitle: string | null;
    /** "Employer …, employee no …, claim no …" */
    caseDetails: string | null;
  };
}

export interface InvoiceDocumentRow {
  date: string;
  code: string;
  icd10: string;
  tooth: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  total: string;
  medicalAid: string;
  patient: string;
}

export interface InvoiceDocumentBlock {
  heading: string;
  lines: string[];
}

export interface InvoiceDocument {
  title: string;
  number: string;
  /** "Date: 7 Oct 2026", "Due: 6 Nov 2026" */
  meta: string[];
  statusLabel: string | null;
  primaryColor: string;
  practiceName: string;
  practiceLines: string[];
  blocks: InvoiceDocumentBlock[];
  columns: { tooth: boolean; discount: boolean; portions: boolean };
  rows: InvoiceDocumentRow[];
  totals: { label: string; value: string; bold?: boolean }[];
  statements: string[];
  footerLeft: string[];
  footerRight: string[];
  fileName: string;
  /** Rule-008 fields this invoice lacks (empty when complete); shown on screen, never printed */
  missing: string[];
}

const DEFAULT_COLOUR = '#01b9d4';
const present = (value: string | null | undefined): value is string => Boolean(value?.trim());
const clean = (value: string | null | undefined): string => (value ?? '').trim();

const STATUS_LABELS: Record<string, string> = {
  paid: 'PAID',
  partial: 'PART PAID',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  overdue: 'OVERDUE'
};

/** Main member surname and initials as rule 008 (and claim fields 9 and 10) want them. */
export function memberNameOf(input: Pick<InvoiceDocumentInput, 'patient' | 'medicalAid'>): { surname: string; initials: string } | null {
  if (!input.medicalAid) return null;
  if (isDependantRelationship(input.medicalAid.relationshipToMain)) {
    return splitMemberName(input.medicalAid.mainMemberName, input.patient.lastName);
  }
  const surname = clean(input.patient.lastName).toUpperCase();
  return surname ? { surname, initials: initialsFromNames(input.patient.firstName) } : null;
}

/** The benchmark statement rule 008 asks for. */
export function benchmarkStatement(offBenchmarkCodes: readonly string[] | null, practiceType: string | null): string {
  const discipline = present(practiceType) ? ` (${practiceType.trim().toLowerCase()})` : '';
  if (offBenchmarkCodes === null) return 'Fees: not compared with the NAMAF benchmark tariff.';
  if (offBenchmarkCodes.length === 0) return `Fees: charged at the NAMAF benchmark tariff${discipline}.`;
  const codes = [...new Set(offBenchmarkCodes)].sort();
  return `Fees: code${codes.length === 1 ? '' : 's'} ${codes.join(', ')} ${codes.length === 1 ? 'is' : 'are'} charged at the fund's or an agreed rate, not the NAMAF benchmark tariff${discipline}; the other codes at the benchmark tariff.`;
}

const amount = (value: number): string => formatNad(value);

/** Builds the invoice document. */
export function buildInvoiceDocument(input: InvoiceDocumentInput): InvoiceDocument {
  const { practice, patient, invoice } = input;
  // An invoice billed to a company or fund account is not claimed: no medical aid portion, line notes or rule-008 fields
  const billedTo = input.billedTo ?? null;
  const medicalAid = billedTo ? null : input.medicalAid;
  const dental = isDentalPractice(practice.practiceType);
  const byId = new Map(input.practitioners.map(person => [person.id, person]));
  const defaultPractitionerId = invoice.practitionerId ?? input.visit?.practitionerId ?? null;
  const defaultDate = input.visit?.date ?? invoice.issueDate;

  const place = [practice.city, practice.country].filter(present).join(', ');
  const practiceLines = [
    present(practice.practiceNumber) ? `Practice no ${practice.practiceNumber.trim()}` : null,
    practice.address,
    place ? `${place}${present(practice.postalCode) ? ` ${practice.postalCode}` : ''}` : null,
    present(practice.contactPhone) ? `Tel ${practice.contactPhone}` : null,
    present(practice.contactEmail) ? practice.contactEmail : null
  ].filter(present);

  // Treating practitioners: the invoice's, then any other on a line, each with the HPCNA number the claim carries and,
  // for a partner, the practice number their lines bill under (parity D31)
  const practitionerIds = [...new Set([defaultPractitionerId, ...input.lines.map(line => line.practitionerId)].filter(present))];
  const nameOf = (person: InvoiceDocumentPractitioner) => practitionerLabel({ role: person.role, full_name: person.fullName });
  const practitionerLines = practitionerIds.map(id => {
    const person = byId.get(id);
    if (!person) return 'Treating practitioner: not found in the staff list';
    const billsUnder = present(person.ownPracticeNumber) ? `, bills under practice no ${person.ownPracticeNumber.trim()}` : '';
    return `${nameOf(person)} (HPCNA ${present(person.hpcnaNumber) ? person.hpcnaNumber.trim() : 'not recorded'})${billsUnder}`;
  });
  // With several practitioners on the invoice, each line says who treated it
  const treatedBy = (line: InvoiceDocumentLine): string | null => {
    if (practitionerIds.length < 2) return null;
    const person = byId.get(line.practitionerId ?? defaultPractitionerId ?? '');
    return person ? `Treated by ${nameOf(person)}` : null;
  };

  const patientName = [clean(patient.firstName), clean(patient.lastName)].filter(Boolean).join(' ') || 'Patient';
  const member = memberNameOf(input);
  const dependant = medicalAid && isDependantRelationship(medicalAid.relationshipToMain);
  const patientLines = [
    patientName,
    dependant && present(medicalAid?.dependantCode) ? `Dependant code ${medicalAid?.dependantCode?.trim()}` : null,
    present(patient.dateOfBirth) ? `Born ${formatServiceDate(patient.dateOfBirth)}` : null,
    present(patient.phone) ? `Tel ${patient.phone}` : null,
    present(patient.email) ? patient.email : null
  ].filter(present);

  const fundLabel = medicalAid
    ? [clean(medicalAid.fundName), present(medicalAid.fundReference) ? `(${medicalAid.fundReference.trim()})` : ''].filter(Boolean).join(' ')
    : '';
  const memberLines = medicalAid
    ? [
        member ? `Main member: ${member.surname}${member.initials ? `, ${member.initials}` : ''}` : 'Main member: not recorded',
        `Fund: ${fundLabel || 'not recorded'}${present(medicalAid.planOption) ? `, ${medicalAid.planOption.trim()}` : ''}`,
        `Membership no: ${present(medicalAid.membershipNumber) ? medicalAid.membershipNumber.trim() : 'not recorded'}`
      ]
    : ['Private patient: no medical aid on file'];
  const billedToLines = billedTo
    ? [
        present(billedTo.accountNumber) ? `${billedTo.name} (account ${billedTo.accountNumber.trim()})` : billedTo.name,
        ...clean(billedTo.postalAddress).split('\n').map(line => line.trim()),
        billedTo.caseTitle,
        billedTo.caseDetails,
        'Not claimed from the medical aid'
      ].filter(present)
    : [];
  const payerLabel = billedTo ? `${billedTo.name} pays` : 'Patient pays';

  const rows = [...input.lines]
    .sort((a, b) => (a.serviceDate ?? defaultDate ?? '').localeCompare(b.serviceDate ?? defaultDate ?? ''))
    .map(line => ({
      date: formatServiceDate(line.serviceDate ?? defaultDate),
      code: line.code,
      icd10: line.icd10.join(', '),
      // "46, MO" for a filling's tooth and surfaces, "Q1" for a code billed per quadrant (lineTeeth.ts)
      tooth: lineTeethCell({ teeth: line.teeth, surfaces: line.surfaces, quadrant: line.quadrant }),
      // The line's narrative on its own line under the service, in the same cell (the PDF wraps it there), who treated
      // it when several practitioners did, then for a medical aid patient whether the line is the patient's own and its
      // authorisation number
      description: [
        line.description,
        present(line.narrative) ? line.narrative.trim() : null,
        treatedBy(line),
        medicalAid && line.paidBy === 'patient' ? PATIENT_ONLY_LINE_NOTE : null,
        medicalAid && present(line.authorisationNumber) ? `Authorisation ${line.authorisationNumber.trim()}` : null
      ]
        .filter(present)
        .join('\n'),
      quantity: String(line.quantity),
      unitPrice: amount(line.unitPrice),
      discount: line.discount > 0 ? amount(line.discount) : '',
      total: amount(line.total),
      medicalAid: amount(line.medicalAid),
      patient: amount(line.patient)
    }));

  const cents = (pick: (line: InvoiceDocumentLine) => number) => sumCents(input.lines.map(line => toCents(pick(line))));
  const totalCents = cents(line => line.total);
  const fundCents = cents(line => line.medicalAid);
  const patientCents = cents(line => line.patient);
  const discountCents = cents(line => line.discount);
  // Discounts given on the invoice (DS-...) come off what the patient pays; the lines and the claim stay as billed
  const invoiceDiscounts = (input.discounts ?? []).filter(discount => discount.amountCents > 0);
  const invoiceDiscountCents = sumCents(invoiceDiscounts.map(discount => discount.amountCents));
  // The totals card stays short ("Discount DS-000001"); the percentage and the reason are said below it
  const discountLabel = (discount: InvoiceDocumentDiscount): string => `Discount ${discount.number}`;
  const discountSentence = (discount: InvoiceDocumentDiscount): string => {
    const percent = discount.percent !== null ? ` of ${Number(discount.percent.toFixed(2))}%` : '';
    const reason = clean(discount.reason);
    return `Discount ${discount.number}${percent}${reason ? `: ${reason}` : ''}.`;
  };
  const totals = [
    ...(discountCents > 0 ? [{ label: 'Discount given', value: amount(fromCents(discountCents)) }] : []),
    { label: 'Invoice total', value: amount(fromCents(totalCents)), bold: true },
    ...(medicalAid ? [{ label: `Medical aid pays${fundLabel ? ` (${clean(medicalAid.fundReference) || clean(medicalAid.fundName)})` : ''}`, value: amount(fromCents(fundCents)) }] : []),
    { label: payerLabel, value: amount(fromCents(patientCents)), bold: true },
    ...invoiceDiscounts.map(discount => ({ label: discountLabel(discount), value: `-${amount(fromCents(discount.amountCents))}` })),
    ...(invoiceDiscountCents > 0 ? [{ label: `${payerLabel} after discount`, value: amount(fromCents(Math.max(patientCents - invoiceDiscountCents, 0))), bold: true }] : [])
  ];

  const statements = [
    benchmarkStatement(input.offBenchmarkCodes, practice.practiceType),
    medicalAid && fundCents > 0
      ? 'The medical aid is claimed for its portion. Any amount the fund does not pay becomes payable by the main member.'
      : null,
    medicalAid && input.lines.some(line => line.paidBy === 'patient')
      ? 'Lines marked "Patient pays this line" are not claimed from the medical aid: they are payable by the main member.'
      : null,
    ...invoiceDiscounts.map(discountSentence),
    medicalAid && invoiceDiscountCents > 0 ? DISCOUNT_CLAIM_NOTE : null,
    'All amounts are in Namibian dollars (N$).',
    ...(input.notes ?? []),
    // The practice's own message, when it prints on invoices (parity D22)
    practiceMessageFor(practice.documentSettings, 'invoice')
  ].filter(present);

  const footerLeft = [
    present(practice.taxNumber) ? `VAT/Tax no ${practice.taxNumber}` : null,
    present(practice.licenseNumber) ? `Licence ${practice.licenseNumber}` : null
  ].filter(present);
  const footerRight =
    present(practice.bankName) && present(practice.accountNumber)
      ? [`${practice.bankName}, account ${practice.accountNumber}${present(practice.branchCode) ? `, branch ${practice.branchCode}` : ''}`, `Pay with reference ${invoice.invoiceNumber}`]
      : [];

  return {
    title: 'INVOICE',
    number: invoice.invoiceNumber,
    meta: [`Date: ${formatServiceDate(invoice.issueDate)}`, ...(present(invoice.dueDate) ? [`Due: ${formatServiceDate(invoice.dueDate)}`] : [])],
    statusLabel: STATUS_LABELS[clean(invoice.paymentStatus).toLowerCase()] ?? null,
    primaryColor: present(practice.primaryColor) ? practice.primaryColor : DEFAULT_COLOUR,
    practiceName: practice.name,
    practiceLines,
    blocks: [
      { heading: 'Patient', lines: patientLines },
      billedTo ? { heading: 'Billed to', lines: billedToLines } : { heading: 'Medical aid', lines: memberLines },
      { heading: practitionerLines.length > 1 ? 'Treating practitioners' : 'Treating practitioner', lines: practitionerLines.length > 0 ? practitionerLines : ['Not recorded'] }
    ],
    columns: { tooth: dental, discount: discountCents > 0, portions: medicalAid !== null },
    rows,
    totals,
    statements,
    footerLeft,
    footerRight,
    fileName: `invoice-${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
    missing: missingRuleEight({ ...input, medicalAid })
  };
}

/** What this invoice lacks under NAMAF rule 008, in plain words (empty when complete). */
export function missingRuleEight(input: InvoiceDocumentInput): string[] {
  const missing: string[] = [];
  const { practice, medicalAid } = input;
  if (!present(practice.practiceNumber)) missing.push("The practice number is missing: add it to the practice's details.");
  const byId = new Map(input.practitioners.map(person => [person.id, person]));
  const practitionerId = input.invoice.practitionerId ?? input.visit?.practitionerId ?? null;
  const ids = [...new Set([practitionerId, ...input.lines.map(line => line.practitionerId)].filter(present))];
  if (ids.length === 0) missing.push('No treating practitioner is recorded: choose one on the visit.');
  ids.forEach(id => {
    const person = byId.get(id);
    if (person && !present(person.hpcnaNumber)) {
      missing.push(`${practitionerLabel({ role: person.role, full_name: person.fullName })} has no HPCNA number on record: add it under Settings > Users.`);
    }
  });
  if (medicalAid) {
    if (!memberNameOf(input)) missing.push("The main member's name is missing: add it to the patient's medical aid details.");
    if (!present(medicalAid.membershipNumber)) missing.push('The membership number is missing.');
    if (!present(medicalAid.fundName) && !present(medicalAid.fundReference)) missing.push('The medical aid fund is missing.');
  }
  const withoutIcd = input.lines.filter(line => line.icd10.length === 0).map(line => line.code);
  if (withoutIcd.length > 0) missing.push(`No ICD-10 code for ${[...new Set(withoutIcd)].join(', ')}: add it on the line in the visit's Billing tab.`);
  if (input.offBenchmarkCodes === null) missing.push('The fees could not be compared with the NAMAF benchmark tariff (the tariff list could not be read).');
  return missing;
}
