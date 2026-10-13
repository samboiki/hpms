/**
 * Claim data file (".Dat") generation.
 *
 * The layout matches the claim files this practice's funds have accepted from its previous
 * accredited software (sample_data/x, format version 1.6). Compared with the repo's
 * prepare_batch_for_sending() SQL and the Finance page fallback, which drifted from it:
 * - a detail (D) record has 53 fields, not 54: there is no "not used 3" field between the
 *   dosage description and the treating doctor's HPCNA number;
 * - amounts, discounts and quantities keep their decimals ("450.00", "0.00", "1.00");
 * - dates are yyyyMMdd; the patient reference is 7 digits; lines end with CRLF;
 * - the header carries the batch number (also used in the file name), not the invoice count;
 * - the trailer is Z, number of D lines, total amount, then 22 empty fields. The old software
 *   printed totals over N$999.99 with a thousands comma ("23,652.41"), which splits the field;
 *   the total is written plain ("23652.41"), as the old files did for smaller totals.
 * Field values are cleaned so they can never add or remove a field: commas, quotes, tabs and
 * line breaks become spaces and accents are removed (the files are plain ASCII).
 * Field lengths follow the specification (CLAIM_FIELD_MAX): member surname 20, initials 4, patient 20,
 * invoice number 8 (claimInvoiceReference), the referral fields 25, 43 and 44 15 each, the hospital indicator 1 and the
 * place of service 2 (referrals.ts, visitClaimDetails.ts); field 33 lists up to 5 ICD-10 codes separated by "/", and
 * field 37 joins tooth numbers without separators ("1112"), as the specification and the old files do.
 * Fields 45-47 (optometry) are sent only in the specification's format (optometryField).
 * Field 18 is the number of services; on a line of a code the practice charges by time it is the minutes noted on the
 * line (servicesField), as the specification asks for time-based lines. Field 49 (service time) is a time of day, not
 * how long the service took, and stays as stored.
 * A dental 8099 line is followed by its lab's invoice lines (labDetailFields: type L records that add up to it, numbered
 * after the batch's last line); the trailer counts and totals every D record, while the file's lineCount and totalCents
 * are the claim lines' (what the fund is claimed). Without lab lines the file is exactly as before.
 */
import { formatAmount, sumCents, toCents } from './money.ts';
import { toClaimDate } from './dates.ts';
import { normalizeIcd10 } from './icd10.ts';
import { parseToothList } from './pricing.ts';
import {
  CLAIM_FIELD_MAX,
  OPTOMETRY_CLAIM_PATTERNS,
  claimInvoiceReference,
  normalizeGender,
  padPatientReference,
  type ClaimLabDetail,
  type ClaimLine,
  type OptometryClaimField
} from './claimLine.ts';

export const CLAIM_FILE_FORMAT_VERSION = '1.6';
export const CLAIM_FILE_EXTENSION = '.Dat';
export const HEADER_FIELD_COUNT = 9;
export const DETAIL_FIELD_COUNT = 53;
export const TRAILER_EMPTY_FIELDS = 22;
export const DESCRIPTION_MAX_LENGTH = 30;
export const DEFAULT_SOURCE_SOFTWARE = 'ONEHEALTH';
export const DEFAULT_SOURCE_SOFTWARE_VERSION = '01.00.00';
const LINE_END = '\r\n';

/**
 * Header field 4, the transaction type (QEDI Layout 1.1 / Methealth HP EDI): D for a file of claims, C for a credit
 * file that reverses lines the fund was sent before (a credit note on a claimed line). The type belongs to the whole
 * file, so reversals go to the fund in a file of their own, with its own batch number.
 */
export const CLAIM_TRANSACTION_TYPES = { claim: 'D', reversal: 'C' } as const;

/** True for a credit file (header transaction type C): its lines reverse earlier claims. */
export const isReversalTransactionType = (value: string | null | undefined): boolean =>
  (value ?? '').trim().toUpperCase() === CLAIM_TRANSACTION_TYPES.reversal;

export interface ClaimFileHeader {
  practiceNumber: string;
  batchNumber: number | string;
  /** Batch date, yyyy-MM-dd (or any format toClaimDate accepts). */
  batchDate: string;
  fundReference: string;
  systemIdentification?: string | number | null;
  transactionType?: string | null;
  sourceSoftware?: string | null;
  sourceSoftwareVersion?: string | null;
}

export interface ClaimFile {
  fileName: string;
  content: string;
  lineCount: number;
  totalCents: number;
}

