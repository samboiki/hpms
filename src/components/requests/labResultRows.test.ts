import { describe, it, expect } from 'vitest';
import { findIncompleteResultRow } from './labResultRows';

describe('findIncompleteResultRow', () => {
  it('stops the save when a test has a value but no name, so a typed result is not silently dropped', () => {
    expect(findIncompleteResultRow([
      { name: 'Glucose', value: '5.4' },
      { name: '', value: '48', unit: 'mg/L', range: '<5' },
    ])).toBe(1);
  });

  it('stops the save when a test has a name but no value yet', () => {
    expect(findIncompleteResultRow([{ name: 'HbA1c', value: '' }])).toBe(0);
  });

  it('lets the save go ahead when the extra rows were added but left completely blank', () => {
    expect(findIncompleteResultRow([
      { name: 'Glucose', value: '5.4', unit: 'mmol/L', range: '3.9-5.6' },
      { name: '', value: '', unit: '', range: '' },
    ])).toBe(-1);
  });

  it('counts a row with only a unit or range typed as started, because the user meant to enter a result', () => {
    expect(findIncompleteResultRow([{ name: '', value: '', unit: 'mmol/L' }])).toBe(0);
    expect(findIncompleteResultRow([{ name: '', value: '', range: '3.9-5.6' }])).toBe(0);
  });

  it('flags a saved result whose fields were all cleared, since skipping it would silently keep the old value', () => {
    expect(findIncompleteResultRow([{ name: '', value: '', saved: true }])).toBe(0);
  });

  it('treats a name or value of only spaces as missing', () => {
    expect(findIncompleteResultRow([{ name: '   ', value: '5.4' }])).toBe(0);
    expect(findIncompleteResultRow([{ name: 'Creatinine', value: '  ' }])).toBe(0);
  });

  it('accepts complete rows, including saved ones with no unit or range', () => {
    expect(findIncompleteResultRow([
      { name: 'CRP', value: '3', unit: null, range: null, saved: true },
      { name: 'eGFR', value: '75', range: '>60' },
    ])).toBe(-1);
  });
});
