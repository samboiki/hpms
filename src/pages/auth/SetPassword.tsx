import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../../utils/auth/passwordRules';

/**
 * Where a staff invitation (or a "new link" email) lands: the link has signed the person in, and here they choose
 * their own password, so nobody else ever knows it. Without a valid link the app shows the sign-in page instead.
 */
const SetPassword: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    setError(problem);
    if (problem) return;
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(`The password was not saved: ${updateError.message}`);
      return;
    }
    toast.success('Password saved. Welcome to OneHealth.');
    navigate('/', { replace: true });
  };

  const field = 'w-full rounded-lg bg-gray-100 px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#01b9d4]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] rounded-2xl flex items-center justify-center shadow-lg">
              <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-[28px] font-bold font-heading text-[#494c61]">Choose your password</h1>
          <p className="mt-2 text-gray-600">
            {user?.name ? `Welcome, ${user.name}. ` : ''}You will use it with {user?.email ?? 'your email address'} to sign in.
          </p>
        </div>

        <form onSubmit={save} noValidate className="space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={field}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="mt-1 text-xs text-gray-500">
              At least {MIN_PASSWORD_LENGTH} characters, with a letter and a number.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
              Type it again
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={field}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <Icon icon="solar:shield-warning-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4] transition-all duration-300"
            isLoading={saving}
          >
            Save password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SetPassword;
