/**
 * Record access (parity Q8): opening a patient's file, signing in and signing out are recorded, but recording must
 * never block or slow a screen or a sign-in, and the same file opened again soon is one entry, not a flood. Invented
 * ids only; nothing reaches Supabase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
    respond: () => Promise.resolve({ data: true, error: null }) as Promise<{ data: unknown; error: { code?: string; message: string } | null }>
  }
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      return state.respond();
    }
  }
}));

import { GIVE_UP_AFTER_MS, REPEAT_WINDOW_MS, isRepeatOpen, logRecordAccess } from '../recordAccessLog';

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  state.calls = [];
  state.respond = () => Promise.resolve({ data: true, error: null });
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

describe('opening a patient file', () => {
  it('records who opened which file from which screen, and nothing the file holds', async () => {
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-1', patientId: 'patient-1', now: 1_000 });
    expect(state.calls).toEqual([{ name: 'log_record_access', args: { p_event: 'patient_opened', p_patient_id: 'patient-1', p_screen: 'patient_file' } }]);
  });

  it('sends the same file opened again by the same person within 10 minutes once (tabs and re-renders open it often)', async () => {
    const at = 5_000_000;
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-2', patientId: 'patient-2', now: at });
    await logRecordAccess('patient_opened', { screen: 'visit_screen', userId: 'staff-2', patientId: 'patient-2', now: at + 60_000 });
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-3', patientId: 'patient-2', now: at + 60_000 });
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-2', patientId: 'patient-3', now: at + 60_000 });
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-2', patientId: 'patient-2', now: at + REPEAT_WINDOW_MS });
    expect(state.calls.map(call => `${call.args.p_patient_id}`)).toEqual(['patient-2', 'patient-2', 'patient-3', 'patient-2']);
  });

  it('records nothing without a signed-in staff member or a patient', async () => {
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: null, patientId: 'patient-4' });
    await logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-4', patientId: null });
    expect(state.calls).toEqual([]);
  });

  it('counts only opens inside the window as repeats', () => {
    expect(isRepeatOpen(undefined, 10)).toBe(false);
    expect(isRepeatOpen(0, REPEAT_WINDOW_MS - 1)).toBe(true);
    expect(isRepeatOpen(0, REPEAT_WINDOW_MS)).toBe(false);
  });
});

describe('exporting a patient record', () => {
  it('sends every export, even of the same record a minute later: each copy that leaves OneHealth counts', async () => {
    await logRecordAccess('record_exported', { screen: 'patient_file', userId: 'staff-9', patientId: 'patient-9', now: 1_000 });
    await logRecordAccess('record_exported', { screen: 'patient_file', userId: 'staff-9', patientId: 'patient-9', now: 61_000 });
    expect(state.calls.map(call => call.args)).toEqual([
      { p_event: 'record_exported', p_patient_id: 'patient-9', p_screen: 'patient_file' },
      { p_event: 'record_exported', p_patient_id: 'patient-9', p_screen: 'patient_file' }
    ]);
  });

  it('sends nothing for an export that names no patient', async () => {
    await logRecordAccess('record_exported', { screen: 'patient_file', userId: 'staff-9', patientId: null });
    expect(state.calls).toEqual([]);
  });
});

describe('signing in and out', () => {
  it('records every sign-in and sign-out (the database skips a double click within a minute)', async () => {
    await logRecordAccess('signed_in', { screen: 'sign_in', userId: 'staff-5' });
    await logRecordAccess('signed_out', { screen: 'app', userId: 'staff-5' });
    expect(state.calls.map(call => call.args)).toEqual([
      { p_event: 'signed_in', p_patient_id: null, p_screen: 'sign_in' },
      { p_event: 'signed_out', p_patient_id: null, p_screen: 'app' }
    ]);
  });
});

describe('never in the way', () => {
  it('stays quiet when the log is not set up yet or the file is not this practice\'s, and never throws', async () => {
    state.respond = () => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await expect(logRecordAccess('signed_in', { screen: 'sign_in', userId: 'staff-6' })).resolves.toBeUndefined();
    state.respond = () => Promise.resolve({ data: null, error: { code: '42501', message: 'Only a file of your own practice is recorded.' } });
    await expect(logRecordAccess('patient_opened', { screen: 'patient_file', userId: 'staff-6', patientId: 'patient-6' })).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('says in the console (not on screen) when something unexpected stopped it, and still resolves', async () => {
    state.respond = () => Promise.reject(new Error('Failed to fetch'));
    await expect(logRecordAccess('signed_out', { screen: 'app', userId: 'staff-7' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('gives up on a call that does not answer, so a sign-out waits a few seconds at most', async () => {
    vi.useFakeTimers();
    state.respond = () => new Promise(() => undefined);
    let settled = false;
    void logRecordAccess('signed_out', { screen: 'app', userId: 'staff-8' }).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });
});
