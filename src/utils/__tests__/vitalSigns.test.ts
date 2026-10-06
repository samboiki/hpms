import { describe, it, expect } from 'vitest';
import {
  checkBloodPressure,
  checkOxygenSaturation,
  checkTemperature,
  parseBloodPressure,
} from '../vitalSigns';

describe('checkTemperature', () => {
  it('flags 38.0 °C as fever, so a patient exactly at the fever threshold is not shown as normal', () => {
    expect(checkTemperature(38.0).status).toBe('high');
    expect(checkTemperature('38').status).toBe('high');
    expect(checkTemperature(38.0).message).toContain('Fever');
  });

  it('does not flag a normal temperature, so staff are not trained to ignore the warning', () => {
    expect(checkTemperature(36.8)).toEqual({ status: 'normal', message: null });
    expect(checkTemperature(37.9).status).toBe('normal');
  });

  it('flags temperatures below 35.0 °C as low, so hypothermia is visible', () => {
    expect(checkTemperature(34.6).status).toBe('low');
    expect(checkTemperature(35.0).status).toBe('normal');
  });

  it('treats blank, unreadable and zero values as not recorded, because blank form fields are saved as 0', () => {
    expect(checkTemperature(0).status).toBe('normal');
    expect(checkTemperature(null).status).toBe('normal');
    expect(checkTemperature('').status).toBe('normal');
    expect(checkTemperature('not taken').status).toBe('normal');
  });
});

describe('checkOxygenSaturation', () => {
  it('flags SpO2 below 94%, the level at which a patient may need oxygen', () => {
    expect(checkOxygenSaturation(93).status).toBe('low');
    expect(checkOxygenSaturation('88').message).toContain('Low oxygen');
  });

  it('does not flag 94% or more', () => {
    expect(checkOxygenSaturation(94).status).toBe('normal');
    expect(checkOxygenSaturation(99).status).toBe('normal');
  });

  it('does not flag a missing reading as low oxygen', () => {
    expect(checkOxygenSaturation(0).status).toBe('normal');
    expect(checkOxygenSaturation(undefined).status).toBe('normal');
  });
});

describe('checkBloodPressure', () => {
  it('flags 140/90 as high, so a reading exactly at the hypertension threshold is not shown as normal', () => {
    expect(checkBloodPressure('140/90').status).toBe('high');
  });

  it('flags a high systolic alone (150/80) and a high diastolic alone (130/95)', () => {
    // Before, only systolic above 140 was checked, so 140/85 and 130/95 showed as normal
    expect(checkBloodPressure('150/80').status).toBe('high');
    expect(checkBloodPressure('140/85').status).toBe('high');
    expect(checkBloodPressure('130/95').status).toBe('high');
  });

  it('does not flag a normal reading', () => {
    expect(checkBloodPressure('120/80')).toEqual({ status: 'normal', message: null });
    expect(checkBloodPressure('139/89').status).toBe('normal');
  });

  it('reads the formats staff type, with spaces or units', () => {
    expect(checkBloodPressure('160 / 100 mmHg').status).toBe('high');
    expect(parseBloodPressure('118/76 mmHg')).toEqual({ systolic: 118, diastolic: 76 });
  });

  it('does not flag readings it cannot read', () => {
    expect(checkBloodPressure('').status).toBe('normal');
    expect(checkBloodPressure(null).status).toBe('normal');
    expect(checkBloodPressure('--/--').status).toBe('normal');
    expect(parseBloodPressure('high')).toBeNull();
  });
});
