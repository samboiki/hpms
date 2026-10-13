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
