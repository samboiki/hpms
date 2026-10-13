import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../../stores/authStore';
import { summarizeActiveProblems } from '../../../utils/clinical/problemList';
import { AllergyPanel } from './AllergyPanel';
import { AlertNotePanel } from './AlertNotePanel';
import { ProblemPanel } from './ProblemPanel';
import { allergyLabel } from '../../../services/patientSafetyService';
import { canVerifyAllergies } from './safetyFormat';
import { usePatientSafety } from './usePatientSafety';

export interface ClinicalAlertStripProps {
  patientId: string;
  practiceId: string | null | undefined;
  /** The visit open on the visit screen (problems added from it remember it) */
  visitId?: string | null;
  /** Open with the details shown */
  defaultExpanded?: boolean;
}

type Tone = 'danger' | 'warning' | 'safe' | 'muted';

const TONE: Readonly<Record<Tone, { bar: string; icon: string; iconName: string }>> = {
  danger: { bar: 'bg-red-50 border-red-200 text-red-900', icon: 'text-red-600', iconName: 'solar:danger-triangle-bold-duotone' },
  warning: { bar: 'bg-amber-50 border-amber-200 text-amber-900', icon: 'text-amber-600', iconName: 'solar:shield-warning-bold-duotone' },
  safe: { bar: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: 'text-emerald-600', iconName: 'solar:shield-check-bold-duotone' },
  muted: { bar: 'bg-gray-50 border-gray-200 text-gray-600', icon: 'text-gray-400', iconName: 'solar:info-circle-bold-duotone' }
};

/**
 * One calm strip on the patient file and the visit screen: allergies (or "no known allergies", or
 * "not recorded yet"), the clinical alert and the active problems on one line, with everything to
 * record or change them one tap away ("Details").
 */
export const ClinicalAlertStrip: React.FC<ClinicalAlertStripProps> = ({ patientId, practiceId, visitId = null, defaultExpanded = false }) => {
  const { user } = useAuthStore();
  const safety = usePatientSafety(patientId);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  if (safety.status === 'not_set_up') {
    return (
      <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs sm:px-6 ${TONE.muted.bar}`}>
        <Icon icon={TONE.muted.iconName} className={`h-4 w-4 shrink-0 ${TONE.muted.icon}`} aria-hidden="true" />
        Allergies, clinical alerts and the problem list are not switched on yet.
      </div>
    );
  }

  if (safety.status === 'loading' || safety.status === 'error' || !safety.data) {
    const failed = safety.status === 'error';
    return (
      <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm sm:px-6 ${failed ? TONE.warning.bar : TONE.muted.bar}`} role={failed ? 'alert' : undefined}>
        <Icon
          icon={failed ? TONE.warning.iconName : 'solar:refresh-bold-duotone'}
          className={`h-4 w-4 shrink-0 ${failed ? TONE.warning.icon : `${TONE.muted.icon} motion-safe:animate-spin`}`}
          aria-hidden="true"
        />
        {failed ? (
          <>
            <span>Could not load the allergies and alerts. Check them before prescribing.</span>
            <button type="button" className="font-medium underline underline-offset-2" onClick={() => void safety.refresh()}>
              Try again
            </button>
          </>
        ) : (
          <span>Checking allergies and alerts...</span>
        )}
      </div>
    );
  }

  const { allergies, profile, problems } = safety.data;
  const noKnownAllergies = profile?.noKnownAllergies === true && allergies.length === 0;
  const alertNote = profile?.alertNote ?? null;
  const problemSummary = summarizeActiveProblems(problems);
  const tone: Tone = allergies.length > 0 ? 'danger' : !noKnownAllergies || alertNote ? 'warning' : 'safe';
  const style = TONE[tone];

  const allergyText =
    allergies.length > 0 ? `Allergic to ${allergies.map(allergyLabel).join(', ')}` : noKnownAllergies ? 'No known allergies' : 'Allergies not recorded yet';

  return (
    <section aria-label="Allergies and clinical alerts" className={`border-b ${style.bar}`}>
      <div className="flex items-start gap-3 px-4 py-2 sm:px-6">
        <Icon icon={style.iconName} className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-6">
          <span className={allergies.length > 0 ? 'font-semibold' : 'font-medium'}>{allergyText}</span>
          {alertNote && (
            <>
              <span className="mx-2 text-current opacity-40" aria-hidden="true">|</span>
              <span className="font-medium">Alert: {alertNote}</span>
            </>
          )}
          {problemSummary && (
            <>
              <span className="mx-2 text-current opacity-40" aria-hidden="true">|</span>
              <span className="text-gray-700">Problems: {problemSummary}</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          {expanded ? 'Hide' : 'Details'}
          <Icon
            icon="solar:alt-arrow-down-bold-duotone"
            className={`h-4 w-4 motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        // Scrolls on its own: the patient file and visit screen keep their tabs and content in view on a phone
        <div id={panelId} className="max-h-[55vh] overflow-y-auto overscroll-contain border-t border-black/5 bg-white px-4 py-4 sm:px-6">
          {practiceId ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <AllergyPanel
                practiceId={practiceId}
                patientId={patientId}
                allergies={allergies}
                profile={profile}
                canVerify={canVerifyAllergies(user?.role)}
                onChanged={safety.refresh}
              />
              <AlertNotePanel practiceId={practiceId} patientId={patientId} profile={profile} onChanged={safety.refresh} />
              <ProblemPanel practiceId={practiceId} patientId={patientId} problems={problems} visitId={visitId} onChanged={safety.refresh} />
            </div>
          ) : (
            <p className="text-sm text-gray-600">Your account has no practice, so these records cannot be changed.</p>
          )}
        </div>
      )}
    </section>
  );
};

export default ClinicalAlertStrip;
