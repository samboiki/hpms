import { describe, it, expect } from 'vitest';
import { getResultStatus } from '../labResultStatus';

describe('getResultStatus', () => {
  it('flags a CRP of 48 against 0-5 as high, so an infection marker is not reported as normal', () => {
    expect(getResultStatus('48', '0-5')).toBe('high');
  });

  it('flags a low haemoglobin against 13.0-17.0, so anaemia is visible', () => {
    expect(getResultStatus('9.8', '13.0-17.0')).toBe('low');
  });

  it('reads upper-limit ranges written as "<5", which labs use for CRP and similar markers', () => {
    // Before, "<5" could not be read and every value counted as normal
    expect(getResultStatus('48', '<5')).toBe('high');
    expect(getResultStatus('3', '<5')).toBe('normal');
    expect(getResultStatus('6', '≤5')).toBe('high');
  });

  it('reads lower-limit ranges written as ">60", as used for eGFR', () => {
    expect(getResultStatus('42', '>60')).toBe('low');
    expect(getResultStatus('75', '≥60')).toBe('normal');
  });

  it('treats values on the boundary as normal', () => {
    expect(getResultStatus('11.0', '4.0-11.0')).toBe('normal');
    expect(getResultStatus('4', '4.0-11.0')).toBe('normal');
  });

  it('does not flag results it cannot compare (text results or missing ranges)', () => {
    expect(getResultStatus('Positive', '0-5')).toBe('normal');
    expect(getResultStatus('48', null)).toBe('normal');
    expect(getResultStatus(null, '0-5')).toBe('normal');
  });
});
