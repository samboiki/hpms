/**
 * Giving a discount on an invoice (parity D19): reception is told to ask a practitioner, a practitioner's 10% becomes
 * the amount to the cent before anything is saved, and an invoice the medical aid pays all of is explained instead of
 * discounted. Nothing reaches the database here (postAdjustment is a stand-in). Invented figures.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const { postAdjustment } = vi.hoisted(() => ({ postAdjustment: vi.fn() }));
vi.mock('../arService', () => ({ postAdjustment }));

import { DiscountDialog } from '../DiscountDialog';

const invoice = { id: 'inv-1', invoiceNumber: 'INV-0001', patientName: 'Pat Testing' };

beforeEach(() => {
  postAdjustment.mockReset();
  postAdjustment.mockResolvedValue({ id: 'd1', number: 'DS-000001', kind: 'discount' });
});

describe('the discount dialog', () => {
  it('tells reception to ask an administrator or practitioner, and does not let them continue', () => {
    render(<DiscountDialog practiceId="pr" invoice={invoice} outstanding={{ medical_aid: 70000, patient: 30000 }} baseCents={30000} role="receptionist" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only a practice administrator or practitioner can give a discount');
    expect(screen.getByRole('button', { name: /Review/ })).toBeDisabled();
  });

  it("turns a practitioner's 10% into N$ 30.00 of what the patient was charged and saves it with its reason and percentage", async () => {
    const onSaved = vi.fn();
    render(<DiscountDialog practiceId="pr" invoice={invoice} outstanding={{ medical_aid: 70000, patient: 30000 }} baseCents={30000} role="doctor" staffName="Dr Testing" onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Percentage' }));
    fireEvent.change(screen.getByLabelText('Percentage'), { target: { value: '10' } });
    expect(screen.getByText('10% of N$ 300.00 is N$ 30.00')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Why the discount is given'), { target: { value: 'pensioner' } });
    fireEvent.click(screen.getByRole('button', { name: /Review/ }));
    expect(screen.getByText('Take N$ 30.00 (10% of N$ 300.00) off what the patient pays on invoice INV-0001.')).toBeInTheDocument();
    // The medical aid's portion is shown as unchanged before anything is saved
    expect(screen.getByText('Medical aid will owe (not changed)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Give discount/ }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('DS-000001'));
    expect(postAdjustment).toHaveBeenCalledWith({
      practiceId: 'pr', kind: 'discount', invoiceId: 'inv-1', portion: 'patient', amountCents: 3000, reason: 'Pensioner', reasonCode: 'pensioner', percent: 10
    });
  });

  it('explains an invoice the medical aid pays all of instead of discounting the claim', () => {
    render(<DiscountDialog practiceId="pr" invoice={invoice} outstanding={{ medical_aid: 100000, patient: 0 }} baseCents={0} role="admin" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('never lowers what the medical aid is claimed');
    expect(screen.getByRole('button', { name: /Review/ })).toBeDisabled();
  });
});
