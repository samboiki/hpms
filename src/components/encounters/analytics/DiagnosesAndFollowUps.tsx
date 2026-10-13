import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import ComprehensivePatientModal from '../../patients/ComprehensivePatientModal';
import { loadFollowUpsDue, loadTopDiagnoses } from '../../../services/encounterAnalyticsService';
import { formatDiaryDate } from '../../../utils/diary/diaryTime';
import { practitionerLabel, type DueFollowUp, type PeriodRange } from '../../../utils/encounters/encounterAnalytics';
import type { VisitFocus } from '../../../utils/encounters/encounterLinks';
import { formatCount } from '../../finance/financeFormat';
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading, DashboardSection } from './AnalyticsParts';
import { visitsText } from './analyticsPalette';

interface DiagnosesAndFollowUpsProps {
  practiceId: string;
  range: PeriodRange;
  todayKey: string;
  /** "13 Sep-12 Oct 2026" */
  rangeText: string;
  onOpenVisits: (focus: VisitFocus) => void;
}

const RETRY_MESSAGE = 'Check the connection and try again.';

const lateText = (item: DueFollowUp): string =>
  item.daysOverdue <= 0 ? 'Due today' : `${item.daysOverdue} ${item.daysOverdue === 1 ? 'day' : 'days'} late`;

/** Encounters > Analytics > Diagnoses and follow-ups, the middle column: what the practice billed for, and who should come back. */
export const DiagnosesAndFollowUps: React.FC<DiagnosesAndFollowUpsProps> = ({ practiceId, range, todayKey, rangeText, onOpenVisits }) => {
  const diagnoses = useQuery({
    queryKey: ['encounter-analytics', 'diagnoses', practiceId, range.from, range.to],
    queryFn: () => loadTopDiagnoses(practiceId, range),
    staleTime: 60_000
  });
  const followUps = useQuery({
    queryKey: ['encounter-analytics', 'follow-ups', practiceId, range.from, todayKey],
    queryFn: () => loadFollowUpsDue(practiceId, range, todayKey),
    staleTime: 60_000
  });
  // The patient a follow-up opens, over this page: closing it comes back here
  const [patientId, setPatientId] = useState<string | null>(null);

  const diagnosisRows = diagnoses.data?.rows ?? [];
  const mostVisits = Math.max(1, ...diagnosisRows.map((row) => row.visitIds.length));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top Diagnoses */}
      <DashboardSection
        title="Top Diagnoses"
        icon="solar:health-bold-duotone"
        iconColor="from-green-500 to-emerald-600"
        actions={<span className="text-xs text-gray-500">ICD-10 codes on invoices in the period</span>}
      >
        {diagnoses.isPending ? (
          <AnalyticsLoading label="Counting the diagnoses..." tall={false} />
        ) : diagnoses.isError ? (
          <AnalyticsError title="The diagnoses could not be counted" message={RETRY_MESSAGE} onRetry={() => void diagnoses.refetch()} tall={false} />
        ) : diagnosisRows.length === 0 ? (
          <AnalyticsEmpty
            icon="solar:clipboard-heart-bold-duotone"
            title="No diagnosis codes in this period"
            message="None of the invoices dated in the period has an ICD-10 code on its lines. Codes added when a visit is billed are counted here."
            tall={false}
          />
        ) : (
          <ul aria-label="Top diagnoses" className="space-y-1">
            {diagnosisRows.map((row) => {
              const description = diagnoses.data?.descriptions.get(row.code);
              const name = description ? `${row.code} ${description}` : `${row.code}, no name in the ICD-10 list`;
              return (
                <li key={row.code}>
                  <button
                    type="button"
                    onClick={() => onOpenVisits({ label: `Diagnosis ${row.code}, ${rangeText}`, visitIds: row.visitIds })}
                    aria-label={`${name}: ${visitsText(row.visitIds.length)}. Open the visits in the encounters list.`}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <span className="min-w-0 break-words text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{row.code}</span> {description ?? <span className="text-gray-500">No name in the ICD-10 list</span>}
                    </span>
                    <span className="flex flex-none items-center gap-2">
                      <span className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <span
                          className="block h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                          style={{ width: `${Math.max(2, (row.visitIds.length / mostVisits) * 100)}%` }}
                        />
                      </span>
                      <span className="text-sm font-medium text-gray-900 w-10 text-right">{formatCount(row.visitIds.length)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>

      {/* Follow-up Visits Due */}
      <DashboardSection
        title="Follow-up Visits Due"
        icon="solar:phone-calling-bold-duotone"
        iconColor="from-amber-500 to-orange-600"
        actions={<span className="text-xs text-gray-500">Not back or booked since</span>}
      >
        {followUps.isPending ? (
          <AnalyticsLoading label="Finding the follow-ups due..." tall={false} />
        ) : followUps.isError ? (
          <AnalyticsError title="The follow-ups could not be found" message={RETRY_MESSAGE} onRetry={() => void followUps.refetch()} tall={false} />
        ) : followUps.data.items.length === 0 ? (
          <AnalyticsEmpty
            icon="solar:shield-check-bold-duotone"
            iconColor="text-green-500"
            title="No follow-ups due"
            message={`Nobody asked to come back between ${formatDiaryDate(range.from)} and today is still waiting.`}
            tall={false}
          />
        ) : (
          <ul aria-label="Follow-up visits due" className="space-y-3">
            {followUps.data.items.map((item) => {
              const practitioner = item.practitionerId ? practitionerLabel(item.practitionerId, followUps.data.staff) : null;
              const late = item.daysOverdue > 0;
              return (
                <li key={item.visitId}>
                  <button
                    type="button"
                    onClick={() => setPatientId(item.patientId)}
                    aria-label={`${item.patientName}, follow-up due ${formatDiaryDate(item.dueOn)}, ${lateText(item).toLowerCase()}. Open the patient.`}
                    className={`w-full p-3 rounded-lg border flex items-start gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      late ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Icon
                      icon={late ? 'solar:danger-triangle-bold' : 'solar:info-circle-bold'}
                      className={`w-5 h-5 flex-none ${late ? 'text-amber-600' : 'text-blue-600'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-sm text-gray-700">
                      <span className="block break-words font-medium text-gray-900">{item.patientName}</span>
                      <span className="block text-xs text-gray-500">
                        Due {formatDiaryDate(item.dueOn)} · seen {formatDiaryDate(item.seenOn)}
                        {practitioner ? ` by ${practitioner}` : ''}
                      </span>
                    </span>
                    <span className={`flex-none text-xs font-medium ${late ? 'text-red-600' : 'text-blue-700'}`}>{lateText(item)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>

      {patientId && (
        <ComprehensivePatientModal
          isOpen
          onClose={() => setPatientId(null)}
          patientId={patientId}
          defaultDetailTab="encounters"
          backAction={{ label: 'Back to analytics', onClick: () => setPatientId(null) }}
        />
      )}
    </div>
  );
};
