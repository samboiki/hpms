import React from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Icon } from '@iconify/react';
import { todayKey } from '../../utils/billing/dates';
import { EmptyState } from '../finance/FinanceUI';
import { PRIMARY } from '../stock/stockUi';
import type { PatientInvoice } from './patientBilling';
import { JourneyVisitCard } from './journey/JourneyVisitCard';
import { sortNewestFirst, type JourneyVisit, type VisitQuickTab, type VisitRecordCounts } from './journey/visitJourney';

// Tabs of FullScreenEditVisitModal that the card's actions open
export type { VisitQuickTab };

interface EncounterTimelineProps<V extends JourneyVisit> {
  visits: V[];
  appointments?: unknown[];  // Deprecated - appointments are scheduled visits; not read
  patientName?: string;
  onAddVisit?: () => void;
  onAddVisitTabs?: () => void;
  onEditVisit?: (visit: V) => void;
  onOpenVisitTab?: (visit: V, tab: VisitQuickTab) => void;  // Open the visit on a specific edit tab
  onCreateFollowUp?: (visit: V) => void;
  onStartAppointment?: (visit: V) => void;
  onVisitStatusChange?: (visitId: string, newStatus: string) => void;
  // Lab, imaging and media counts per visit, loaded once with the patient file (no query per card)
  visitCounts?: { [visitId: string]: Partial<VisitRecordCounts> };
  // This patient's invoices (usePatientInvoices); undefined until they have loaded
  invoices?: readonly PatientInvoice[];
}

// Donut Chart Component
const CompletionDonutChart: React.FC<{ visits: readonly JourneyVisit[] }> = ({ visits }) => {
  const completedVisits = visits.filter(visit => visit.status === 'completed').length;
  const totalVisits = visits.length;
  const completionPercentage = totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0;

  const circumference = 2 * Math.PI * 32;
  const strokeDasharray = `${(completionPercentage / 100) * circumference} ${circumference}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="80" height="80" className="transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="text-indigo-600 transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-lg font-bold text-indigo-600">{Math.round(completionPercentage)}%</div>
        </div>
      </div>

      {/* Legend - Single row layout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
          <span className="text-xs text-gray-700">Completed ({completedVisits})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-gray-200 rounded-full"></div>
          <span className="text-xs text-gray-700">Pending ({totalVisits - completedVisits})</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Patient file > Encounters: the patient's visits, newest first, as calm cards on a timeline line,
 * beside Journey Progress. Each card's display rules live in ./journey/visitJourney.ts.
 */
function EncounterTimeline<V extends JourneyVisit>({
  visits,
  onAddVisit,
  onEditVisit,
  onOpenVisitTab,
  onCreateFollowUp,
  onVisitStatusChange,
  visitCounts,
  invoices
}: EncounterTimelineProps<V>) {
  const sortedVisits = sortNewestFirst(visits);
  // One date for every card, so "Today", Scheduled and Pending agree across the journey
  const today = todayKey();

  return (
    // Animations below honour the device's "reduce motion" setting
    <MotionConfig reducedMotion="user">
      {/* Up to 768px the app's mobile CSS removes the patient file's padding; keep the journey off the screen edge */}
      <div className="relative [@media(max-width:768px)]:px-3">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Patient Journey</h2>
            {sortedVisits.length > 0 && (
              <p className="mt-0.5 text-sm text-gray-500">
                {sortedVisits.length === 1 ? '1 visit' : `${sortedVisits.length} visits`}, newest first
              </p>
            )}
          </div>

          {onAddVisit && (
            <button type="button" onClick={onAddVisit} className={`${PRIMARY} w-full sm:w-auto`}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
              Add New Visit
            </button>
          )}
        </div>

        {/* Phones and tablets: one column | Desktop: Timeline (10/12) + Journey Progress (2/12).
            gap-x/gap-y, not gap-6: the mobile CSS pads anything whose class contains "p-6" */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-6 gap-y-6">
          <div className="min-w-0 lg:col-span-10">
            {sortedVisits.length === 0 ? (
              <EmptyState
                icon="solar:stethoscope-bold-duotone"
                title="No visits yet"
                message={onAddVisit ? "Use 'Add New Visit' to record this patient's first visit." : "This patient's visits will appear here."}
              />
            ) : (
              <ol aria-label="Visits, newest first" className="space-y-4 sm:space-y-5">
                {sortedVisits.map((visit, index) => (
                  <li key={visit.id} className="relative sm:pl-8">
                    {/* The timeline line, from this visit's marker down to the next visit's */}
                    {index < sortedVisits.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-11 left-2 top-10 hidden w-px -translate-x-1/2 bg-gray-200 sm:block"
                      />
                    )}
                    <JourneyVisitCard
                      visit={visit}
                      today={today}
                      counts={visitCounts?.[visit.id]}
                      invoices={invoices}
                      onOpenVisit={onEditVisit}
                      onOpenVisitTab={onOpenVisitTab}
                      onCreateFollowUp={onCreateFollowUp}
                      onStatusChange={onVisitStatusChange}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Journey Progress Column - Mobile: Full width | Desktop: 2/12 width */}
          <div className="lg:col-span-2 order-first lg:order-last journey-progress-section">
            <div className="sticky top-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <div className="relative">
                  {/* Pure glassmorphic card with border */}
                  <div className="relative bg-white/30 backdrop-blur-xl rounded-3xl p-6 overflow-hidden border border-gray-200/50">
                    {/* Gradient overlay for glassmorphic effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 via-white/10 to-indigo-100/30 pointer-events-none" />

                    {/* Content */}
                    <div className="relative z-10">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Journey Progress</h3>
                        <p className="text-sm text-gray-700/80">Visit completion status</p>
                      </div>
                      <CompletionDonutChart visits={sortedVisits} />
                    </div>

                    {/* Subtle decorative elements */}
                    <motion.div
                      className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-purple-300/20 to-indigo-300/20 rounded-full blur-3xl"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br from-indigo-300/20 to-purple-300/20 rounded-full blur-2xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

export default EncounterTimeline;
