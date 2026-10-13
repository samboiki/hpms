/**
 * The fund logo in Finance. Beside the printed fund name it is decorative (a screen reader would otherwise read
 * the fund twice); where only the logo shows (the invoices list), the fund's name is its text and tooltip. A logo
 * that fails to load must not leave a broken-image icon on a money screen.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: (props: { icon: string }) => <svg data-icon={props.icon} /> }));
vi.mock('../../../hooks/useMedicalAidLogo', () => ({
  useMedicalAidLogo: (name: string | null | undefined) => (name === 'NHP' ? '/logos/nhp.png' : null)
}));

import { MedicalAidLogo } from '../MedicalAidLogo';

describe('MedicalAidLogo', () => {
  it('is decorative beside the printed name, and named where it stands alone', () => {
    const { container, rerender } = render(<MedicalAidLogo name="NHP" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/logos/nhp.png');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<MedicalAidLogo name="NHP" labelled />);
    expect(screen.getByRole('img', { name: 'NHP' })).toHaveAttribute('title', 'NHP');
  });

  it('shows a plain shield for a fund without a logo, or when the logo does not load', () => {
    const { container, rerender } = render(<MedicalAidLogo name="Unheard Of Fund" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-icon="solar:shield-plus-bold-duotone"]')).not.toBeNull();
    rerender(<MedicalAidLogo name="NHP" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-icon="solar:shield-plus-bold-duotone"]')).not.toBeNull();
  });

  it('shows nothing when no fund is recorded', () => {
    const { container } = render(<MedicalAidLogo name={null} />);
    expect(container.innerHTML).toBe('');
  });
});
