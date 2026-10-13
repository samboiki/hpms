/**
 * The payment step of "Invoice and take payment": after the visit is saved, the existing Receive
 * payment opens for the invoice just made, over the visit, with the patient's name on the receipt
 * and the amount the patient owes now; the visit closes only when the payment step is done.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  loadPatientNames: vi.fn(),
  dialogProps: [] as Array<Record<string, unknown>>
}));

vi.mock('../../finance/debtors/debtorsService', () => ({ loadPatientNames: mocks.loadPatientNames }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { name: string; practices: { name: string } } }) => unknown) =>
    selector({ user: { name: 'Front Desk', practices: { name: 'Test Practice' } } })
}));
vi.mock('../../finance/receipts/ReceivePaymentDialog', () => ({
  ReceivePaymentDialog: (props: Record<string, unknown> & { onClose: () => void }) => {
    mocks.dialogProps.push(props);
    return <button type="button" onClick={props.onClose}>Receive payment (stub)</button>;
  }
}));

import { InvoiceAndPayButton, VisitTakePayment } from '../VisitTakePayment';

const lastDialogProps = () => mocks.dialogProps[mocks.dialogProps.length - 1];

beforeEach(() => {
  mocks.loadPatientNames.mockReset();
  mocks.dialogProps.length = 0;
});

describe('Invoice and take payment', () => {
  it('opens Receive payment for the new invoice, prefilled, over the visit, and closes the visit only when it is done', async () => {
    mocks.loadPatientNames.mockResolvedValue({ pt1: 'Test Patient' });
    const onDone = vi.fn();
    render(<VisitTakePayment practiceId="practice-1" patientId="pt1" invoiceId="inv-1" onDone={onDone} />);
    expect(screen.getByText('Opening Receive payment')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Receive payment (stub)' }));
    expect(lastDialogProps()).toMatchObject({
      practiceId: 'practice-1',
      practiceName: 'Test Practice',
      initialPayer: 'patient',
      initialPatient: { id: 'pt1', name: 'Test Patient' },
      focusInvoiceId: 'inv-1',
      prefillPatientShare: true,
      overFullScreen: true
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('still opens the payment when the name cannot be read, rather than leaving the desk stuck', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.loadPatientNames.mockRejectedValue(new Error('offline'));
    render(<VisitTakePayment practiceId="practice-1" patientId="pt1" invoiceId="inv-1" onDone={vi.fn()} />);
    await screen.findByRole('button', { name: 'Receive payment (stub)' });
    expect(lastDialogProps()).toMatchObject({ initialPatient: { id: 'pt1', name: 'Patient' } });
    warn.mockRestore();
  });

  it('is one clearly named action on the Billing tab, unavailable while the visit is saving', () => {
    const onClick = vi.fn();
    const { rerender } = render(<InvoiceAndPayButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invoice and take payment' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<InvoiceAndPayButton onClick={onClick} disabled />);
    expect(screen.getByRole('button', { name: 'Invoice and take payment' })).toBeDisabled();
  });
});
