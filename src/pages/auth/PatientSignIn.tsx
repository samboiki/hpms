import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../../components/patients/patientContact';

/** Seconds before another code can be asked for (Supabase Auth allows one a minute per number). */
const RESEND_AFTER_SECONDS = 60;
const CODE_LENGTH = 6;

// Android Chrome can read the code from the SMS (WebOTP); the SMS ends with "@<site> #<code>" for it.
interface OtpCredentialsContainer {
  get(options: { otp: { transport: string[] }; signal: AbortSignal }): Promise<{ code?: string } | null>;
}

/** Supabase Auth's message when it has one the person can act on, otherwise a plain one. */
const sendErrorMessage = (error: { message?: string; status?: number }): string => {
  const message = error.message?.trim() ?? '';
  if (error.status === 429 || /seconds|too many|paused/i.test(message)) return message || 'Please wait a minute, then ask for a new code.';
  if (/signups? not allowed|disabled/i.test(message)) return 'Patient sign-in is not switched on yet. Please ask your practice.';
  return 'We could not send a code just now. Check your connection and try again.';
};

/**
 * Patient sign-in: cell number, then the 6-digit code from the SMS. No password and no email needed.
 * After the code is accepted, App.tsx sees the new session and opens the patient app (/me).
 * Codes only go to numbers that are on a patient file; the screen says the same either way, so it
 * cannot be used to find out who is a patient.
 */
const PatientSignIn: React.FC = () => {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  // Fill the code from the SMS where the phone supports it (Android Chrome)
  useEffect(() => {
    if (step !== 'code' || !('OTPCredential' in window)) return;
    const controller = new AbortController();
    const credentials = navigator.credentials as unknown as OtpCredentialsContainer;
    credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        if (credential?.code) setCode(credential.code.replace(/\D/g, '').slice(0, CODE_LENGTH));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [step]);

  const sendCode = async (number: string) => {
    setBusy(true);
    setError('');
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: number });
    setBusy(false);
    if (sendError) {
      setError(sendErrorMessage(sendError));
      return;
    }
    setPhone(number);
    setCode('');
    setStep('code');
    setSecondsLeft(RESEND_AFTER_SECONDS);
  };

  const handlePhoneSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const number = normalizePhoneNumber(phoneInput);
    if (!number) {
      setError('Enter your cell number as your practice has it, for example 081 234 5678.');
      return;
    }
    void sendCode(number);
  };

  const handleCodeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone) return;
    const token = code.replace(/\D/g, '');
    if (token.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from the SMS.`);
      return;
    }
    setBusy(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    setBusy(false);
    if (verifyError) {
      setError('That code is not right or has expired. Check the SMS, or ask for a new code.');
      return;
    }
    // App.tsx now restores the session and shows the patient app
    setSigningIn(true);
  };

  const inputClass =
    'block w-full px-4 py-3 border border-gray-300 rounded-xl text-lg tracking-wide shadow-sm placeholder-gray-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500';

  if (signingIn) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-gray-600" role="status">
        <Icon icon="solar:shield-check-bold-duotone" className="w-10 h-10 text-cyan-600" aria-hidden="true" />
        <p>Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-2" role="alert">
          <Icon icon="solar:danger-circle-bold-duotone" className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="patient-phone" className="block text-sm font-medium text-gray-700">
              Your cell number
            </label>
            <input
              id="patient-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              className={`mt-1 ${inputClass}`}
              placeholder="081 234 5678"
            />
            <p className="mt-2 text-sm text-gray-500">
              Use the number your practice has on your file. We send you a {CODE_LENGTH}-digit code by SMS. No password needed.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-[#01b9d4] to-[#0197d4] disabled:opacity-60"
          >
            <Icon icon={busy ? 'solar:refresh-circle-bold-duotone' : 'solar:letter-bold-duotone'} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {busy ? 'Sending...' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="space-y-5" noValidate>
          <div className="bg-cyan-50 text-cyan-900 p-4 rounded-xl text-sm" aria-live="polite">
            If {phone ? formatPhoneForDisplay(phone) : 'this number'} is on a patient file, an SMS with your code is on its way.
          </div>
          <div>
            <label htmlFor="patient-code" className="block text-sm font-medium text-gray-700">
              {CODE_LENGTH}-digit code
            </label>
            <input
              id="patient-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              className={`mt-1 text-center text-2xl tracking-[0.5em] ${inputClass}`}
              placeholder="000000"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-[#01b9d4] to-[#0197d4] disabled:opacity-60"
          >
            <Icon icon={busy ? 'solar:refresh-circle-bold-duotone' : 'solar:login-3-bold-duotone'} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {busy ? 'Checking...' : 'Sign in'}
          </button>

          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 space-y-3">
            <p className="font-medium text-gray-800">No SMS?</p>
            <p>
              Codes only go to cell numbers that are on a patient file. Wait a minute and ask for a new code. Still nothing?
              Ask reception to add this cell number to your file.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <button
                type="button"
                disabled={busy || secondsLeft > 0 || !phone}
                onClick={() => phone && void sendCode(phone)}
                className="font-medium text-cyan-700 disabled:text-gray-400"
              >
                {secondsLeft > 0 ? `Send a new code in ${secondsLeft}s` : 'Send a new code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError('');
                  setCode('');
                }}
                className="font-medium text-cyan-700"
              >
                Use another number
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientSignIn;
