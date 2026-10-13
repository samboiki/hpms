import React, { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import { cleanCode, verifySignInCode } from '../../services/mfaService';

interface TotpSignInStepProps {
  /** The code was accepted: finish signing in */
  onVerified: () => Promise<void>;
  /** Back to email and password (signs the half-finished sign-in out) */
  onCancel: () => Promise<void>;
}

/**
 * The second step of a staff sign-in when two-step sign-in is turned on (Settings > Account > Security): the
 * 6-digit code from the person's authenticator app. Looks like the email and password form it replaces.
 */
export const TotpSignInStep: React.FC<TotpSignInStepProps> = ({ onVerified, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setChecking(true);
    const result = await verifySignInCode(code);
    if (!result.ok) {
      setError(result.message);
      setChecking(false);
      return;
    }
    await onVerified();
    setChecking(false);
  };

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-center" role="alert">
          <AlertCircle size={20} className="mr-2 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700">
            Code from your authenticator app
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ShieldCheck size={20} className="text-gray-400" />
            </div>
            <input
              id="totp-code"
              name="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              className="pl-10 appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 tracking-widest focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              placeholder="6-digit code"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">Your account uses two-step sign-in. Open your authenticator app and type the code it shows for OneHealth.</p>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4] transition-all duration-300"
          isLoading={checking}
          disabled={code.length !== 6}
        >
          Continue
        </Button>
        <div className="text-center text-sm">
          <button type="button" onClick={() => { void onCancel(); }} className="font-medium text-brand-primary hover:text-brand-dark">
            Use a different account
          </button>
        </div>
        <p className="text-center text-xs text-gray-500">
          Lost your phone? Ask OneHealth support at support@onehealthsystems.com to turn two-step sign-in off for you.
        </p>
      </form>
    </>
  );
};

export default TotpSignInStep;
