import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import ModernPatientRegistrationForm from './ModernPatientRegistrationForm';

const form = vi.hoisted(() => ({
  data: { firstName: 'Test', lastName: 'Patient', idNumber: 'test-id', dateOfBirth: '1990-01-01', gender: 'female', homeLanguage: 'English', medicalAid: {}, nextOfKin: {} },
  trigger: vi.fn().mockResolvedValue(true),
  watch: vi.fn(),
  setValue: vi.fn(),
}));
vi.mock('react-hook-form', () => ({ useForm: () => ({
  register: () => ({}), watch: form.watch, setValue: form.setValue, trigger: form.trigger, formState: { errors: {} },
  handleSubmit: (callback: (data: unknown) => unknown) => async (event: React.FormEvent) => { event.preventDefault(); await Promise.resolve(); return callback(form.data); },
}) }));
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: { div: ({ children }: React.PropsWithChildren) => <div>{children}</div> },
}));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));
// The form reports a blocked registration with toast.error, so that is what marks a submit as finished
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: toastMock, default: toastMock }));

describe('registration practice ownership', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.auth.getUser).mockReset();
    toastMock.error.mockClear();
    // restoreAllMocks in afterEach also strips vi.fn() implementations, so without this every test after
    // the first stays on step 1 (trigger resolves undefined) and never reaches "Complete Registration"
    form.trigger.mockResolvedValue(true);
  });

  async function submit(practiceId: string | null, signedIn = true) {
    const inserted = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'patient-1' }, error: null }) }) });
    const duplicateQuery = { eq: vi.fn().mockReturnThis(), maybeSingle: async () => ({ data: null, error: null }) };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: signedIn ? { id: 'user-1' } : null }, error: null } as never);
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'medical_aid_providers') return { select: () => ({ order: async () => ({ data: [], error: null }) }) } as never;
      if (table === 'users') return { select: () => ({ eq: () => ({ single: async () => ({ data: { practice_id: practiceId }, error: null }) }) }) } as never;
      if (table === 'patients') return { select: () => duplicateQuery, insert: inserted } as never;
      throw new Error(`Unexpected table ${table}`);
    });
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    for (let step = 0; step < 3; step++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(form.trigger).toHaveBeenCalledTimes(step + 1));
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Complete Registration' }));
    await waitFor(() => expect(onSuccess.mock.calls.length + toastMock.error.mock.calls.length).toBe(1));
    form.trigger.mockClear();
    return { inserted, onSuccess, duplicateQuery };
  }

  it('blocks registration if the account has no practice', async () => {
    const { inserted, onSuccess } = await submit(null);
    expect(inserted).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('blocks unauthenticated registration', async () => {
    const { inserted, onSuccess } = await submit(null, false);
    expect(inserted).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses the account practice for both duplicate checks and patient creation', async () => {
    const { inserted, onSuccess, duplicateQuery } = await submit('practice-1');
    expect(duplicateQuery.eq).toHaveBeenCalledWith('practice_id', 'practice-1');
    expect(inserted).toHaveBeenCalledWith([expect.objectContaining({ practice_id: 'practice-1' })]);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
