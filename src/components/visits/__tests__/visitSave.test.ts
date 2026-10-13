import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { medicationIssues, useOneSaveAtATime } from '../visitSave';

// Business rule: the prescription and the patient's medicine list are made from these rows, so a medicine without a
// real name, its dose or how often it is taken is refused, by name, before anything about the visit is written
describe('medicines that cannot be saved', () => {
  it('names each problem, one per medicine', () => {
    expect(
      medicationIssues([
        { medication_name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily' },
        { medication_name: 'Am', dosage: '1', frequency: 'daily' },
        { medication_name: 'Ibuprofen', dosage: ' ', frequency: 'daily' },
        { medication_name: 'Paracetamol', dosage: '1g', frequency: null }
      ])
    ).toEqual([
      'Medication name "Am" must be at least 3 characters',
      'Dosage is required for Ibuprofen',
      'Frequency is required for Paracetamol'
    ]);
    expect(medicationIssues([{ medication_name: null }])).toEqual(['Medication name "(empty)" must be at least 3 characters']);
    expect(medicationIssues([])).toEqual([]);
  });
});

// Business rule: a double click on Create Visit or Update Visit must never run two saves at once (two visits, or the
// patient billed twice); once the first save is done, the next press saves again
describe('one save at a time', () => {
  it('ignores a second save while the first runs, and takes the next one after it', async () => {
    const { result } = renderHook(() => useOneSaveAtATime());
    let finish: (value: string) => void = () => undefined;
    let runs = 0;
    const slowSave = () => {
      runs += 1;
      return new Promise<string>(resolve => {
        finish = resolve;
      });
    };
    let first: Promise<string | undefined> = Promise.resolve(undefined);
    let second: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      first = result.current(slowSave);
      second = result.current(slowSave);
    });
    expect(await second).toBeUndefined();
    finish('saved');
    expect(await first).toBe('saved');
    expect(runs).toBe(1);
    await expect(result.current(() => Promise.resolve('again'))).resolves.toBe('again');
  });

  it('lets the next save run after one that failed', async () => {
    const { result } = renderHook(() => useOneSaveAtATime());
    await expect(result.current(() => Promise.reject(new Error('lost')))).rejects.toThrow('lost');
    await expect(result.current(() => Promise.resolve('saved'))).resolves.toBe('saved');
  });
});
