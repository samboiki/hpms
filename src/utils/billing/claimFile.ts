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
 */
import { formatAmount, sumCents, toCents } from './money.ts';
import { toClaimDate } from './dates.ts';
import { normalizeIcd10 } from './icd10.ts';
import { normalizeGender, padPatientReference, type ClaimLine } from './claimLine.ts';

export const CLAIM_FILE_FORMAT_VERSION = '1.6';
export const CLAIM_FILE_EXTENSION = '.Dat';
export const HEADER_FIELD_COUNT = 9;
export const DETAIL_FIELD_COUNT = 53;
export const TRAILER_EMPTY_FIELDS = 22;
export const DESCRIPTION_MAX_LENGTH = 30;
export const DEFAULT_SOURCE_SOFTWARE = 'ONEHEALTH';
export const DEFAULT_SOURCE_SOFTWARE_VERSION = '01.00.00';
const LINE_END = '\r\n';

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

/** The 9 header fields. */
export function headerFields(header: ClaimFileHeader): string[] {
  return [
    '1',
    sanitizeField(header.practiceNumber),
    sanitizeField(header.systemIdentification ?? '1') || '1',
    sanitizeField(header.transactionType ?? 'D') || 'D',
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
    field(line.memberSurname).toUpperCase(), // 9 main member surname
    field(line.memberInitials).replace(/[ .]/g, '').toUpperCase(), // 10 initials
    field(line.patientName).toUpperCase(), //   11 patient name
    toClaimDate(line.patientDateOfBirth) ?? '', // 12 date of birth
    field(line.tariffCode), //                  13 tariff code
    amountField(line.amount), //                14 line amount
    field(line.description, DESCRIPTION_MAX_LENGTH), // 15 description
    amountField(extra.discountAmount), //       16 discount
    toClaimDate(line.serviceDate) ?? '', //     17 service date
    amountField(line.quantity), //              18 number of services
    field(extra.serviceFee ?? '7') || '7', //   19 service fee type
    field(extra.modifier1), //                  20
    field(extra.modifier2), //                  21
    field(extra.modifier3), //                  22
    field(extra.modifier4), //                  23
    field(line.invoiceNumber), //               24 invoice number
    field(extra.referringDoctor), //            25
    field(extra.nappiCode), //                  26
    field(extra.referredToPracticeNumber), //   27
    '', //                                      28 not used
    field(line.practiceNumber), //              29 practice number
    field(extra.hospitalIndicator), //          30
    field(line.authorisationNumber), //         31 authorisation number
    field(line.resubmissionFlag), //            32 resubmission flag
    field(line.icd10Primary ? normalizeIcd10(line.icd10Primary) : ''), // 33 ICD-10 (primary)
    field(extra.diagnosticCodeType) || 'D', //  34 diagnostic code type
    field(extra.dosageDescription), //          35
    field(line.treatingDoctorHpcnaNumber), //   36 treating doctor HPCNA number
    field(line.toothNumbers), //                37 tooth number(s)
    normalizeGender(line.gender), //            38 gender
    field(extra.tariffCodeType) || 'T', //      39 tariff code type
    field(extra.cptCdtCode), //                 40
    field(extra.freeText), //                   41
    field(extra.placeOfService), //             42
    field(extra.referringDoctor2), //           43
    field(extra.trackingNumber), //             44
    field(extra.readingAdditions), //           45
    field(extra.lensPrescription), //           46
    field(extra.densityOfTint), //              47
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

/** Builds the claim file for one batch. Lines are written in line-number order. */
export function buildClaimFile(header: ClaimFileHeader, lines: readonly ClaimLine[]): ClaimFile {
  const ordered = [...lines].sort((a, b) => a.transactionNumber - b.transactionNumber);
  const totalCents = sumCents(ordered.map(line => toCents(Number.isFinite(line.amount) ? line.amount : 0)));
  const records = [
    headerFields(header),
    ...ordered.map(detailFields),
    trailerFields(ordered.length, totalCents)
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