/** Makes a value safe for one comma-separated field. */
export function sanitizeField(value: unknown, maxLength?: number): string {
  if (value === null || value === undefined) return '';
  let result = String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s,"]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/ +/g, ' ')
    .trim();
  if (maxLength !== undefined) result = result.slice(0, maxLength).trimEnd();
  return result;
}

const fileNamePart = (value: unknown): string => String(value ?? '').replace(/[^A-Za-z0-9]/g, '');

/** <practice number>_<batch number>_<fund>.Dat, as the funds received from the old software. */
export function claimFileName(header: Pick<ClaimFileHeader, 'practiceNumber' | 'batchNumber' | 'fundReference'>): string {
  return `${fileNamePart(header.practiceNumber)}_${fileNamePart(header.batchNumber)}_${fileNamePart(header.fundReference)}${CLAIM_FILE_EXTENSION}`;
}

const amountField = (value: number | null | undefined): string =>
  formatAmount(typeof value === 'number' && Number.isFinite(value) ? value : 0, { thousands: false });

/**
 * Field 18: the number of services, or on a line of a code the practice charges by time the minutes it took (the claim
 * specification: minutes for time-based lines; a fund refuses such a line without them, QEDI D036). The line's amount
 * and quantity on the invoice are unchanged.
 */
export const servicesField = (line: Pick<ClaimLine, 'quantity' | 'timeMinutes'>): string =>
  amountField(typeof line.timeMinutes === 'number' && line.timeMinutes > 0 ? line.timeMinutes : line.quantity);

/**
 * Primary then secondary ICD-10 codes, each once, "/"-separated, at most 5 codes and `maxLength` characters: claim field
 * 33, and also how a batch line stores its codes (batch_details.diagnostic_code), so saving loses no code.
 */
export function joinDiagnosisCodes(
  primary: string | null | undefined,
  secondary: readonly string[] = [],
  maxLength: number = CLAIM_FIELD_MAX.diagnosisField
): string {
  const codes = [primary ?? '', ...secondary].map(code => sanitizeField(code ? normalizeIcd10(code) : '')).filter(Boolean);
  const kept = [...new Set(codes)].slice(0, CLAIM_FIELD_MAX.diagnosisCodes);
  while (kept.join('/').length > maxLength) kept.pop();
  return kept.join('/');
}

/** Codes saved on a batch line ("K02.1/K04.0", or one code): the first is the primary diagnosis, the rest secondary. */
export function splitDiagnosisCodes(text: string | null | undefined): { primary: string; secondary: string[] } {
  const codes = [...new Set(String(text ?? '').split(/[/,;\s]+/).map(code => normalizeIcd10(code)).filter(Boolean))];
  return { primary: codes[0] ?? '', secondary: codes.slice(1) };
}

const diagnosisField = (line: ClaimLine): string => joinDiagnosisCodes(line.icd10Primary, line.icd10Secondary ?? []);

/** Two-digit FDI tooth numbers joined without separators ("11 12" -> "1112"), at most 8 teeth. */
const toothField = (toothNumbers: string | null | undefined): string =>
  parseToothList(sanitizeField(toothNumbers)).slice(0, CLAIM_FIELD_MAX.teeth).join('');

/**
 * Claim fields 45-47 (optometry): spaces removed and upper case, as the specification writes them. A value that does
 * not match its format, or is longer than the field, is left out rather than cut: a cut-off prescription would be a
 * wrong prescription on the fund's records.
 */
export function optometryField(value: unknown, field: OptometryClaimField): string {
  const text = sanitizeField(value).replace(/ /g, '').toUpperCase();
  if (!text || text.length > CLAIM_FIELD_MAX[field]) return '';
  return OPTOMETRY_CLAIM_PATTERNS[field].test(text) ? text : '';
}

/** The 9 header fields. */
export function headerFields(header: ClaimFileHeader): string[] {
  return [
    '1',
    sanitizeField(header.practiceNumber),
    sanitizeField(header.systemIdentification ?? '1') || '1',
    sanitizeField(header.transactionType ?? CLAIM_TRANSACTION_TYPES.claim) || CLAIM_TRANSACTION_TYPES.claim,
    sanitizeField(header.batchNumber),
    toClaimDate(header.batchDate) ?? '',
    sanitizeField(header.sourceSoftware ?? DEFAULT_SOURCE_SOFTWARE) || DEFAULT_SOURCE_SOFTWARE,
    sanitizeField(header.sourceSoftwareVersion ?? DEFAULT_SOURCE_SOFTWARE_VERSION) || DEFAULT_SOURCE_SOFTWARE_VERSION,
    CLAIM_FILE_FORMAT_VERSION
  ];
}

