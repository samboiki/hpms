/**
 * Setting up a code bundle that holds a NAMAF code with no fixed amount (most of the optometry lens catalogue). Why: the editor
 * used to show such a code as "N$ 0.00 today", which reads as "this is free". It must say the amount is asked for when the
 * bundle is used, so the person setting up the bundle knows what staff will be asked. Invented codes and amounts.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BundleManager from '../BundleManager';
import { tariff } from './quoteTestTariffs';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../quoteService', () => ({
  loadBundleExtrasEnabled: () => Promise.resolve(false),
  saveBundle: vi.fn(),
  deleteBundle: vi.fn()
}));

const tariffs = [
  tariff('0190', '520.00', { description: 'Consultation at the rooms' }),
  tariff('NP85CZ03D', '0', { description: 'ZEISS officelens Individual 1.5 BlueGuard', no_fixed_amount: true })
];

const typeCode = (code: string) => {
  render(<BundleManager practiceId="practice-1" practiceType="optometry" tariffs={tariffs} bundles={[]} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /new bundle/i }));
  fireEvent.change(screen.getByPlaceholderText('0190'), { target: { value: code } });
};

describe('the bundle editor and a code with no fixed amount', () => {
  it('says the amount is asked for when the bundle is used, not "N$ 0.00 today", and that the price leaves it out', () => {
    typeCode('NP85CZ03D');
    expect(screen.getByText(/ZEISS officelens.*amount when the bundle is used/)).toBeInTheDocument();
    expect(screen.queryByText(/N\$ 0\.00 today/)).not.toBeInTheDocument();
    expect(screen.getByText(/leaves out the codes whose amount is typed when the bundle is used/)).toBeInTheDocument();
  });

  it('still shows the price of an ordinary code, with no note about amounts', () => {
    typeCode('0190');
    expect(screen.getByText(/Consultation at the rooms · N\$ 520\.00 today/)).toBeInTheDocument();
    expect(screen.queryByText(/leaves out the codes/)).not.toBeInTheDocument();
  });
});
