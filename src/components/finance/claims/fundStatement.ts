/**
 * The statement of outstanding claims per fund (parity F22): what each medical aid still owes on the claims sent to it,
 * by batch and patient, with totals and ages, to print or download and give the fund. Pure.
 *
 * Built from the same classified invoices as the Overview's "Claims sent, awaiting payment" and Reports > Debtors by
 * medical aid fund (fundDebtorItems), so its totals are those figures exactly: a claim leaves the statement once it is
 * paid, credited or written off. A fund is the patient's medical aid as recorded, as those screens group it; each batch
 * also shows the fund code it was sent under.
 */
import { AGE_BANDS, UNKNOWN_SCHEME, type AgeBand } from '../../../services/ledgerService';
import { daysBetweenKeys, formatServiceDate, toDateKey } from '../../../utils/billing/dates';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { escapeHtml, toCsv, type CsvCell, type ExportColumn } from '../financeExport';
import { fundDebtorItems, type FundDebtorsInput } from '../fundDebtors';
import { PAGE_STYLE } from './claimReport';

export interface FundStatementInput extends FundDebtorsInput {
  /** "First Last" by patient id (the Finance workspace's names) */
  patientNames: Readonly<Record<string, string>>;
}

/** One invoice the fund has not paid, credited or written off */
export interface StatementLine {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  /** yyyy-MM-dd: the visit's date, else the invoice date */
  serviceDate: string | null;
  /** What the fund still owes on the invoice */
  owedCents: number;
  /** Days since the invoice date, as every statement and the age analysis count them; null when undated */
  ageDays: number | null;
  ageBand: AgeBand;
}

/** The lines of one sent batch */
export interface StatementBatch {
  batchId: string;
  /** null when the batch could not be read (its invoices still count, as on the Overview) */
  batchNumber: number | null;
  /** The fund code the batch was sent under (MAG1, NMC1 ...) */
  fundCode: string | null;
  /** yyyy-MM-dd the batch was sent; null when not recorded or not readable */
  sentOn: string | null;
  daysSinceSent: number | null;
  readable: boolean;
  lines: StatementLine[];
  owedCents: number;
}

export interface FundStatement {
  fund: string;
  /** The fund codes its batches were sent under */
  fundCodes: string[];
  /** Oldest sent first */
  batches: StatementBatch[];
  claimCount: number;
  owedCents: number;
  /** What the fund owes per age band (days since the invoice date) */
  byAgeBand: Record<AgeBand, number>;
  oldestAgeDays: number | null;
}

export interface FundStatements {
  asOfKey: string;
  /** Largest amount owed first, as Finance lists the funds */
  funds: FundStatement[];
  /** All funds together: the Overview's "Claims sent, awaiting payment" */
  totalCents: number;
}

const emptyBands = (): Record<AgeBand, number> =>
  Object.fromEntries(AGE_BANDS.map(band => [band.key, 0])) as Record<AgeBand, number>;

/** The day a timestamp fell on in the practice's (the browser's) calendar */
const dayOf = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? toDateKey(timestamp) : toDateKey(date);
};

const byText = (a: string, b: string): number => a.localeCompare(b, 'en', { sensitivity: 'base' });

