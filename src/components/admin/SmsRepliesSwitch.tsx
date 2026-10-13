/**
 * "Patients' SMS replies are collected" for one practice, in Practice Management. OneHealth support only: the
 * database refuses everyone else (set_practice_feature), and the control is not shown to them either, because
 * /admin/practices also lets practice administrators in.
 */
import React, { useId, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
// Shared with the edge functions (pure TypeScript): the one home of the SMS replies feature key
import { SMS_REPLIES_FEATURE_KEY } from '../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { setPracticeFeature, type PracticeFeatureState } from '../../services/practiceFeatureService';

export const SMS_REPLIES_SWITCH_LABEL = "Patients' SMS replies are collected";

interface SmsRepliesSwitchProps {
  practiceId: string;
  practiceName: string;
  /** The practice's current state; undefined when it has no row (off) */
  state: PracticeFeatureState | undefined;
  onSaved: (practiceId: string, state: PracticeFeatureState) => void;
}

/** "On since 8 Oct 2026", "On", "Off" */
export function describeSwitchState(state: PracticeFeatureState | undefined): string {
  if (state?.enabled !== true) return 'Off';
  const since = state.updatedAt ? parseISO(state.updatedAt) : null;
  return since && !Number.isNaN(since.getTime()) ? `On since ${format(since, 'd MMM yyyy')}` : 'On';
}

export const SmsRepliesSwitch: React.FC<SmsRepliesSwitchProps> = ({ practiceId, practiceName, state, onSaved }) => {
  const { user } = useAuthStore();
  const helpId = useId();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (user?.is_super_admin !== true) return null;

  const on = state?.enabled === true;

  const change = async (next: boolean) => {
    setSaving(true);
    setMessage(null);
    const result = await setPracticeFeature(practiceId, SMS_REPLIES_FEATURE_KEY, next);
    setSaving(false);
    if (result.ok) onSaved(practiceId, result.state);
    else setMessage(result.message);
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={saving}
          onChange={(event) => void change(event.target.checked)}
          aria-label={`${SMS_REPLIES_SWITCH_LABEL}: ${practiceName}`}
          aria-describedby={helpId}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900">{SMS_REPLIES_SWITCH_LABEL}</span>
          <span id={helpId} className="block text-xs text-gray-600">
            Switch on only after the reply webhook is deployed and this practice&apos;s SMS sender can receive replies. While
            on, reminders and booking messages ask patients to reply (for example &quot;Reply 2 to cancel&quot;).
          </span>
          <span className="mt-1 block text-xs font-medium text-gray-700" aria-live="polite">
            {saving ? 'Saving...' : describeSwitchState(state)}
          </span>
        </span>
      </label>
      {message && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  );
};

export default SmsRepliesSwitch;