/** The 53 detail (D record) fields for one claim line. */
export function detailFields(line: ClaimLine): string[] {
  const extra = line.extra ?? {};
  const field = (value: unknown, maxLength?: number) => sanitizeField(value, maxLength);
  return [
    'D', //                                    1 record type
    field(line.transactionNumber), //           2 line number in batch
    field(line.systemTransactionNumber ?? 0), // 3 system transaction number
    field(padPatientReference(line.patientReference)), // 4 patient reference (7 digits)
    field(extra.typeOfService) || 'T', //       5 type of service
    field(line.fundReference), //               6 fund reference
    '', //                                      7 not used
    field(line.membershipNumber), //            8 membership number
    field(line.memberSurname, CLAIM_FIELD_MAX.memberSurname).toUpperCase(), // 9 main member surname
    field(line.memberInitials).replace(/[ .]/g, '').toUpperCase().slice(0, CLAIM_FIELD_MAX.memberInitials), // 10 initials
    field(line.patientName, CLAIM_FIELD_MAX.patientName).toUpperCase(), // 11 patient name
    toClaimDate(line.patientDateOfBirth) ?? '', // 12 date of birth
    field(line.tariffCode), //                  13 tariff code
    amountField(line.amount), //                14 line amount
    field(line.description, DESCRIPTION_MAX_LENGTH), // 15 description
    amountField(extra.discountAmount), //       16 discount
    toClaimDate(line.serviceDate) ?? '', //     17 service date
    servicesField(line), //                     18 number of services (minutes on a line charged by time)
    field(extra.serviceFee ?? '7') || '7', //   19 service fee type
    field(extra.modifier1), //                  20
    field(extra.modifier2), //                  21
    field(extra.modifier3), //                  22
    field(extra.modifier4), //                  23
    field(claimInvoiceReference(line.invoiceNumber)), // 24 invoice number (max 8)
    field(extra.referringDoctor, CLAIM_FIELD_MAX.referringDoctor), // 25 referring practitioner (practice number or name)
    field(extra.nappiCode), //                  26
    field(extra.referredToPracticeNumber), //   27
    '', //                                      28 not used
    field(line.practiceNumber), //              29 practice number
    field(extra.hospitalIndicator, CLAIM_FIELD_MAX.hospitalIndicator), // 30 "H": in hospital
    field(line.authorisationNumber), //         31 authorisation number
    field(line.resubmissionFlag), //            32 resubmission flag
    diagnosisField(line), //                    33 ICD-10 codes (primary first)
    field(extra.diagnosticCodeType) || 'D', //  34 diagnostic code type
    field(extra.dosageDescription), //          35
    field(line.treatingDoctorHpcnaNumber), //   36 treating doctor HPCNA number
    toothField(line.toothNumbers), //           37 tooth number(s)
    normalizeGender(line.gender), //            38 gender
    field(extra.tariffCodeType) || 'T', //      39 tariff code type
    field(extra.cptCdtCode), //                 40
    field(extra.freeText), //                   41
    field(extra.placeOfService, CLAIM_FIELD_MAX.placeOfService), // 42 place of service (PHISC code)
    field(extra.referringDoctor2, CLAIM_FIELD_MAX.referringCouncilNumber), // 43 referring practitioner's council number
    field(extra.trackingNumber, CLAIM_FIELD_MAX.trackingNumber), // 44 referral number
    optometryField(extra.readingAdditions, 'readingAdditions'), // 45 reading additions per eye
    optometryField(extra.lensPrescription, 'lensPrescription'), // 46 lens prescription per eye
    optometryField(extra.densityOfTint, 'densityOfTint'), //      47 density of tint per eye
    field(line.patientIdNumber), //             48 patient ID number
    field(extra.serviceTime), //                49
    field(extra.employerName), //               50
    field(extra.employeeNumber), //             51
    toClaimDate(extra.dateOfInjury) ?? '', //   52
    field(extra.iodReferenceNumber) //          53
  ];
}

/** The trailer: Z, number of detail lines, total amount, then 22 empty fields. */
export function trailerFields(lineCount: number, totalCents: number): string[] {
  return ['Z', String(lineCount), formatAmount(totalCents / 100, { thousands: false }), ...Array<string>(TRAILER_EMPTY_FIELDS).fill('')];
}

/** Claim field 5 of a line of a dental lab's invoice under its 8099 line (QEDI type of service L). */
export const LAB_DETAIL_SERVICE_TYPE = 'L';

/**
 * The D record of one line of a dental lab's invoice, written straight after its 8099 line: the 8099 line's patient,
 * member, date, practice, practitioner and diagnosis, the lab's item code, what it is, its amount, quantity 1, and the
 * lab's invoice number in field 24 (the 8099 line's invoice number when the lab gave none). `lineNumber` is the record's
 * own field 2, after every line number of the batch, so it never takes a batch line's number (the funds' answers and
 * the sent file are matched to batch lines by it).
 */
