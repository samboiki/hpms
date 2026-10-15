/**
 * The patient's account statement is the owner's own design (git bd02f25), printed from Statement on his invoice table
 * on the patient file's Billing tab. He asked on 15 Oct 2026 for its format to be left alone. This pins the page the
 * PDF pictures, with invented data.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const captured = vi.hoisted(() => ({ pages: [] as string[], saved: [] as string[] }));

vi.mock('html2canvas', () => ({
  default: async (element: HTMLElement) => {
    captured.pages.push(element.outerHTML);
    return { width: 1600, height: 2262, toDataURL: () => 'data:image/jpeg;base64,AAAA' };
  }
}));
vi.mock('jspdf', () => ({
  default: class {
    internal = { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } };
    addImage() {}
    addPage() {}
    save(name: string) {
      captured.saved.push(name);
    }
  }
}));
vi.mock('../../../lib/supabase', () => {
  const rows: Record<string, unknown> = {
    patients: { id: 'patient-1', first_name: 'Anna', last_name: 'Example', email: 'anna@example.test', cell_number: '+264 81 000 0001' },
    practices: {
      id: 'practice-1',
      name: 'Example Practice',
      logo_url: 'https://example.test/logo.png',
      address: '12 Example Street',
      city: 'Windhoek',
      country: 'Namibia',
      postal_code: '9000',
      contact_phone: '+264 61 000 0000',
      contact_email: 'reception@example.test',
      domain: 'example.test',
      bank_name: 'Example Bank',
      account_number: '000111222333',
      branch_code: '000000'
    }
  };
  return {
    supabase: {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: rows[table] ?? null, error: null })
        };
        return query;
      }
    }
  };
});
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'staff-1', practice_id: 'practice-1' }, selectedPracticeId: 'practice-1' })
}));
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => ({ currentTheme: {} }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const drop = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap']);
  const element = (tag: string) => ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !drop.has(key))), children);
  return { motion: { div: element('div') } };
});

import PrintStatementModal from '../PrintStatementModal';

// Invented invoices (the Billing tab's list)
const invoices = [
  {
    id: 'invoice-1',
    invoice_number: 'INV-000123',
    visit_id: 'visit-1',
    payment_status: 'paid' as const,
    total: 615.5,
    created_at: '2026-10-07T09:30:00+02:00',
    medical_aid_covered: 492.4,
    patient_portion: 123.1,
    services: [
      { id: 's1', code: '0190', description: 'Consultation: new patient', quantity: 1, unit_price: 520, total_price: 520, medical_aid_covered: 416, patient_portion: 104 },
      { id: 's2', code: '0201', description: 'Injection (intramuscular)', quantity: 1, unit_price: 95.5, total_price: 95.5, medical_aid_covered: 76.4, patient_portion: 19.1 }
    ]
  },
  {
    id: 'invoice-2',
    invoice_number: 'INV-000118',
    visit_id: 'visit-2',
    payment_status: 'pending' as const,
    total: 610,
    created_at: '2026-09-21T11:00:00+02:00',
    medical_aid_covered: 488,
    patient_portion: 122,
    services: [{ id: 's3', code: '0190', description: 'Consultation: follow-up', quantity: 1, unit_price: 610, total_price: 610, medical_aid_covered: 488, patient_portion: 122 }]
  }
];

const compact = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const textOf = (html: string) => compact(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const printStatement = async () => {
  render(<PrintStatementModal isOpen onClose={vi.fn()} patientId="patient-1" invoices={invoices} />);
  fireEvent.click(screen.getByDisplayValue('current_year'));
  fireEvent.click(screen.getByRole('button', { name: /Generate Statement/ }));
  await waitFor(() => expect(captured.saved).toHaveLength(1));
  return captured.pages[0];
};

describe("the owner's account statement", () => {
  beforeEach(() => {
    captured.pages = [];
    captured.saved = [];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // The page waits for its fonts; the test browser has no font loading
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is drawn as he designed it (snapshot)', async () => {
    expect(compact(await printStatement())).toMatchSnapshot();
  });

  it('keeps his sections and wording in order, with the practice logo first', async () => {
    const page = await printStatement();
    expect(compact(page).indexOf('<img src="https://example.test/logo.png"')).toBeLessThan(compact(page).indexOf('Example Practice'));
    const text = textOf(page);
    const order = [
      'Example Practice',
      'ACCOUNT STATEMENT',
      'Period: 2026',
      'Patient Information',
      'Name: Anna Example',
      'Statement Summary',
      'Total Invoices: 2',
      'Code Description Qty Service Price Medical Aid Patient Portion',
      '0190 Consultation: new patient 1 N$ 520.00 N$ 416.00 N$ 104.00',
      'Subtotal:',
      'Patient Portion:',
      'Banking Details',
      // His footer wording exactly (a full stop had been added after the practice name)
      'Payment is due within 30 days. Thank you for choosing Example Practice For inquiries: +264 61 000 0000 • reception@example.test',
      'Statement generated by OneHealth Systems • www.onehealthsystems.com • © 2024'
    ];
    let from = 0;
    order.forEach(part => {
      const at = text.indexOf(part, from);
      expect(at, part).toBeGreaterThanOrEqual(from);
      from = at + part.length;
    });
  });

  // The kept content changes (listed for the owner): his statement printed one hard-coded bank account on every
  // practice's statement, and called the total of all invoices, paid ones included, the amount due
  it("prints the practice's own bank account and calls the total what it is", async () => {
    const text = textOf(await printStatement());
    expect(text).toContain('Bank: Example Bank Account: 000111222333 Branch: 000000');
    expect(text).not.toContain('4433221009');
    expect(text).toContain('Total Invoiced: N$ 1225.50');
    expect(text).not.toContain('Total Amount Due');
  });
});
