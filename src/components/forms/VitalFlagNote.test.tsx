import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBloodPressure, checkTemperature } from '../../utils/vitalSigns';
import VitalFlagNote from './VitalFlagNote';

describe('VitalFlagNote', () => {
  afterEach(cleanup);

  it('warns in words, not colour alone, when a reading is outside the safe range', () => {
    render(<VitalFlagNote check={checkTemperature(38.6)} />);
    expect(screen.getByRole('status').textContent).toContain('Fever');
  });

  it('names high blood pressure so the nurse knows which reading triggered the warning', () => {
    render(<VitalFlagNote check={checkBloodPressure('150/95')} />);
    expect(screen.getByRole('status').textContent).toContain('High blood pressure');
  });

  it('shows nothing for normal or blank readings, so staff do not learn to ignore the warning', () => {
    const { container } = render(<VitalFlagNote check={checkTemperature(36.8)} />);
    expect(container.textContent).toBe('');
    const blank = render(<VitalFlagNote check={checkBloodPressure('')} />);
    expect(blank.container.textContent).toBe('');
  });
});
