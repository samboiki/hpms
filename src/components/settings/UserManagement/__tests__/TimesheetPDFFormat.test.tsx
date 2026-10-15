/**
 * The staff timesheet PDF is the owner's own design (git bd02f25; Settings > Users > Timesheets > Premium PDF). He asked
 * on 15 Oct 2026 for the timesheets he prints to keep their format. This pins the A4 sheet the PDF pictures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ default: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import TimesheetPDFGeneratorOptimized from '../TimesheetPDFGeneratorOptimized';

// Invented staff member and practice
const days = [1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29, 30];
const timesheet = {
  id: 'timesheet-1',
  user_id: 'staff-2',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  total_hours: 167.5,
  regular_hours: 160,
  overtime_hours: 7.5,
  status: 'submitted',
  user: { full_name: 'Example Staff', email: 'staff@example.test' },
  entries: days.map(day => ({
    date: `2026-09-${String(day).padStart(2, '0')}`,
    start_time: '08:00',
    end_time: day === 30 ? '18:00' : '16:00',
    total_hours: day === 30 ? 9.5 : 7.5,
    task_description: day === 30 ? 'Month-end filing' : 'Front desk',
    is_overtime: day === 30
  }))
};
const practice = { name: 'Example Practice', contact_email: 'reception@example.test', contact_phone: '+264 61 000 0000', license_number: 'LIC-0000', tax_number: 'TX-0000000' };

const sheet = () => {
  const { container } = render(<TimesheetPDFGeneratorOptimized timesheet={timesheet} practice={practice} />);
  // The A4 sheet the PDF pictures (the Generate PDF button above it is not part of the printout)
  return container.querySelector('div[style*="width: 794px"]') as HTMLElement;
};

describe("the owner's timesheet PDF", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 14, 30));
  });
  afterEach(() => vi.useRealTimers());

  it('is drawn as he designed it (snapshot)', () => {
    expect(sheet().outerHTML).toMatchSnapshot();
  });

  it('keeps his sections and wording in order', () => {
    const text = sheet().textContent?.replace(/\s+/g, ' ') ?? '';
    const order = [
      'Example Practice',
      'TIMESHEET',
      'September 2026',
      'Example Staff',
      'Total Hours',
      '167.5h',
      'Mon 07 Sep',
      '8:00 AM',
      '4:00 PM',
      'Front desk',
      '7.5h',
      'Wed 30 Sep',
      '9.5h OT',
      'Employee Signature',
      'Practice Manager / Supervisor'
    ];
    let from = 0;
    order.forEach(part => {
      const at = text.indexOf(part, from);
      expect(at, part).toBeGreaterThanOrEqual(from);
      from = at + part.length;
    });
  });

  // His footer date: "Oct 15, 2026 14:30" (it had been changed to "15 Oct 2026 14:30")
  it('dates the sheet in his footer format', () => {
    expect(sheet().textContent).toContain('Generated on Oct 15, 2026 14:30');
  });

  it('is an A4 page in his fonts and header colour', () => {
    const element = sheet();
    expect(element.style.width).toBe('794px');
    expect(element.style.height).toBe('1123px');
    expect(element.style.fontFamily).toContain('Montserrat');
    expect(element.innerHTML).toContain('background: rgb(83, 93, 142)');
  });
});
