import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const service = vi.hoisted(() => ({ setPracticeFeature: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'user-1', role: 'admin', practice_id: null as string | null, is_super_admin: true } }));

vi.mock('../../../services/practiceFeatureService', () => service);
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));

import { SmsRepliesSwitch, describeSwitchState } from '../SmsRepliesSwitch';
import type { PracticeFeatureState } from '../../../services/practiceFeatureService';

const SWITCH_NAME = "Patients' SMS replies are collected: Kalahari Family Practice";

/** The switch inside a page that keeps the saved state, as Practice Management does */
const Harness: React.FC<{ initial?: PracticeFeatureState; onSaved?: () => void }> = ({ initial, onSaved }) => {
  const [state, setState] = useState<PracticeFeatureState | undefined>(initial);
  return (
    <SmsRepliesSwitch
      practiceId="practice-1"
      practiceName="Kalahari Family Practice"
      state={state}
      onSaved={(_id, next) => {
        setState(next);
        onSaved?.();
      }}
    />
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'user-1', role: 'admin', practice_id: null, is_super_admin: true };
});

describe('only OneHealth support sees the switch', () => {
  // /admin/practices lets practice administrators in: switching replies on before their SMS number can receive
  // replies would make patients' "Reply 2 to cancel" answers disappear, so they never get the control
  it('is not shown to a practice administrator', () => {
    auth.user = { id: 'user-2', role: 'admin', practice_id: 'practice-1', is_super_admin: false };
    render(<Harness />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('tells support when it is safe to switch on', () => {
    render(<Harness />);
    const control = screen.getByRole('switch', { name: SWITCH_NAME });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription(/only after the reply webhook is deployed and this practice's SMS sender can receive replies/);
    expect(screen.getByText('Off')).toBeInTheDocument();
  });
});

describe('the switch shows what the database saved', () => {
  it('switching on saves through the database and then reads "On since" the day', async () => {
    service.setPracticeFeature.mockResolvedValue({ ok: true, state: { enabled: true, updatedAt: '2026-10-08T10:15:00Z' } });
    const onSaved = vi.fn();
    render(<Harness onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('switch', { name: SWITCH_NAME }));
    expect(service.setPracticeFeature).toHaveBeenCalledWith('practice-1', 'sms_replies', true);
    expect(await screen.findByText('On since 8 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: SWITCH_NAME })).toBeChecked();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  // A refused or failed save must not look switched: the senders would still not invite replies
  it('a refused save says why and leaves the switch as it was', async () => {
    service.setPracticeFeature.mockResolvedValue({ ok: false, message: 'Not saved: only OneHealth support can change this.' });
    const onSaved = vi.fn();
    render(<Harness onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('switch', { name: SWITCH_NAME }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved: only OneHealth support can change this.');
    expect(screen.getByRole('switch', { name: SWITCH_NAME })).not.toBeChecked();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // Two quick taps would send on and off in a race; the second waits until the first is saved
  it('cannot be pressed again while a change is being saved', async () => {
    let finish: (value: unknown) => void = () => undefined;
    service.setPracticeFeature.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<Harness />);
    const control = screen.getByRole('switch', { name: SWITCH_NAME });
    fireEvent.click(control);
    expect(control).toBeDisabled();
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    finish({ ok: true, state: { enabled: true, updatedAt: null } });
    await waitFor(() => expect(control).not.toBeDisabled());
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('switching off sends off', async () => {
    service.setPracticeFeature.mockResolvedValue({ ok: true, state: { enabled: false, updatedAt: '2026-10-08T11:00:00Z' } });
    render(<Harness initial={{ enabled: true, updatedAt: '2026-10-07T09:00:00Z' }} />);
    expect(screen.getByText('On since 7 Oct 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: SWITCH_NAME }));
    expect(service.setPracticeFeature).toHaveBeenCalledWith('practice-1', 'sms_replies', false);
    expect(await screen.findByText('Off')).toBeInTheDocument();
  });
});

describe('the state in words', () => {
  // Dates are day-first for Namibian readers; an unknown date still says "On"
  it('reads day-first, and never says "On" for anything but on', () => {
    expect(describeSwitchState({ enabled: true, updatedAt: '2026-10-08T22:30:00Z' })).toMatch(/^On since (8|9) Oct 2026$/);
    expect(describeSwitchState({ enabled: true, updatedAt: null })).toBe('On');
    expect(describeSwitchState({ enabled: false, updatedAt: '2026-10-08T10:00:00Z' })).toBe('Off');
    expect(describeSwitchState(undefined)).toBe('Off');
  });
});
