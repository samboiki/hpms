import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PatientBillingTab from '../PatientBillingTab';
import PatientAccountTab from '../PatientAccountTab';
import type { PatientInvoicesResult } from '../usePatientInvoices';

// The patient file's Billing tab is the owner's design (git bd02f25): his invoice table and nothing else. On 15 Oct
// 2026 he asked for it back, and moved what was added since (the account, claims and quotes) to its own Account tab.
// The parts are replaced by labelled stand-ins: these tests are about what each tab shows and what the table is given.

const tableProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('../../billing/CleanInvoiceTable', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.last = props;
    return <section aria-label="Invoice History">Invoice History</section>;
  }
}));
vi.mock('../../finance/remittances/PatientClaimsNotice', () => ({
  PatientClaimsNotice: () => <section aria-label="Claims to follow up">Claims to follow up</section>
}));
vi.mock('../PatientBillingPanel', () => ({
  default: (props: { accountFocusKey?: number }) => <section aria-label="Account">Account {props.accountFocusKey}</section>
}));
vi.mock('../../quotes/QuotePanels', () => ({
  PatientQuotesPanel: () => <section aria-label="Quotes">Quotes</section>
}));

const invoices = { invoices: [], reload: vi.fn() } as unknown as PatientInvoicesResult;
const handlers = { onVisitClick: vi.fn(), onStatusChange: vi.fn(), onEmailInvoice: vi.fn(), onPrintInvoice: vi.fn() };
const sectionsOf = (container: HTMLElement) => Array.from(container.querySelectorAll('section')).map(node => node.getAttribute('aria-label'));

describe("the patient's Billing tab: the owner's design, exactly", () => {
  const renderTab = () => render(<PatientBillingTab invoiceTable={{ patientId: 'patient-1', ...handlers, isPrintingPDF: false }} />);

  // As in git bd02f25: <div className="space-y-6"><CleanInvoiceTable .../></div>, nothing above or below it
  it('shows his invoice table and nothing else', () => {
    const { container } = renderTab();
    expect(sectionsOf(container)).toEqual(['Invoice History']);
    expect(container.firstElementChild).toHaveClass('space-y-6');
    expect(container.firstElementChild?.children).toHaveLength(1);
    expect(screen.queryByText(/Manage invoices|Account and payments/)).not.toBeInTheDocument();
  });

  // Print per invoice, email, status and the visit link are his table's actions; invoices are never deleted
  // (owner, 13 Oct 2026), so it is given no delete handler
  it('gives his table the patient and its actions, and no way to delete an invoice', () => {
    renderTab();
    expect(tableProps.last).toMatchObject({ patientId: 'patient-1', ...handlers, isPrintingPDF: false });
    expect(tableProps.last).not.toHaveProperty('onDeleteInvoice');
  });
});

describe("the patient's Account tab: what was added after his design", () => {
  it('shows the claims to follow up, the account and the quotes, and none of his invoice table', () => {
    const { container } = render(
      <PatientAccountTab
        practiceId="practice-1"
        patient={{ id: 'patient-1', name: 'Anna Example', phone: '+264 81 000 0001', email: 'anna@example.test' }}
        medicalAidProvider="Example Medical Fund"
        invoices={invoices}
        visitsById={new Map()}
        onOpenVisit={vi.fn()}
        accountFocusKey={42}
      />
    );
    expect(sectionsOf(container)).toEqual(['Claims to follow up', 'Account', 'Quotes']);
    // An account alert tapped beside the patient's name brings the account into view here
    expect(screen.getByRole('region', { name: 'Account' })).toHaveTextContent('Account 42');
  });
});
