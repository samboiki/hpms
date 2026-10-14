import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import VisitServiceSelector from '../VisitServiceSelector';
import { orderServices } from '../serviceOrder';
import { dentalTariffs, tariff } from '../../quotes/__tests__/quoteTestTariffs';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariffs = dentalTariffs();
const usage = { '8101': 40, '8367': 90, '8346': 200 };

const renderList = (onSelect = vi.fn(), onClose = vi.fn()) =>
  render(<VisitServiceSelector open tariffs={tariffs} usage={usage} onSelect={onSelect} onClose={onClose} />);

const codesIn = (section: HTMLElement) => within(section).getAllByRole('button').map(button => button.textContent?.slice(0, 4));

// Business rule: "Add a service" is the same list in every discipline. Staff find a code fastest when the practice's
// most used codes come first and a search narrows the list as they type; 8346 is never picked by hand (it comes with
// its restoration).
describe('the service list on the visit Billing tab', () => {
  it('puts the most used codes first and never offers 8346', () => {
    renderList();
    const [mostUsed, others] = screen.getAllByRole('heading', { level: 4 }).map(heading => heading.closest('section') as HTMLElement);
    expect(codesIn(mostUsed)).toEqual(['8367', '8101']);
    expect(codesIn(others)).not.toContain('8346');
    expect(codesIn(others)[0]).toBe('8104');
  });

  it('searches from the box on top, and Enter takes the best match', () => {
    const onSelect = vi.fn();
    renderList(onSelect);
    const search = screen.getByRole('searchbox', { name: 'Search by code or description' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'scaling' } });
    expect(screen.getAllByRole('button', { name: /^\d{4}/ }).map(button => button.textContent?.slice(0, 4))).toEqual(['8159']);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: '8159' }));
  });

  it('marks the codes charged per tooth', () => {
    renderList();
    const extraction = screen.getByRole('button', { name: /^8201/ });
    expect(extraction).toHaveTextContent('Per tooth');
    expect(screen.getByRole('button', { name: /^8101/ })).not.toHaveTextContent('Per tooth');
  });

  it('closes on Escape without letting the visit screen close too', () => {
    const onClose = vi.fn();
    const visitScreen = vi.fn();
    document.addEventListener('keydown', visitScreen, true);
    renderList(vi.fn(), onClose);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    document.removeEventListener('keydown', visitScreen, true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(visitScreen).not.toHaveBeenCalled();
  });
});

describe('the order of the codes', () => {
  it('sorts by use, then by code; a search ranks the exact code first', () => {
    const rows = [tariff('8102', '1'), tariff('8101', '1'), tariff('8110', '1')];
    expect(orderServices(rows, { '8110': 3 }, '').map(row => row.code)).toEqual(['8110', '8101', '8102']);
    expect(orderServices(rows, { '8110': 3 }, '8101').map(row => row.code)).toEqual(['8101']);
  });
});

// Business rule (owner, 13 Oct 2026): NAMAF lines without a fixed amount (priced by rule, at cost or by arrangement) stay
// selectable and are billed at the amount staff type, never at N$ 0. A NAMAF list holds up to 7,000 codes (the
// optometry lens catalogue), so the list draws the first ones and a search finds the rest.
describe('NAMAF codes in the service list', () => {
  const atCost = tariff('0201', '0', { description: 'Cost of material used in treatment', no_fixed_amount: true });
  const consult = tariff('0190', '521.40', { description: 'Consultation at the rooms', no_fixed_amount: false });

  it('asks for the amount of a code without a fixed amount and adds the service at it', () => {
    const onSelect = vi.fn();
    render(<VisitServiceSelector open tariffs={[consult, atCost]} usage={{}} onSelect={onSelect} onClose={vi.fn()} />);
    const card = screen.getByRole('button', { name: /^0201/ });
    expect(card).toHaveTextContent('Amount when billed');
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
    const form = screen.getByRole('form', { name: 'Amount for 0201' });
    const amount = within(form).getByRole('textbox', { name: 'Amount per unit (N$)' });
    fireEvent.click(within(form).getByRole('button', { name: 'Add the service' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Enter the amount in N$');
    fireEvent.change(amount, { target: { value: 'N$ 1,250.50' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add the service' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: '0201', price: 1250.5 }));
  });

  it('adds a code with a fixed amount at once, as before', () => {
    const onSelect = vi.fn();
    render(<VisitServiceSelector open tariffs={[consult, atCost]} usage={{}} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^0190/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: '0190', price: '521.40' }));
  });

  it('draws the first 120 codes of a long list and finds the others by searching', () => {
    const lenses = Array.from({ length: 300 }, (_, index) => tariff(`L${String(index).padStart(4, '0')}`, '0', { description: `1.50 Lens ${index}`, no_fixed_amount: true }));
    render(<VisitServiceSelector open tariffs={lenses} usage={{}} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^L\d{4}/ })).toHaveLength(120);
    expect(screen.getByText(/Showing 120 of 300 codes/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lens 299' } });
    expect(screen.getAllByRole('button', { name: /^L\d{4}/ }).map(button => button.textContent?.slice(0, 5))).toEqual(['L0299']);
  });
});
