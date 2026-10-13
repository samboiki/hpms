import { describe, it, expect } from 'vitest';
import { displayValue, escapeHtml, exportFileName, reportToCsv, reportToHtml, slugify, toCsv, type ReportTable } from '../financeExport';

describe('toCsv', () => {
  const columns = [
    { header: 'Patient', type: 'text' as const },
    { header: 'Issued', type: 'date' as const },
    { header: 'Amount', type: 'money' as const },
    { header: 'Invoices', type: 'count' as const },
    { header: 'Share %', type: 'percent' as const }
  ];

  it('writes money as plain 2-decimal numbers and shares as percentages, so spreadsheets can sum them', () => {
    expect(toCsv(columns, [['Anna', '2026-10-01', 1234.5, 3, 0.4567]]))
      .toBe('Patient,Issued,Amount,Invoices,Share %\r\nAnna,2026-10-01,1234.50,3,45.7');
  });

  it('keeps negative amounts numeric (a refund must stay a number, not text)', () => {
    expect(toCsv(columns, [['Refund', null, -80, 1, null]]).split('\r\n')[1]).toBe('Refund,,-80.00,1,');
  });

  it('quotes text containing commas, quotes or line breaks', () => {
    expect(toCsv(columns, [['Shilongo, N "Ndapewa"', null, 1, 1, null]]).split('\r\n')[1])
      .toBe('"Shilongo, N ""Ndapewa""",,1.00,1,');
  });

  it.each(['=HYPERLINK("http://x")', '+27 81 123', '-1+1', '@SUM(A1)'])(
    'neutralises "%s" so it is not run as a spreadsheet formula',
    value => {
      const firstCell = toCsv(columns, [[value, null, null, null, null]]).split('\r\n')[1].split(',')[0];
      // Quoted cells start with a double quote; the apostrophe guard follows it
      expect(firstCell.replace(/^"/, '')).toMatch(/^'/);
    }
  );

  it('leaves blanks for missing or non-finite numbers instead of writing NaN', () => {
    expect(toCsv(columns, [[null, undefined, Number.NaN, Number.POSITIVE_INFINITY, null]]).split('\r\n')[1]).toBe(',,,,');
  });

  it('appends the totals row to a report export', () => {
    const report: ReportTable = {
      title: 'Collections',
      basis: 'Issued 1-6 Oct 2026',
      columns: [{ header: 'Method', type: 'text' }, { header: 'Amount', type: 'money' }],
      rows: [['Cash', 75]],
      totals: ['Total', 75]
    };
    expect(reportToCsv(report)).toBe('Method,Amount\r\nCash,75.00\r\nTotal,75.00');
  });
});

describe('file names', () => {
  it('builds safe, dated file names', () => {
    expect(slugify('AR aging (as at 6 Oct)')).toBe('ar-aging-as-at-6-oct');
    expect(exportFileName('Revenue by tariff code', new Date(2026, 9, 6))).toBe('revenue-by-tariff-code-2026-10-06.csv');
  });
});

describe('print HTML', () => {
  const report: ReportTable = {
    title: 'Accounts receivable aging',
    basis: 'As at 6 Oct 2026',
    columns: [{ header: 'Patient', type: 'text' }, { header: 'Due', type: 'date' }, { header: 'Owed', type: 'money' }],
    rows: [['<script>alert(1)</script>', '2026-09-01', 1500]],
    totals: ['Total', null, 1500],
    notes: ['Derived from HPMS invoices & payslips']
  };

  it('escapes data so a patient name cannot inject markup into the print window', () => {
    const html = reportToHtml(report, 'Practice <A>', new Date(2026, 9, 6, 10, 30));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Practice &lt;A&gt;');
  });

  it('formats cells for reading (N$, dates) and includes totals and notes', () => {
    const html = reportToHtml(report, 'Practice', new Date(2026, 9, 6, 10, 30));
    expect(html).toContain('N$ 1,500.00');
    expect(html).toContain('1 Sep 2026');
    expect(html).toContain('<tfoot>');
    expect(html).toContain('Derived from HPMS invoices &amp; payslips');
    expect(html).toContain('Generated 6 Oct 2026, 10:30');
  });

  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('displays a dash for missing values rather than 0', () => {
    expect(displayValue(null, 'money')).toBe('—');
    expect(displayValue(0, 'money')).toBe('N$ 0.00');
  });

  it('shows the "Total" label of a report listed by day as written, instead of failing to read it as a date', () => {
    const byDay: ReportTable = {
      title: 'Daily takings',
      basis: 'Invoices marked paid 1-6 Oct 2026',
      columns: [{ header: 'Day', type: 'date' }, { header: 'Cash', type: 'money' }],
      rows: [['2026-10-02', 150]],
      totals: ['Total', 150]
    };
    expect(displayValue('Total', 'date')).toBe('Total');
    expect(displayValue('2026-10-02', 'date')).toBe('2 Oct 2026');
    expect(reportToHtml(byDay, 'Practice', new Date(2026, 9, 6))).toContain('<th class="">Total</th>');
  });
});
