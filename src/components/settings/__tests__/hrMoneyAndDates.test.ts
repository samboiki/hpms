import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Payslips, salaries, benefits and timesheets are read by Namibian staff and handed to banks and the Receiver: money is
// written N$ 1,234.50 (formatNad), never "NAD 1234.50", and dates day first (7 Oct 2026), never "Oct 07, 2026"
const ROOT = 'src/components/settings';

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const linesMatching = (pattern: RegExp): string[] =>
  sourceFiles(ROOT).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line, index) => ({ line, at: `${relative(process.cwd(), file)}:${index + 1}` }))
      .filter(({ line }) => pattern.test(line))
      .map(({ at }) => at)
  );

describe('money and dates in Settings (staff, payroll, leave, timesheets)', () => {
  it('shows amounts as N$ through formatNad, not "NAD" with toFixed', () => {
    expect(linesMatching(/NAD \$\{|NAD \{|`NAD /)).toEqual([]);
  });

  it('writes dates day first, not month first', () => {
    expect(linesMatching(/'MMM dd?(, yyyy)?['\s]|'MMMM dd?, yyyy'/)).toEqual([]);
  });
});