export function labDetailFields(parent: ClaimLine, detail: ClaimLabDetail, lineNumber: number): string[] {
  return detailFields({
    ...parent,
    transactionNumber: lineNumber,
    tariffCode: detail.code ?? '',
    description: detail.description,
    amount: detail.amount,
    quantity: 1,
    // The lab's item is one item, whatever the time noted on the 8099 line
    chargedByTime: false,
    timeMinutes: null,
    unitPrice: null,
    invoiceNumber: parent.labSlipNumber?.trim() || parent.invoiceNumber,
    labDetails: undefined,
    extra: {
      ...parent.extra,
      typeOfService: LAB_DETAIL_SERVICE_TYPE,
      discountAmount: 0,
      modifier1: null,
      modifier2: null,
      modifier3: null,
      modifier4: null,
      nappiCode: null,
      dosageDescription: null,
      cptCdtCode: null,
      freeText: null,
      readingAdditions: null,
      lensPrescription: null,
      densityOfTint: null,
      serviceTime: null
    }
  });
}

/** Builds the claim file for one batch. Lines are written in line-number order, a dental 8099 line's lab lines after it. */
export function buildClaimFile(header: ClaimFileHeader, lines: readonly ClaimLine[]): ClaimFile {
  const ordered = [...lines].sort((a, b) => a.transactionNumber - b.transactionNumber);
  const centsOf = (amount: number) => toCents(Number.isFinite(amount) ? amount : 0);
  const totalCents = sumCents(ordered.map(line => centsOf(line.amount)));
  let nextLabNumber = ordered.reduce((max, line) => (Number.isFinite(line.transactionNumber) ? Math.max(max, line.transactionNumber) : max), 0) + 1;
  const details: string[][] = [];
  const labCents: number[] = [];
  for (const line of ordered) {
    details.push(detailFields(line));
    for (const detail of line.labDetails ?? []) {
      details.push(labDetailFields(line, detail, nextLabNumber));
      nextLabNumber += 1;
      labCents.push(centsOf(detail.amount));
    }
  }
  const records = [
    headerFields(header),
    ...details,
    // The trailer's count and hash total are of every D record (the lab lines included)
    trailerFields(details.length, totalCents + sumCents(labCents))
  ];
  return {
    fileName: claimFileName(header),
    content: records.map(fields => fields.join(',')).join(LINE_END) + LINE_END,
    lineCount: ordered.length,
    totalCents
  };
}

export interface ParsedClaimFile {
  header: string[] | null;
  details: string[][];
  trailer: string[] | null;
  unknown: string[];
}

/** Splits a claim file into its records (for preview and checks). */
export function parseClaimFile(content: string): ParsedClaimFile {
  const parsed: ParsedClaimFile = { header: null, details: [], trailer: null, unknown: [] };
  content
    .split(/\r?\n/)
    .filter(line => line.length > 0)
    .forEach(line => {
      const fields = line.split(',');
      if (fields[0] === '1' && !parsed.header) parsed.header = fields;
      else if (fields[0] === 'D') parsed.details.push(fields);
      else if (fields[0] === 'Z' && !parsed.trailer) parsed.trailer = fields;
      else parsed.unknown.push(line);
    });
  return parsed;
}

/** Names of the 53 detail fields, for the preview's field inspector. */
export const DETAIL_FIELD_NAMES: readonly string[] = [
  'Record type', 'Line number', 'System transaction no.', 'Patient reference', 'Type of service',
  'Fund', 'Not used', 'Membership no.', 'Member surname', 'Member initials', 'Patient name',
  'Date of birth', 'Tariff code', 'Amount', 'Description', 'Discount', 'Service date',
  'Number of services', 'Service fee type', 'Modifier 1', 'Modifier 2', 'Modifier 3', 'Modifier 4',
  'Invoice no.', 'Referring doctor', 'NAPPI code', 'Referred to practice', 'Not used', 'Practice no.',
  'Hospital indicator', 'Authorisation no.', 'Resubmission flag', 'ICD-10 code', 'Diagnostic code type',
  'Dosage', 'Treating doctor HPCNA no.', 'Tooth number(s)', 'Gender', 'Tariff code type', 'CPT/CDT code',
  'Free text', 'Place of service', 'Referring doctor 2', 'Tracking no.', 'Reading additions',
  'Lens prescription', 'Density of tint', 'Patient ID no.', 'Service time', 'Employer',
  'Employee no.', 'Date of injury', 'IOD reference no.'
];
