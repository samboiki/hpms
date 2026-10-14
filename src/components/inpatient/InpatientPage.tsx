import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { SECTION_COLORS } from '../../config/sectionColors';
import { PageHeader, PageShell } from '../layout/PageHeader';
import { PageTabs, type PageTab } from '../ui/PageTabs';
import { ErrorState, LoadingState, MiniStat } from '../finance/FinanceUI';
import { InpatientNotSetUp, INPATIENT_NOT_SET_UP } from '../../services/inpatientService';
import { boardCounts, canDo } from '../../utils/inpatient/inpatientRules';
import { errorText, CARD, PRIMARY } from '../stock/stockUi';
import { boardWards, useWardBoard } from './inpatientData';
import { BedBoardTab } from './BedBoardTab';
import { InpatientListTab } from './InpatientListTab';
import { DischargedTab } from './DischargedTab';
import { WardSetupTab } from './WardSetupTab';
import { AdmitSheet } from './AdmitSheet';
import { AdmissionSheet } from './AdmissionSheet';

type InpatientTab = 'board' | 'patients' | 'discharged' | 'setup';

const TABS: readonly PageTab<InpatientTab>[] = [
  { key: 'board', label: 'Bed board', icon: 'solar:bed-bold-duotone' },
  { key: 'patients', label: 'In the ward', icon: 'solar:user-heart-bold-duotone' },
  { key: 'discharged', label: 'Discharged', icon: 'solar:history-bold-duotone' },
  // Administrators only: the wards, beds, daily rates and the codes a stay is billed under
  { key: 'setup', label: 'Wards and beds', icon: 'solar:settings-bold-duotone' }
];

const isTab = (value: string | null): value is InpatientTab => TABS.some(tab => tab.key === value);

/**
 * Inpatient: the practice's wards and beds, who is in them, and each stay from admission to the invoice. Opened from
 * the sidebar, or with ?admit=<patient>&visit=<visit> from the patient file or a visit, or ?admission=<stay> to open
 * one stay.
 */
export const InpatientPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = contextPracticeId ?? user?.practice_id ?? null;
  const role = user?.role ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<InpatientTab>(isTab(requested) ? requested : 'board');
  useEffect(() => {
    if (isTab(requested)) setTab(requested);
  }, [requested]);

  const board = useWardBoard(practiceId);
  const tabs = TABS.filter(entry => entry.key !== 'setup' || canDo(role, 'setUpWards'));
  const shown: InpatientTab = tabs.some(entry => entry.key === tab) ? tab : 'board';

  const admissionId = searchParams.get('admission');
  const admitPatientId = searchParams.get('admit');
  const [admitting, setAdmitting] = useState<{ bedId?: string } | null>(null);

  const setParams = (change: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams);
    change(params);
    setSearchParams(params, { replace: true });
  };
  const changeTab = (next: InpatientTab) => {
    setTab(next);
    setParams(params => params.set('tab', next));
  };
  const openAdmission = (id: string) => setParams(params => params.set('admission', id));
  const closeAdmission = () => setParams(params => params.delete('admission'));
  const closeAdmit = () => {
    setAdmitting(null);
    setParams(params => {
      params.delete('admit');
      params.delete('visit');
    });
  };

  const notSetUp = board.error instanceof InpatientNotSetUp;
  const wards = board.data ? boardWards(board.data) : [];
  const counts = boardCounts(wards.flatMap(ward => ward.beds.map(entry => entry.board)));
  const admitOpen = !!board.data && canDo(role, 'admit') && (!!admitting || !!admitPatientId);

  return (
    <PageShell>
      <PageHeader
        section="inpatient"
        icon="solar:bed-bold-duotone"
        title="Inpatient"
        subtitle="Wards and beds, admitted patients, rounds, nursing, medicines and visitors."
        actions={board.data && canDo(role, 'admit') && (
          <button type="button" onClick={() => setAdmitting({})} className={PRIMARY}>
            <Icon icon="solar:user-plus-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Admit a patient
          </button>
        )}
      />

      {notSetUp ? (
        <div className={`${CARD} flex items-start gap-3 p-5`} role="status">
          <Icon icon="solar:bed-bold-duotone" className={`mt-0.5 h-6 w-6 flex-shrink-0 ${SECTION_COLORS.inpatient.text}`} aria-hidden="true" />
          <p className="text-sm text-gray-700">{INPATIENT_NOT_SET_UP}</p>
        </div>
      ) : board.error ? (
        <ErrorState title="The wards could not be loaded" message={errorText(board.error)} onRetry={() => void board.refetch()} />
      ) : !board.data ? (
        <LoadingState label="Loading the wards" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat icon="solar:bed-bold-duotone" label="Free beds" value={String(counts.free + counts.reserved)} tone="green" />
            <MiniStat icon="solar:user-heart-bold-duotone" label="Patients in a bed" value={String(counts.occupied)} tone={SECTION_COLORS.inpatient.tone} />
            <MiniStat icon="solar:broom-bold-duotone" label="Need cleaning" value={String(counts.cleaning)} tone="amber" />
            <MiniStat icon="solar:forbidden-circle-bold-duotone" label="Out of use" value={String(counts.outOfUse)} tone="gray" />
          </div>
          <PageTabs tabs={tabs} active={shown} onChange={changeTab} label="Inpatient sections" activeClassName={SECTION_COLORS.inpatient.activeTab} />
          <div role="tabpanel" aria-label={tabs.find(item => item.key === shown)?.label}>
            {shown === 'board' && (
              <BedBoardTab wards={wards} role={role} onOpenAdmission={openAdmission} onAdmit={bedId => setAdmitting({ bedId })}
                onSetUp={canDo(role, 'setUpWards') ? () => changeTab('setup') : undefined} />
            )}
            {shown === 'patients' && <InpatientListTab board={board.data} practiceId={practiceId} onOpen={openAdmission} />}
            {shown === 'discharged' && <DischargedTab practiceId={practiceId} onOpen={openAdmission} />}
            {shown === 'setup' && <WardSetupTab board={board.data} />}
          </div>
        </>
      )}

      {admitOpen && board.data && practiceId && (
        <AdmitSheet
          practiceId={practiceId}
          role={role}
          board={board.data}
          patientId={admitPatientId}
          visitId={searchParams.get('visit')}
          bedId={admitting?.bedId ?? null}
          onClose={closeAdmit}
          onAdmitted={id => {
            closeAdmit();
            openAdmission(id);
          }}
        />
      )}
      {admissionId && board.data && practiceId && (
        <AdmissionSheet key={admissionId} admissionId={admissionId} practiceId={practiceId} role={role} board={board.data} onClose={closeAdmission} />
      )}
    </PageShell>
  );
};

export default InpatientPage;
