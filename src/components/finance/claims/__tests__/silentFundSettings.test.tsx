/**
 * "When to warn" about funds that have not answered, beside the alert. Only practice administrators may change it
 * (the practice_settings admin-only policies say the same), everyone sees what it is, and a wait that makes no sense
 * (a day, or a decade) is never saved. Invented values only.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));

import { SilentFundSettings } from '../SilentFundSettings';
import { SILENT_FUND_DEFAULTS } from '../batchFollowUp';
import type { FundProvider } from '../types';

const fund = (id: string, name: string, reference: string): FundProvider => ({
  id, name, short_name: null, email: null, medical_aid_reference: reference, logo_url: null, theme_color: null
});
const funds = [fund('f1', 'PSEMAS', 'MAG1'), fund('f2', 'Namibia Health Plan', 'NHPM')];

describe('SilentFundSettings', () => {
  it('shows everyone the waits in plain words; only an administrator gets "Change"', () => {
    const { rerender } = render(<SilentFundSettings settings={SILENT_FUND_DEFAULTS} funds={funds} canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText('Warn when a fund has not answered after 30 days; PSEMAS after 60 days.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();

    rerender(<SilentFundSettings settings={SILENT_FUND_DEFAULTS} funds={funds} canEdit onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('saves the common wait and each fund that differs, by fund code', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SilentFundSettings settings={SILENT_FUND_DEFAULTS} funds={funds} canEdit onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByLabelText('Days to wait for PSEMAS')).toHaveValue('60');
    fireEvent.change(screen.getByLabelText('Days to wait for PSEMAS'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Days to wait for Namibia Health Plan'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ default: 30, byFund: { MAG1: 45, NHPM: 21 } }));
  });

  it('will not save a wait under a week or over a year', () => {
    const onSave = vi.fn();
    render(<SilentFundSettings settings={SILENT_FUND_DEFAULTS} funds={funds} canEdit onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Days to wait for PSEMAS'), { target: { value: '3' } });

    expect(screen.getByText('Use whole days from 7 to 365.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
