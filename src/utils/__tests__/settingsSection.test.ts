/**
 * Links from Finance, Stock and the automations say where they go ("Settings > Practice > Practice Overhead",
 * "Settings > Users > Payroll"). Before, they all landed on the tab's first page and staff had to find the section
 * themselves; these tests hold the link builders and the section Settings opens to the same names.
 */
import { describe, expect, it } from 'vitest';
import { payrollLink, practiceInventoryLink, practiceOverheadLink } from '../../components/billing/invoiceLinks';
import { PRACTICE_SECTIONS, USER_SECTIONS, sectionFromAddress } from '../settingsSection';

const searchOf = (link: string): string => link.slice(link.indexOf('?'));
const tabOf = (link: string): string | null => new URLSearchParams(searchOf(link)).get('tab');

describe('sectionFromAddress', () => {
  it('opens the section the address names', () => {
    expect(sectionFromAddress(PRACTICE_SECTIONS, 'profile', '?tab=practice&section=branches')).toBe('branches');
    expect(sectionFromAddress(USER_SECTIONS, 'overview', '?tab=users&section=leave')).toBe('leave');
  });

  // An old bookmark or a mistyped link still opens the tab, on its first page
  it('falls back to the first page for a missing or unknown section', () => {
    expect(sectionFromAddress(PRACTICE_SECTIONS, 'profile', '?tab=practice')).toBe('profile');
    expect(sectionFromAddress(PRACTICE_SECTIONS, 'profile', '?tab=practice&section=payroll')).toBe('profile');
    expect(sectionFromAddress(USER_SECTIONS, 'overview', '')).toBe('overview');
  });
});

describe('links into Settings sections', () => {
  it('"Manage payroll" and the payroll automation open Users > Payroll', () => {
    expect(tabOf(payrollLink())).toBe('users');
    expect(sectionFromAddress(USER_SECTIONS, 'overview', searchOf(payrollLink()))).toBe('payroll');
  });

  it('"Manage expenses" and the expense report rows open Practice > Practice Overhead', () => {
    expect(tabOf(practiceOverheadLink())).toBe('practice');
    expect(sectionFromAddress(PRACTICE_SECTIONS, 'profile', searchOf(practiceOverheadLink()))).toBe('expenses');
  });

  it('Stock\'s "Settings > Practice > Inventory" opens the old inventory list', () => {
    expect(tabOf(practiceInventoryLink())).toBe('practice');
    expect(sectionFromAddress(PRACTICE_SECTIONS, 'profile', searchOf(practiceInventoryLink()))).toBe('inventory');
  });
});
