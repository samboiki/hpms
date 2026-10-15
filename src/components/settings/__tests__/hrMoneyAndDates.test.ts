import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

// Payslips, salaries, benefits and timesheets are read by Namibian staff and handed to banks and the Receiver: money is
// written N$ 1,234.50 (formatNad), never "NAD 1234.50", and dates day first (7 Oct 2026), never "Oct 07, 2026"
const ROOT = 'src/components/settings';

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

// The one exception: the owner's own timesheet print stamps its footer month first, as he designed it (git bd02f25;
// owner, 15 Oct 2026: "That format, please do not touch it"). Only that footer line in his two timesheet prints is
// excused; any other month-first date, in those files or elsewhere in Settings, still fails.
const OWNER_TIMESHEET_PRINTS = ['TimesheetPDFGeneratorFixed.tsx', 'TimesheetPDFGeneratorOptimized.tsx'];
const OWNER_TIMESHEET_FOOTER = "Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}";
const isOwnerTimesheetFooter = (file: string, line: string): boolean =>
  OWNER_TIMESHEET_PRINTS.includes(basename(file)) && line.trim() === OWNER_TIMESHEET_FOOTER;

const linesMatching = (pattern: RegExp, excused: (file: string, line: string) => boolean = () => false): string[] =>
  sourceFiles(ROOT).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line, index) => ({ line, at: `${relative(process.cwd(), file)}:${index + 1}` }))
      .filter(({ line }) => pattern.test(line) && !excused(file, line))
      .map(({ at }) => at)
  );

describe('money and dates in Settings (staff, payroll, leave, timesheets)', () => {
  it('shows amounts as N$ through formatNad, not "NAD" with toFixed', () => {
    expect(linesMatching(/NAD \$\{|NAD \{|`NAD /)).toEqual([]);
  });

  it('writes dates day first, not month first', () => {
    expect(linesMatching(/'MMM dd?(, yyyy)?['\s]|'MMMM dd?, yyyy'/, isOwnerTimesheetFooter)).toEqual([]);
  });
});
