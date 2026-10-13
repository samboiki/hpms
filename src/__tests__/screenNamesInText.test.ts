import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Text that tells staff where to go must use the name they see in the sidebar: the Communications page is "Messages"
// there, so "Communications > Lists" sent people looking for a menu item that does not exist
const ROOTS = ['src/components', 'src/pages', 'src/patientPortal'];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

describe('places named in the text staff read', () => {
  it('say Messages, not Communications, for the page the sidebar calls Messages', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ line, at: `${relative(process.cwd(), file)}:${index + 1}` }))
        // JSX text writes ">" as &gt;; a string shown to staff is in quotes (code comments are neither)
        .filter(({ line }) => /Communications &gt;/.test(line) || /['"`][^'"`]*Communications > /.test(line))
        .map(({ at }) => at)
    );
    expect(offenders).toEqual([]);
  });

  // Finance's tabs are Overview, Invoicing, Quotes, Payments, Debtors, Ledgers, Reports, Batches and Remittances:
  // "Finance > Claims" sent staff looking for a tab that does not exist (claims are sent from Finance > Batches)
  it('say Finance > Batches, not a "Claims" tab Finance does not have', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ line, at: `${relative(process.cwd(), file)}:${index + 1}` }))
        .filter(({ line }) => /Finance (&gt;|>) Claims\b/.test(line))
        .map(({ at }) => at)
    );
    expect(offenders).toEqual([]);
  });
});
