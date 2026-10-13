import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { EmptyState, ErrorState, LoadingState, Notice, SegmentedTabs } from '../FinanceUI';
import { ImportSection } from './ImportSection';
import { PostedSection } from './PostedSection';
import { RejectionsSection } from './RejectionsSection';
import { loadImportContext, loadSetupState, REMITTANCES_NOT_SET_UP_MESSAGE, type ImportContext, type SetupState } from './remittanceService';
import { loadFundRules } from '../../../services/fundMasterService';

type Section = 'import' | 'posted' | 'rejections';
const isSection = (value: string | null): value is Section => value === 'import' || value === 'posted' || value === 'rejections';

interface RemittancesTabProps {
  practiceId: string | null;
  practiceName: string;
  /** A payment posted, a rejection settled or a receipt changed: Finance reloads its figures */
  onChanged?: () => void;
}

/**
 * Finance > Remittances: drop the funds' remittances and responses in, check how their lines match
 * the claims sent, post the payments (one receipt per payment) and work through what the funds did
 * not pay. Reading and matching a file work before the remittance tables exist; saving, posting and
 * the rejection queue need proposals/2026-10-07-remittances.sql.
 */
export const RemittancesTab: React.FC<RemittancesTabProps> = ({ practiceId, practiceName, onChanged }) => {
  const role = useAuthStore(state => state.user?.role ?? null);
  // Links such as /finance?tab=remittances&section=rejections&patient=<id> (from the patient file) open one patient's queue
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedSection = searchParams.get('section');
  const patientFilter = searchParams.get('patient');
  const [section, setSection] = useState<Section>(isSection(linkedSection) ? linkedSection : 'import');
  useEffect(() => {
    if (isSection(linkedSection)) setSection(linkedSection);
  }, [linkedSection]);
  const showAllPatients = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('patient');
    setSearchParams(next, { replace: true });
  };
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [context, setContext] = useState<ImportContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setError(null);
    try {
      // The fund master's rules (once per session) before the screens show: resubmission deadlines follow them
      const [state, importContext] = await Promise.all([loadSetupState(practiceId), loadImportContext(practiceId, role), loadFundRules()]);
      setSetup(state);
      setContext(importContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load remittance import.');
    }
  }, [practiceId, role]);

  useEffect(() => {
    setSetup(null);
    setContext(null);
    load();
  }, [load]);

  if (!practiceId) {
    return <EmptyState icon="solar:buildings-2-bold-duotone" title="No practice selected" message="Choose a practice to import its remittances." />;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ErrorState title="Remittance import could not start" message={error} onRetry={load} />
      </div>
    );
  }
  if (!setup || !context) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <LoadingState label="Loading remittance import" rows={3} />
      </div>
    );
  }

  // Posting makes receipts: the other sections and Finance's figures (collections, what the funds owe) follow
  const changed = () => {
    setRefreshKey(key => key + 1);
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      <SegmentedTabs<Section>
        ariaLabel="Remittance sections"
        value={section}
        onChange={setSection}
        options={[
          { value: 'import', label: 'Import', icon: 'solar:upload-square-bold-duotone' },
          { value: 'posted', label: 'Imported', icon: 'solar:checklist-minimalistic-bold-duotone' },
          { value: 'rejections', label: 'Rejections', icon: 'solar:danger-triangle-bold-duotone' }
        ]}
      />
      {setup === 'not_set_up' && (
        <Notice tone="warning" title="Remittance import is not set up yet">
          {REMITTANCES_NOT_SET_UP_MESSAGE}
        </Notice>
      )}
      {section === 'import' && (
        <ImportSection practiceId={practiceId} practiceName={practiceName} context={context} setup={setup} onPosted={changed} />
      )}
      {section === 'posted' && <PostedSection key={`posted-${refreshKey}`} practiceId={practiceId} practiceName={practiceName} setup={setup} onChanged={onChanged} />}
      {section === 'rejections' && (
        <RejectionsSection
          key={`rejections-${refreshKey}`}
          practiceId={practiceId}
          setup={setup}
          canApproveWriteOffs={context.canApproveWriteOffs}
          patientId={patientFilter}
          onShowAllPatients={showAllPatients}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};
