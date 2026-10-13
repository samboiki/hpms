import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import {
  cleanCode,
  listTotpFactors,
  removeTotp,
  signOutOtherDevices,
  startTotpEnrolment,
  verifyCode,
  type TotpFactor
} from '../../services/mfaService';
import { format, parseISO } from 'date-fns';

/** Day-first, as everywhere in OneHealth ("7 Oct 2026") */
const formatDisplayDate = (iso: string): string => {
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return '';
  }
};

/**
 * Settings > Account > Security: two-step sign-in with an authenticator app, and signing out of other devices.
 * Owner decision 13 Oct 2026: show only what is true (the old block showed invented sessions and a 2FA that was
 * "enabled" for everyone). Both use Supabase Auth's own features; the cards copy the Change Password card's look.
 */

type Enrolment = { factorId: string; qrCode: string; secret: string };

export const TwoStepSignInCard: React.FC = () => {
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = async () => {
    const result = await listTotpFactors();
    if (result.ok) {
      setFactors(result.value);
      setLoadError(null);
    } else {
      setFactors(null);
      setLoadError(result.message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const start = async () => {
    setBusy(true);
    setProblem(null);
    const result = await startTotpEnrolment();
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setCode('');
    setEnrolment(result.value);
  };

  const confirm = async () => {
    if (!enrolment) return;
    setBusy(true);
    setProblem(null);
    const result = await verifyCode(enrolment.factorId, code);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setEnrolment(null);
    setCode('');
    toast.success('Two-step sign-in is on. You will be asked for a code each time you sign in.');
    await refresh();
  };

  const remove = async (factor: TotpFactor) => {
    if (!window.confirm('Turn off two-step sign-in? Signing in will only need your password again.')) return;
    setBusy(true);
    setProblem(null);
    const result = await removeTotp(factor.id);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    toast.success('Two-step sign-in is off');
    await refresh();
  };

  const isOn = !!factors && factors.length > 0;

  return (
    <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3 -ml-2">
          <div className="p-2 bg-green-100 rounded-lg">
            <Icon icon={SolarIcons.shield} className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Two-Step Sign-In</CardTitle>
            <p className="text-sm text-gray-500">A code from an app on your phone as well as your password</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <p className="text-sm text-red-600" role="alert">{loadError}</p>
        ) : factors === null ? (
          <p className="text-sm text-gray-500">Checking...</p>
        ) : isOn ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 flex-shrink-0 text-green-500" />
              <p className="text-sm text-gray-700">
                Two-step sign-in is on. Each time you sign in, OneHealth asks for the 6-digit code from your authenticator app.
              </p>
            </div>
            {factors.map(factor => (
              <div key={factor.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-700">Authenticator app, added {formatDisplayDate(factor.createdAt)}</p>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { void remove(factor); }}
                  className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50">
                  Turn off
                </Button>
              </div>
            ))}
          </div>
        ) : enrolment ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
              <li>Open an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator).</li>
              <li>Scan this code with it, or type the key below into the app.</li>
              <li>Type the 6-digit code the app shows, then Turn on.</li>
            </ol>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <img src={enrolment.qrCode} alt="QR code to scan with your authenticator app" className="h-44 w-44 rounded-lg border border-gray-200 bg-white p-2" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Key (if you cannot scan)</p>
                <p className="break-all font-mono text-sm text-gray-900">{enrolment.secret}</p>
              </div>
            </div>
            <div>
              <label htmlFor="totp-enrol-code" className="block text-sm font-medium text-gray-700 mb-2">Code from the app</label>
              <input
                id="totp-enrol-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))}
                placeholder="6-digit code"
                className="w-full max-w-xs pl-4 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200 tracking-widest"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { void confirm(); }} isLoading={busy} disabled={code.length !== 6}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                Turn on
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => { setEnrolment(null); setProblem(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Two-step sign-in is off. Turn it on so that someone who learns your password still cannot sign in without your phone.
            </p>
            <Button onClick={() => { void start(); }} isLoading={busy} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
              {!busy && <Icon icon={SolarIcons.shield} className="w-5 h-5 mr-2" />}
              Set up two-step sign-in
            </Button>
          </div>
        )}
        {problem && <p className="mt-4 text-sm text-red-600" role="alert">{problem}</p>}
      </CardContent>
    </Card>
  );
};

/** Ends this person's sessions on other computers and phones; this one stays signed in */
export const OtherDevicesCard: React.FC = () => {
  const [busy, setBusy] = useState(false);

  const signOutOthers = async () => {
    if (!window.confirm('Sign out of OneHealth on all your other devices? You stay signed in here.')) return;
    setBusy(true);
    const result = await signOutOtherDevices();
    setBusy(false);
    if (result.ok) toast.success('You are signed out on your other devices');
    else toast.error(result.message);
  };

  return (
    <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3 -ml-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon icon={SolarIcons.hardDrive} className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Other Devices</CardTitle>
            <p className="text-sm text-gray-500">Sign out everywhere else you use OneHealth</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          If you signed in on a shared or lost computer or phone, sign out there from here. You stay signed in on this device.
        </p>
        <div className="mt-6">
          <Button
            variant="outline"
            isLoading={busy}
            onClick={() => { void signOutOthers(); }}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50"
          >
            Sign out of all other devices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
