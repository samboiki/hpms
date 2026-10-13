import { describe, expect, it } from 'vitest';
import { recogniseColumns } from '../eminanceFields';
import { readRecalls, recallListDescription, recallListName } from '../eminanceRecalls';
import { parseDelimitedText, toImportTable } from '../tableFile';

const TODAY = '2026-10-07';

describe('recallListName', () => {
  it('puts a recall on the list of its month, so staff contact each month what is due then', () => {
    expect(recallListName('2026-11-14', TODAY)).toBe('Eminance recalls: Nov 2026');
    expect(recallListName('2026-10-07', TODAY)).toBe('Eminance recalls: Oct 2026');
  });

  it('collects recalls that are already due on one "overdue" list, which needs attention first', () => {
    expect(recallListName('2026-10-06', TODAY)).toBe('Eminance recalls: overdue');
  });

  it('collects recalls more than a year ahead on one "later" list instead of making a list for every month', () => {
    expect(recallListName('2027-10-31', TODAY)).toBe('Eminance recalls: Oct 2027');
    expect(recallListName('2027-11-01', TODAY)).toBe('Eminance recalls: later');
  });
});

describe('recallListDescription', () => {
  it('says what the list is and the most common reasons, within the 300 characters a list description allows', () => {
    const reasons = new Map([['Check-up', 12], ['Scale and polish', 4]]);
    expect(recallListDescription('Eminance recalls: Nov 2026', reasons, TODAY)).toBe(
      'Patients whose Eminance recall falls in Nov 2026, brought over on 7 Oct 2026. Reasons: Check-up (12), Scale and polish (4).'
    );
    const long = new Map(Array.from({ length: 20 }, (_, index) => [`A very long recall reason number ${index} ${'x'.repeat(60)}`, 1]));
    expect(recallListDescription('Eminance recalls: overdue', long, TODAY).length).toBeLessThanOrEqual(300);
  });
});

describe('readRecalls', () => {
  it("reads Eminance's recall view: account, the patient's name and the recall date and reason", () => {
    const table = toImportTable(parseDelimitedText('Account,Patient,Recall Date,Reason\n101,"KANDEMO, Petrus",14/11/2026,Check-up\n0000102,TESTA J,,Check-up'), 0);
    const [first, second] = readRecalls(table, recogniseColumns(table.headers, 'recalls'), { fileName: 'recalls.csv', fileIndex: 2, today: TODAY });
    expect(first).toMatchObject({ key: 'r:2:2', accountNumber: '0000101', firstName: 'Petrus', surname: 'KANDEMO', dueDate: '2026-11-14', reason: 'Check-up' });
    expect(second.problems).toContainEqual({ message: 'No recall date', blocking: true });
  });
});
