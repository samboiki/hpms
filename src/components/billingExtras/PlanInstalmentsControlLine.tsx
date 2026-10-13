import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { countDueInstalments, postDueInstalments } from '../../services/billing/billingExtrasService';
import { todayKey } from '../../utils/billing/dates';
import { canRaiseInvoices } from '../../utils/billing/invoiceRights';
import { describePosting } from '../../utils/billing/paymentPlans';

/**
 * A line in Finance > Overview's daily and month-end controls (parity D16): payment plan instalments that are due but
 * not on the patients' accounts yet. There is no scheduler: an instalment posts when its patient's Billing tab is opened,
 * or here for the whole practice. Shown only while some are waiting (and never before the billing extras update).
 * onPosted: the instalments are on the accounts now, so Finance reloads its figures.
 */
export const PlanInstalmentsControlLine: React.FC<{ practiceId: string; onPosted?: () => void }> = ({ practiceId, onPosted }) => {
  const user = useAuthStore(state => state.user);
  const canPost = canRaiseInvoices(user);
  const [due, setDue] = useState(0);
  const [posting, setPosting] = useState(false);

  const count = useCallback(async () => {
    const result = await countDueInstalments(practiceId, todayKey());
    if (result.status === 'ready') setDue(result.data);
    else if (result.status === 'error') console.warn('Finance: payment plan instalments could not be counted', result.message);
  }, [practiceId]);

  useEffect(() => {
    void count();
  }, [count]);

  if (due === 0) return null;

  const post = async () => {
    setPosting(true);
    try {
      const result = await postDueInstalments(practiceId, null);
      toast.success(
        onPosted ? describePosting(result) ?? 'Nothing was due.' : `${describePosting(result) ?? 'Nothing was due.'} Refresh Finance to see them in the figures.`,
        { duration: 8000 }
      );
      await count();
      onPosted?.();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The due instalments could not be posted.');
    } finally {
      setPosting(false);
    }
  };

  // The look of the card's other lines (ControlsOverviewCard)
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <Icon icon="solar:danger-triangle-bold-duotone" className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-gray-800">
        {due === 1 ? '1 payment plan instalment is' : `${due} payment plan instalments are`} due and not on the accounts yet (an instalment posts when
        its patient&apos;s Billing tab is opened; there is no overnight run)
      </span>
      {canPost && (
        <button
          type="button"
          onClick={() => void post()}
          disabled={posting}
          className="rounded-md px-2 py-1 text-sm font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          {posting ? 'Posting...' : 'Post due instalments'}
        </button>
      )}
    </li>
  );
};

export default PlanInstalmentsControlLine;
