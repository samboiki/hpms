import { describe, it, expect } from 'vitest';
import { describeVitalReadings } from '../vitalsSummary';

// The patient Overview's "Latest vitals" is the first thing a doctor reads when opening a file.
// A fever, high blood pressure or low oxygen there must carry a warning in words, not just a number.
describe('describeVitalReadings', () => {
  it('warns about a fever so it is not read as a routine temperature', () => {
    const [temperature] = describeVitalReadings({ temperature: 38.6 });
    expect(temperature.text).toBe('Temp 38.6 °C');
    expect(temperature.warning).toMatch(/fever/i);
  });

  it('warns about high blood pressure, including a high diastolic with a normal systolic', () => {
    expect(describeVitalReadings({ blood_pressure: '150/95' })[0].warning).toMatch(/high blood pressure/i);
    expect(describeVitalReadings({ blood_pressure: '130/92' })[0].warning).toMatch(/high blood pressure/i);
  });

  it('shows and warns about low oxygen, which the summary used to leave out entirely', () => {
    const [oxygen] = describeVitalReadings({ oxygen_saturation: 89 });
    expect(oxygen.text).toBe('SpO2 89%');
    expect(oxygen.warning).toMatch(/low oxygen/i);
  });

  it('leaves normal readings unflagged so warnings keep their meaning', () => {
    const readings = describeVitalReadings({ blood_pressure: '118/76', temperature: '36.8', oxygen_saturation: 98, pulse_rate: 72 });
    expect(readings.map(reading => reading.warning)).toEqual([null, null, null, null]);
  });

  it('does not flag pulse or breathing rate, whose safe range depends on age', () => {
    const readings = describeVitalReadings({ pulse_rate: 130, respiratory_rate: 32 });
    expect(readings).toEqual([
      { text: 'Pulse 130 bpm', warning: null },
      { text: 'Resp 32 /min', warning: null }
    ]);
  });

  it('skips values that were not recorded', () => {
    expect(describeVitalReadings({ blood_pressure: null, temperature: undefined, weight: '' })).toEqual([]);
  });
});
