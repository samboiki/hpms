/**
 * Money figures outside the Finance screen (Settings > Practice > Overhead) follow Finance's screen access: a role the
 * practice keeps out of Finance sees a calm "Ask your practice administrator" note instead, never the figures. Nothing
 * inside is mounted until the practice's choice is known, so the figures are not even loaded for such a role.
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { useScreenAccess } from '../../hooks/useScreenAccess';
import { screenGate } from '../../utils/auth/screenAccess';
// The app's action colour (cyan) for buttons, shared with the stock and optometry screens
import { PRIMARY } from '../stock/stockUi';

interface FinanceFiguresGateProps {
  /** What the figures are, for the note: "The practice's overheads" */
  what: string;
  children: React.ReactNode;
}

export const FinanceFiguresGate: React.FC<FinanceFiguresGateProps> = ({ what, children }) => {
  const user = useAuthStore((state) => state.user);
  const read = useScreenAccess();
  const gate = screenGate(user, 'finance', read);

  if (gate === 'open') return <>{children}</>;
  if (gate === 'checking') {
    return (
      <div role="status" className="flex justify-center py-12">
        <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600 motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Checking who can see money figures...</span>
      </div>
    );
  }

  const closed = gate === 'closed';
  return (
    <section className="flex justify-center py-6 md:py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
          <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="h-7 w-7 text-gray-500" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          {closed ? 'Ask your practice administrator' : 'Could not check who can see these figures'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {closed
            ? `${what} are money figures, which your practice shows only to roles that open Finance. An administrator can give your role access in Settings > Users > Screen access.`
            : 'Check the connection and try again.'}
        </p>
        {!closed && (
          <button type="button" onClick={read.retry} className={`mt-6 ${PRIMARY}`}>
            Try again
          </button>
        )}
      </div>
    </section>
  );
};
