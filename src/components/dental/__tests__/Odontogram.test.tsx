import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildChart, type BilledLine } from '../../../utils/dental/chart';
import Odontogram from '../Odontogram';

const extraction: BilledLine = {
  key: 'line-1',
  invoiceId: 'invoice-1',
  invoiceNumber: 'INV2610001',
  visitId: 'visit-1',
  date: '2024-03-03',
  code: '8201',
  description: 'Single tooth extraction',
  teeth: ['46'],
  cancelled: false
};
const model = buildChart({ billed: [extraction], entries: [] });
const teeth = () => screen.getAllByRole('button', { name: /^Tooth \d\d,/ });

// Business rule: one chart serves the Teeth view (a tap opens the tooth) and billing (taps choose teeth). Each tooth
// says in words what is on it, a chosen tooth is announced as pressed, and the chart is one Tab stop.
describe('the tooth chart', () => {
  it('opens a tooth in the Teeth view, saying what is on it', () => {
    const onToothClick = vi.fn();
    render(<Odontogram dentition="adult" model={model} mode="open" selected={new Set()} onToothClick={onToothClick} />);
    const missing = screen.getByRole('button', { name: 'Tooth 46, Lower right first molar: Missing' });
    expect(missing).toHaveAttribute('aria-haspopup', 'dialog');
    expect(missing).not.toHaveAttribute('aria-pressed');
    fireEvent.click(missing);
    expect(onToothClick).toHaveBeenCalledWith('46');
  });

  it('chooses teeth for billing, with the lines already on the visit', () => {
    render(
      <Odontogram dentition="adult" model={model} mode="select" selected={new Set(['36'])} onToothClick={vi.fn()} onVisit={new Map([['36', ['8367']]])} />
    );
    expect(screen.getByRole('button', { name: 'Tooth 36, Lower left first molar: nothing recorded; on this visit: 8367' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Tooth 37,/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('is one Tab stop, and the arrow keys move between teeth', () => {
    render(<Odontogram dentition="adult" model={model} mode="select" selected={new Set()} onToothClick={vi.fn()} />);
    const stops = teeth().filter(button => button.tabIndex === 0);
    expect(stops.map(button => button.getAttribute('aria-label')?.slice(0, 8))).toEqual(['Tooth 18']);
    stops[0].focus();
    fireEvent.keyDown(stops[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Tooth 48,/ }));
    expect(teeth().filter(button => button.tabIndex === 0)).toHaveLength(1);
  });

  it('shows the milk teeth of a child', () => {
    render(<Odontogram dentition="child" model={model} mode="select" selected={new Set()} onToothClick={vi.fn()} />);
    expect(teeth()).toHaveLength(20);
    expect(screen.getByRole('group', { name: 'Tooth chart, child teeth' })).toBeInTheDocument();
  });
});
