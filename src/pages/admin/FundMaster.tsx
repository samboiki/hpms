import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { Notice } from '../../components/finance/FinanceUI';
import { FundCard } from '../../components/funds/FundCard';
import { FundEditSheet } from '../../components/funds/FundEditSheet';
import { PracticeFundNote } from '../../components/funds/PracticeFundNote';
import { forgetFundLogos } from '../../hooks/useMedicalAidLogo';
import { loadFundMaster, type FundEntry, type FundMasterData, type PracticeFundNote as Note } from '../../services/fundMasterService';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: FundMasterData };

/**
 * Administration > Medical aid funds (parity E10): each fund's name, claim code, claims address, logo, claim deadline
 * and whether it is confirmed, membership numbers, dependant code and payment terms - the rules every practice's claim
 * checks use. OneHealth support changes them; a practice's administrators read them and keep their own note per fund.
 * It wears the look of the other admin pages (Tariffs): a white header bar over a centred column.
 */
const FundMaster: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = contextPracticeId ?? user?.practice_id ?? null;
  const isSupport = user?.is_super_admin === true;
  const keepsNotes = isSupport || user?.role === 'admin';
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<FundEntry | null>(null);
  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    let live = true;
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    loadFundMaster(practiceId)
      .then(data => {
        if (live) setLoad({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        // The database's own wording goes to the console; the banner says what to do
        console.error('Medical aid funds: loading failed', error);
        if (live) setLoad({ status: 'error', message: 'Please check the connection and try again.' });
      });
    return () => {
      live = false;
    };
  }, [practiceId, reloadKey]);

  const noteSaved = (providerId: string, note: Note | null) =>
    setLoad(current =>
      current.status === 'ready'
        ? { status: 'ready', data: { ...current.data, funds: current.data.funds.map(fund => (fund.providerId === providerId ? { ...fund, note } : fund)) } }
        : current
    );

  const data = load.status === 'ready' ? load.data : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Medical aid funds</h1>
          <p className="mt-1 text-gray-600">Each fund&apos;s claim rules: deadline, where claims go, membership numbers and how long it takes to answer.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {load.status === 'loading' && (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#01b9d4] motion-reduce:animate-none" />
            <span className="ml-3 text-gray-600">Loading the medical aid funds...</span>
          </div>
        )}

        {load.status === 'error' && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">The medical aid funds could not be loaded: {load.message}</div>
            <button type="button" onClick={reload} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-700 hover:bg-red-100">
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            {!data.setUp && (
              <Notice tone="warning" title="The fund rules are not set up yet">
                Claims use the app&apos;s usual rules, shown below. They can be changed here once the fund master update is applied to the database.
              </Notice>
            )}
            {!isSupport && (
              <Notice tone="info">
                OneHealth support keeps these rules for every practice. Your practice can add its own note to any fund; only your practice sees it.
              </Notice>
            )}
            {data.problems.map(problem => (
              <Notice key={problem} tone="warning">{problem}</Notice>
            ))}

            {data.funds.length === 0 ? (
              <Notice tone="info">No medical aid funds are set up yet.</Notice>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {data.funds.map(fund => (
                  <FundCard
                    key={fund.providerId}
                    fund={fund}
                    practiceWaits={data.practiceWaits}
                    canEdit={isSupport && data.setUp && fund.code !== null}
                    onEdit={() => setEditing(fund)}
                  >
                    {practiceId && data.setUp && fund.code && (
                      <PracticeFundNote
                        practiceId={practiceId}
                        fundCode={fund.code}
                        fundName={fund.name}
                        note={fund.note}
                        canEdit={keepsNotes}
                        onSaved={note => noteSaved(fund.providerId, note)}
                      />
                    )}
                  </FundCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <FundEditSheet
          fund={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            // A changed logo shows at once; the claim checks already use the new rules (saveFundDetails)
            forgetFundLogos();
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
};

export default FundMaster;