/** Every fund's statement: the claims sent to it that it still owes on, by batch and patient */
export function buildFundStatements(input: FundStatementInput): FundStatements {
  const funds = new Map<string, Map<string, StatementBatch>>();
  for (const debtor of fundDebtorItems(input)) {
    if (debtor.state !== 'sent') continue;
    const invoice = debtor.item.invoice;
    // A sent claim always names its batch (fundDebtorItems)
    const batchId = invoice.batchId;
    if (!batchId) continue;
    const batches = funds.get(debtor.fund) ?? new Map<string, StatementBatch>();
    funds.set(debtor.fund, batches);
    let batch = batches.get(batchId);
    if (!batch) {
      const sentOn = dayOf(debtor.batch?.sentAt ?? null);
      batch = {
        batchId,
        batchNumber: debtor.batch?.batchNumber ?? null,
        fundCode: debtor.batch?.fundReference ?? null,
        sentOn,
        daysSinceSent: sentOn ? daysBetweenKeys(sentOn, input.todayKey) : null,
        readable: !debtor.unreadableBatch,
        lines: [],
        owedCents: 0
      };
      batches.set(batchId, batch);
    }
    batch.lines.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientId: invoice.patientId,
      patientName: (invoice.patientId && input.patientNames[invoice.patientId]) || 'Patient',
      serviceDate: (invoice.visitId && input.serviceDateByVisit[invoice.visitId]) || toDateKey(invoice.issueDate),
      owedCents: debtor.cents,
      ageDays: debtor.item.ageDays,
      ageBand: debtor.item.ageBand
    });
    batch.owedCents += debtor.cents;
  }

  const statements: FundStatement[] = [...funds.entries()].map(([fund, byBatch]) => {
    const batches = [...byBatch.values()]
      .map(batch => ({
        ...batch,
        lines: [...batch.lines].sort((a, b) =>
          byText(a.patientName, b.patientName) || (a.serviceDate ?? '').localeCompare(b.serviceDate ?? '') || byText(a.invoiceNumber, b.invoiceNumber))
      }))
      // Oldest sent first, so the claims to chase first are on top; a batch whose date is unknown last
      .sort((a, b) => (a.sentOn ?? '9999-12-31').localeCompare(b.sentOn ?? '9999-12-31') || (a.batchNumber ?? Infinity) - (b.batchNumber ?? Infinity));
    const lines = batches.flatMap(batch => batch.lines);
    const byAgeBand = emptyBands();
    lines.forEach(line => {
      byAgeBand[line.ageBand] += line.owedCents;
    });
    const ages = lines.map(line => line.ageDays).filter((days): days is number => days !== null);
    return {
      fund,
      fundCodes: [...new Set(batches.map(batch => batch.fundCode).filter((code): code is string => !!code))].sort(),
      batches,
      claimCount: lines.length,
      owedCents: batches.reduce((sum, batch) => sum + batch.owedCents, 0),
      byAgeBand,
      oldestAgeDays: ages.length > 0 ? Math.max(...ages) : null
    };
  });

  statements.sort((a, b) => b.owedCents - a.owedCents || byText(a.fund, b.fund));
  return {
    asOfKey: input.todayKey,
    funds: statements,
    totalCents: statements.reduce((sum, statement) => sum + statement.owedCents, 0)
  };
}

/** How a batch is named on the statement: its number and fund code, when and how long ago it was sent */
export function batchHeading(batch: StatementBatch): string {
  if (!batch.readable) return 'A batch that could not be read';
  const name = `Batch ${batch.batchNumber ?? '-'}${batch.fundCode ? ` (${batch.fundCode})` : ''}`;
  if (!batch.sentOn) return `${name}, date sent not recorded`;
  const ago = batch.daysSinceSent === null ? '' : batch.daysSinceSent === 1 ? ', 1 day ago' : `, ${batch.daysSinceSent} days ago`;
  return `${name}, sent ${formatServiceDate(batch.sentOn)}${ago}`;
}

const AGE_LABEL: Record<AgeBand, string> = Object.fromEntries(AGE_BANDS.map(band => [band.key, band.label])) as Record<AgeBand, string>;

export const ageBandLabel = (band: AgeBand): string => AGE_LABEL[band];

const nad = (cents: number): string => formatNad(fromCents(cents));

const STATEMENT_COLUMNS: ExportColumn[] = [
  { header: 'Fund', type: 'text' },
  { header: 'Batch', type: 'count' },
  { header: 'Fund code', type: 'text' },
  { header: 'Date sent', type: 'date' },
  { header: 'Days since sent', type: 'count' },
  { header: 'Patient', type: 'text' },
  { header: 'Invoice', type: 'text' },
  { header: 'Date of service', type: 'date' },
  { header: 'Age (days)', type: 'count' },
  { header: 'Age', type: 'text' },
  { header: 'Owed by the fund', type: 'money' }
];

