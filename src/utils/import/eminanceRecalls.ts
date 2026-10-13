/**
 * Recall dates from Eminance (the recall view's CSV export, or a recall column in the patient list).
 *
 * Eminance keeps a recall per person (RECALLS: ACCOUNT_KEY, PATIENT_KEY, RECALLDATE, a reason and a recall type).
 * OneHealth's patient lists are where staff see who to contact and send the message from, so each recall puts the
 * person on a manual list for its month: "Eminance recalls: Nov 2026". Recalls that are already due go on
 * "Eminance recalls: overdue", and those more than a year ahead on "Eminance recalls: later".
 */
import type { Cell } from '../billing/tariffImport';
import { formatServiceDate } from '../billing/dates';
import { normalizeDependantCode } from '../patients/medicalAidMember';
import type { ColumnMapping, FieldKey } from './eminanceFields';
import type { RowProblem } from './eminancePeople';
import { canonicalAccountNumber, cleanText, parseImportDate, splitFullName } from './importValues';
import type { ImportTable } from './tableFile';

export const RECALL_LIST_PREFIX = 'Eminance recalls';
/** Recall months that get their own list; later recalls share one */
export const RECALL_MONTHS_AHEAD = 12;

export interface RecallRow {
  key: string;
  fileName: string;
  line: number;
  accountNumber: string;
  dependantNumber: string | null;
  dependantCode: string | null;
  firstName: string;
  surname: string;
  dueDate: string | null;
  reason: string | null;
  problems: RowProblem[];
}

const cellAt = (cells: readonly Cell[], mapping: ColumnMapping, key: FieldKey): Cell =>
  mapping[key] === undefined ? null : cells[mapping[key] as number];

export function readRecalls(table: ImportTable, mapping: ColumnMapping, options: { fileName: string; fileIndex: number; today: string }): RecallRow[] {
  return table.rows.map(row => {
    const problems: RowProblem[] = [];
    const accountNumber = canonicalAccountNumber(cellAt(row.cells, mapping, 'accountNumber'));
    if (!accountNumber) problems.push({ message: 'No account number', blocking: true });
    const dueDate = parseImportDate(cellAt(row.cells, mapping, 'recallDate'), options.today, 'near');
    if (!dueDate) problems.push({ message: 'No recall date', blocking: true });
    let firstName = cleanText(cellAt(row.cells, mapping, 'firstName'), 100);
    let surname = cleanText(cellAt(row.cells, mapping, 'surname'), 100);
    if (!firstName && !surname) {
      const split = splitFullName(cleanText(cellAt(row.cells, mapping, 'fullName')));
      firstName = split.firstName;
      surname = split.surname;
    }
    const dependantNumber = cleanText(cellAt(row.cells, mapping, 'dependantNumber'), 10);
    const dependantCode = normalizeDependantCode(cleanText(cellAt(row.cells, mapping, 'dependantCode'), 10));
    return {
      key: `r:${options.fileIndex}:${row.line}`,
      fileName: options.fileName,
      line: row.line,
      accountNumber,
      dependantNumber: dependantNumber || null,
      dependantCode: dependantCode || null,
      firstName,
      surname,
      dueDate,
      reason: cleanText(cellAt(row.cells, mapping, 'recallReason'), 100) || null,
      problems
    };
  });
}

const monthIndex = (key: string): number => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

/** "Eminance recalls: Nov 2026", or "... overdue" before today, or "... later" more than 12 months ahead */
export function recallListName(dueDate: string, today: string): string {
  if (dueDate < today) return `${RECALL_LIST_PREFIX}: overdue`;
  if (monthIndex(dueDate) - monthIndex(today) > RECALL_MONTHS_AHEAD) return `${RECALL_LIST_PREFIX}: later`;
  // formatServiceDate gives "7 Nov 2026": the month and year are the list's name
  return `${RECALL_LIST_PREFIX}: ${formatServiceDate(dueDate).split(' ').slice(1).join(' ')}`;
}

/** What the list is, with the most common reasons Eminance gave (at most 300 characters, as lists allow) */
export function recallListDescription(listName: string, reasons: ReadonlyMap<string, number>, today: string): string {
  const when = listName.endsWith(': overdue')
    ? 'whose Eminance recall date had passed'
    : listName.endsWith(': later')
      ? `whose Eminance recall is more than ${RECALL_MONTHS_AHEAD} months ahead`
      : `whose Eminance recall falls in ${listName.slice(RECALL_LIST_PREFIX.length + 2)}`;
  const top = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([reason, count]) => `${reason} (${count})`)
    .join(', ');
  const text = `Patients ${when}, brought over on ${formatServiceDate(today)}.${top ? ` Reasons: ${top}.` : ''}`;
  return text.length <= 300 ? text : `${text.slice(0, 297)}...`;
}
