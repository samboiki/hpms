import React, { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';
import { useAuthStore } from '../../stores/authStore';
import { useScreenAccess } from '../../hooks/useScreenAccess';
import { screenGate } from '../../utils/auth/screenAccess';
import { loadActiveAdmission } from '../../services/inpatientService';
import { inpatientLink, useWardBoard } from './inpatientData';

// The sheets download only when opened (the patient file and the visit screen stay as light as before)
const AdmitSheet = lazy(() => import('./AdmitSheet').then(module => ({ default: module.AdmitSheet })));
const AdmissionSheet = lazy(() => import('./AdmissionSheet').then(module => ({ default: module.AdmissionSheet })));

const db = supabase as unknown as SupabaseClient;

/** Whether the practice has an open ward (practices without wards never see the button) */
async function practiceHasWards(practiceId: string): Promise<boolean> {
  const { count, error } = await db.from('hospital_wards').select('id', { count: 'exact', head: true }).eq('practice_id', practiceId).eq('is_active', true);
  return !error && (count ?? 0) > 0;
}

interface InpatientButtonProps {
  patientId: string;
  visitId?: string | null;
  /**
   * Screens above the sheets (the visit screen is a full-screen layer on top of everything) open the Inpatient page
   * instead; this is asked first (unsaved edits) and false stays
   */
  leaveFirst?: () => boolean;
  className: string;
}

/**
 * On the patient file and the visit screen: "Admit" admits this patient (from this visit) to a free bed; once admitted
 * it opens the stay (rounds, nursing, medicines, discharge). On the patient file both open over it; the visit screen,
 * a layer above everything, opens the Inpatient page (asking first when edits are unsaved).
 * Shown only to staff who open the Inpatient page, in practices with a ward.
 */
const InpatientButtonInner: React.FC<InpatientButtonProps> = ({ patientId, visitId, leaveFirst, className }) => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const practiceId = user?.practice_id ?? null;
  const access = useScreenAccess();
  const open = screenGate(user, 'inpatient', access) === 'open';
  const [sheet, setSheet] = useState<'admit' | 'stay' | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const wards = useQuery({ queryKey: ['inpatient', 'has-wards', practiceId], queryFn: () => practiceHasWards(practiceId as string), enabled: open && !!practiceId });
  const stay = useQuery({ queryKey: ['inpatient', 'patient', patientId], queryFn: () => loadActiveAdmission(patientId), enabled: open && wards.data === true });
  const board = useWardBoard(sheet && practiceId ? practiceId : null);
  if (!open || wards.data !== true || stay.isLoading || !practiceId) return null;
  const admission = stay.data ?? null;
  const admissionId = openedId ?? admission?.id ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!leaveFirst) setSheet(admission ? 'stay' : 'admit');
          else if (leaveFirst()) navigate(inpatientLink(patientId, visitId, admission?.id ?? null));
        }}
        className={className}
        aria-haspopup={leaveFirst ? undefined : 'dialog'}
      >
        <Icon icon="solar:bed-bold-duotone" className="h-5 w-5" aria-hidden="true" />
        {admission ? `In bed (${admission.admission_number})` : 'Admit'}
      </button>
      {sheet && board.data && (
        <Suspense fallback={null}>
          {sheet === 'admit' && (
            <AdmitSheet
              practiceId={practiceId}
              role={user?.role ?? null}
              board={board.data}
              patientId={patientId}
              visitId={visitId ?? null}
              bedId={null}
              onClose={() => setSheet(null)}
              onAdmitted={id => {
                setOpenedId(id);
                setSheet('stay');
              }}
            />
          )}
          {sheet === 'stay' && admissionId && (
            <AdmissionSheet admissionId={admissionId} practiceId={practiceId} role={user?.role ?? null} board={board.data} onClose={() => setSheet(null)} />
          )}
        </Suspense>
      )}
    </>
  );
};

/**
 * The app's own query cache, given here as well: the same cache the app provides (main.tsx), so the button also works
 * on screens rendered without it (the visit screen's tests)
 */
export const InpatientButton: React.FC<InpatientButtonProps> = props => (
  <QueryClientProvider client={queryClient}>
    <InpatientButtonInner {...props} />
  </QueryClientProvider>
);

export default InpatientButton;