/** The statement as a spreadsheet (financeExport's CSV rules: plain 2-decimal amounts, yyyy-MM-dd dates), with its total */
export function fundStatementCsv(statement: FundStatement): string {
  const rows: CsvCell[][] = statement.batches.flatMap(batch => batch.lines.map(line => [
    statement.fund, batch.batchNumber, batch.fundCode, batch.sentOn, batch.daysSinceSent,
    line.patientName, line.invoiceNumber, line.serviceDate, line.ageDays, AGE_LABEL[line.ageBand], fromCents(line.owedCents)
  ]));
  const total: CsvCell[] = ['Total', null, null, null, null, `${statement.claimCount} claim(s)`, null, null, null, null, fromCents(statement.owedCents)];
  return toCsv(STATEMENT_COLUMNS, [...rows, total]);
}

export interface StatementPaper {
  practiceName: string;
  practiceNumber: string | null;
}

const STATEMENT_STYLE = `${PAGE_STYLE}
.lines th.num,.lines td.num{text-align:right}
.lines tr.group td{background:#F3F4F6;font-weight:600;color:#374151}.bands{border-collapse:collapse;font-size:12px;margin:8px 0 16px}
.bands th,.bands td{padding:4px 10px;border:1px solid #E5E7EB;text-align:right}.bands th{background:#F9FAFB;color:#4B5563;font-weight:600}`;

/** The statement as a printable page for the fund (everything escaped; N$ to the cent; dates day first) */
export function fundStatementHtml(statement: FundStatement, asOfKey: string, paper: StatementPaper): string {
  const facts: Array<[string, string]> = [
    ['Practice', `${paper.practiceName}${paper.practiceNumber ? ` (practice number ${paper.practiceNumber})` : ''}`],
    ['Fund', `${statement.fund === UNKNOWN_SCHEME ? 'Fund not recorded' : statement.fund}${statement.fundCodes.length > 0 ? ` (${statement.fundCodes.join(', ')})` : ''}`],
    ['As at', formatServiceDate(asOfKey)],
    ['Claims', String(statement.claimCount)],
    ['Oldest', statement.oldestAgeDays === null ? '-' : `${statement.oldestAgeDays} days`],
    ['Total outstanding', nad(statement.owedCents)]
  ];
  const bands = `<table class="bands"><tr>${AGE_BANDS.map(band => `<th>${escapeHtml(band.label)}</th>`).join('')}</tr>`
    + `<tr>${AGE_BANDS.map(band => `<td>${escapeHtml(nad(statement.byAgeBand[band.key]))}</td>`).join('')}</tr></table>`;
  const body = statement.batches.map(batch =>
    `<tr class="group"><td colspan="4">${escapeHtml(batchHeading(batch))}</td><td class="num">${escapeHtml(nad(batch.owedCents))}</td></tr>`
    + batch.lines.map(line => `<tr><td>${escapeHtml(line.patientName)}</td><td>${escapeHtml(line.invoiceNumber)}</td>`
      + `<td>${escapeHtml(formatServiceDate(line.serviceDate))}</td><td class="num">${line.ageDays ?? '-'}</td><td class="num">${escapeHtml(nad(line.owedCents))}</td></tr>`).join('')
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Outstanding claims ${escapeHtml(statement.fund)}</title><style>${STATEMENT_STYLE}</style></head><body>
<h1>Statement of outstanding claims</h1>
<p class="muted">Claims sent to the fund that it has not paid, credited or written off</p>
<table class="facts">${facts.map(([label, value]) => `<tr><td class="muted">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
${bands}
<table class="lines"><thead><tr><th>Patient</th><th>Invoice</th><th>Date of service</th><th class="num">Age (days)</th><th class="num">Owed</th></tr></thead>
<tbody>${body}</tbody><tfoot><tr><td colspan="4">${statement.claimCount} claim(s)</td><td class="num">${escapeHtml(nad(statement.owedCents))}</td></tr></tfoot></table>
<p class="note">Ages count the days since the invoice date. Amounts are what the fund still owes on each invoice after its payments, credit notes and write-offs.</p>
</body></html>`;
}
