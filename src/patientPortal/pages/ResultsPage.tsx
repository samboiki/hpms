import React, { useCallback, useMemo } from 'react';
import { usePortal, usePortalLoad } from '../portalContext';
import { formatDay, groupResults, type PortalLabResult } from '../portalModel';
import { loadResults, type PortalLoad } from '../portalService';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, NotEnabledBlock, Notice, PageTitle, StatusPill } from '../components/PortalUi';

const ResultRow: React.FC<{ result: PortalLabResult }> = ({ result }) => (
  <div className="py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium text-gray-900 break-words min-w-0">{result.testName}</p>
      {result.status !== 'normal' && (
        // Spelled out as well as coloured, as on the staff screens
        <StatusPill tone="amber">{result.status === 'high' ? 'Above range' : 'Below range'}</StatusPill>
      )}
    </div>
    <p className="text-base text-gray-900">
      {result.value}
      {result.unit ? ` ${result.unit}` : ''}
    </p>
    <p className="text-xs text-gray-500">Reference range: {result.referenceRange ?? 'not given'}</p>
  </div>
);

/**
 * Lab results of the chosen person that a doctor released to the patient app. Results waiting for the
 * doctor are never shown here (the database returns only released ones and the app checks again).
 */
const ResultsPage: React.FC = () => {
  const { selected } = usePortal();
  const patientId = selected?.patientId ?? null;
  const loader = useCallback(
    (): Promise<PortalLoad<PortalLabResult[]>> => (patientId ? loadResults(patientId) : Promise.resolve({ state: 'ready', data: [] })),
    [patientId]
  );
  const { view, reload } = usePortalLoad(loader);
  const groups = useMemo(() => (view.state === 'ready' ? groupResults(view.data) : []), [view]);
  if (!selected) return null;

  return (
    <div className="space-y-3">
      <PageTitle icon="solar:test-tube-bold-duotone" title="Results" subtitle={selected.firstName} />
      <Notice tone="info" icon="solar:stethoscope-bold-duotone">
        <p>Your doctor shares results here after looking at them, so some results may take a little longer to appear.</p>
        <p>A value outside the reference range is not always a problem. Please discuss your results with your practitioner.</p>
      </Notice>

      {view.state === 'loading' && <LoadingBlock />}
      {view.state === 'not_enabled' && <NotEnabledBlock />}
      {view.state === 'error' && <ErrorBlock message={view.message} onRetry={reload} />}
      {view.state === 'ready' && groups.length === 0 && (
        <Card>
          <EmptyBlock icon="solar:test-tube-minimalistic-bold-duotone" title="No results shared yet">
            When your practitioner shares a result, it appears here.
          </EmptyBlock>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group.key}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className="font-semibold text-gray-900">{formatDay(group.requestDate) ?? 'Lab test'}</h2>
            {group.releasedAt && <span className="text-xs text-gray-500">Shared {formatDay(group.releasedAt)}</span>}
          </div>
          {group.labFacility && <p className="text-sm text-gray-500 mb-1">{group.labFacility}</p>}
          {group.results.map((result) => (
            <ResultRow key={result.id} result={result} />
          ))}
        </Card>
      ))}
    </div>
  );
};

export default ResultsPage;
