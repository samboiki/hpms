/**
 * The structured model every remittance parser returns, whatever the fund or file type.
 *
 * Funds send four kinds of documents back:
 * - payment      a remittance statement or advice: money paid into the practice's bank account
 * - month_summary a monthly statement that repeats the lines of the month's payments
 * - adjudication the fund's assessment of a claim batch (assessed, pended, rejected) before payment
 * - acknowledgement / claim_status: proof that a batch or claim arrived, with errors per line
 * Only a payment (or a month summary whose payment was not imported) carries money to post.
 *
 * Amounts are whole cents (integers). Dates are yyyy-MM-dd keys. Nothing here assumes a discipline:
 * tariff codes are any NAMAF or fund code (consultation, procedure, medicine, modifier) and tooth
 * numbers are optional.
 */

export type RemittanceFormat =
  | 'methealth_statement'
  | 'medscheme_advice'
  | 'medscheme_monthly'
  | 'nmc_response_csv'
  | 'switchon_status_csv'
  | 'nhp_acknowledgement';

export type DocumentKind = 'payment' | 'month_summary' | 'adjudication' | 'acknowledgement' | 'claim_status';

export type Administrator = 'methealth' | 'medscheme' | 'switchon' | 'unknown';

/**
 * What the fund did with one line:
 * paid (in full), part_paid, rejected (nothing paid), pended (held for review, may still be paid),
 * accepted (assessed or approved, payment still to come) and info (a line that only carries a note).
 */
export type LineStatus = 'paid' | 'part_paid' | 'rejected' | 'pended' | 'accepted' | 'info';

export interface RemittanceLine {
  /** 1..n in the order the lines appear in the document */
  seq: number;
  page: number | null;
  /** Principal member's number as printed (digits) */
  memberNumber: string | null;
  /** Dependant code when the fund prints one ("00" is the principal member) */
  dependantCode: string | null;
  /** The patient as the fund names them. Data only: never logged or used outside matching. */
  patientName: string | null;
  memberName: string | null;
  /** The practice's own reference the fund echoes: normally the 7-digit patient (account) reference */
  practiceReference: string | null;
  /** The invoice reference (claim field 24) when the fund echoes it */
  invoiceReference: string | null;
  serviceDate: string | null;
  /** The tariff code as printed (e.g. "08109", "0190", a NAPPI code) */
  tariffRaw: string | null;
  description: string | null;
  quantity: number | null;
  claimedCents: number | null;
  /** The fund's own rate for the line */
  tariffCents: number | null;
  /** Paid to the practice (provider) */
  paidCents: number;
  /** What the fund did not pay, as the fund prints it (it does NOT mean the patient may be billed) */
  memberPortionCents: number | null;
  levyCents: number;
  memberNotLiableCents: number;
  /** Paid to the member instead of the practice: the practice must collect it from the patient */
  paidToMemberCents: number;
  status: LineStatus;
  /** Fund reason or remark codes ("202", "514", "5302"); several can apply to one line */
  reasonCodes: string[];
  /** The fund's own wording for the reasons on this line (from the legend or a note column) */
  reasonTexts: string[];
  /** The fund's own reference for the claim or line (batch/claim/item, EDI/NAM number, admin ref) */
  fundClaimRef: string | null;
  /** The provider's system transaction number (claim field 3) when the format carries it */
  systemTransactionNumber: string | null;
}

export interface ReconciliationCheck {
  label: string;
  /** What the document says (a total, subtotal or count) */
  expectedCents: number;
  /** What its lines add up to */
  actualCents: number;
  ok: boolean;
  /** 'count' for a number of claims or lines; amounts otherwise */
  unit?: 'count';
}

export interface RemittanceDocument {
  format: RemittanceFormat;
  kind: DocumentKind;
  administrator: Administrator;
  /** The fund as printed ("NMC", "PSEMAS", "Namibia Health Plan") */
  fundName: string | null;
  /** The fund's claim-file code when recognised: MAG1 (PSEMAS), NMC1, NHPM, NAMM, PROS */
  fundCode: string | null;
  practiceNumber: string | null;
  /** The bank-matching reference of the payment (Medscheme ACB reference, Methealth reference number) */
  paymentReference: string | null;
  statementNumber: string | null;
  documentDate: string | null;
  /** The day the money is paid (Medscheme advices arrive 2-3 days before it) */
  paymentDate: string | null;
  totalPaidCents: number | null;
  totalClaimedCents: number | null;
  totalMemberPortionCents: number | null;
  /** Last 4 digits only of the account the fund paid into */
  bankAccountLast4: string | null;
  /** The reason-code wording printed on the document: code -> text */
  reasonLegend: Record<string, string>;
  lines: RemittanceLine[];
  checks: ReconciliationCheck[];
  warnings: string[];
}

export interface ParsedRemittanceFile {
  format: RemittanceFormat;
  /** One file can hold more than one payment (a monthly statement, several schemes) */
  documents: RemittanceDocument[];
  warnings: string[];
}

/** Parser version stored with every import, so a re-parse after a fix can be told apart */
export const REMITTANCE_PARSER_VERSION = '2026.10.1';

export const FORMAT_LABELS: Record<RemittanceFormat, string> = {
  methealth_statement: 'Methealth remittance statement',
  medscheme_advice: 'Medscheme remittance advice',
  medscheme_monthly: 'Medscheme monthly statement',
  nmc_response_csv: 'NMC claim response (CSV)',
  switchon_status_csv: 'SwitchOn claim status report (CSV)',
  nhp_acknowledgement: 'NHP batch claim acknowledgement'
};

export const KIND_LABELS: Record<DocumentKind, string> = {
  payment: 'Payment',
  month_summary: 'Monthly statement',
  adjudication: 'Claim assessment',
  acknowledgement: 'Batch acknowledgement',
  claim_status: 'Claim status report'
};

export const LINE_STATUS_LABELS: Record<LineStatus, string> = {
  paid: 'Paid',
  part_paid: 'Part paid',
  rejected: 'Not paid',
  pended: 'Pended',
  accepted: 'Accepted',
  info: 'Note'
};

/** A new line with every optional field empty, for parsers to fill in */
export function emptyLine(seq: number, page: number | null): RemittanceLine {
  return {
    seq,
    page,
    memberNumber: null,
    dependantCode: null,
    patientName: null,
    memberName: null,
    practiceReference: null,
    invoiceReference: null,
    serviceDate: null,
    tariffRaw: null,
    description: null,
    quantity: null,
    claimedCents: null,
    tariffCents: null,
    paidCents: 0,
    memberPortionCents: null,
    levyCents: 0,
    memberNotLiableCents: 0,
    paidToMemberCents: 0,
    status: 'info',
    reasonCodes: [],
    reasonTexts: [],
    fundClaimRef: null,
    systemTransactionNumber: null
  };
}

/** A document with no lines yet */
export function emptyDocument(format: RemittanceFormat, kind: DocumentKind, administrator: Administrator): RemittanceDocument {
  return {
    format,
    kind,
    administrator,
    fundName: null,
    fundCode: null,
    practiceNumber: null,
    paymentReference: null,
    statementNumber: null,
    documentDate: null,
    paymentDate: null,
    totalPaidCents: null,
    totalClaimedCents: null,
    totalMemberPortionCents: null,
    bankAccountLast4: null,
    reasonLegend: {},
    lines: [],
    checks: [],
    warnings: []
  };
}
