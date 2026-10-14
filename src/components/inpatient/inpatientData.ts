/**
 * The Inpatient page's data through the app's query cache (src/lib/queryClient.ts): every key starts with 'inpatient',
 * so refreshAfterSave('inpatient') after any save brings the board, the lists and an open stay up to date at once.
 */
import { useQuery } from '@tanstack/react-query';
import { loadPracticeStaff } from '../../services/invoiceContextService';
import {
  InpatientNotSetUp,
  loadAdmissionDetail,
  loadDischarged,
  loadWardBoard,
  type Admission,
  type Allocation,
  type Bed,
  type Ward,
  type WardBoard
} from '../../services/inpatientService';
import type { BoardBed, StaySegment } from '../../utils/inpatient/inpatientRules';

/** A missing table is not retried: the page says "not set up" at once */
const retry = (count: number, error: unknown) => !(error instanceof InpatientNotSetUp) && count < 2;

export const useWardBoard = (practiceId: string | null) =>
  useQuery({ queryKey: ['inpatient', 'board', practiceId], queryFn: () => loadWardBoard(practiceId as string), enabled: !!practiceId, retry });

export const useDischarged = (practiceId: string | null, enabled: boolean) =>
  useQuery({ queryKey: ['inpatient', 'discharged', practiceId], queryFn: () => loadDischarged(practiceId as string), enabled: !!practiceId && enabled, retry });

export const useAdmissionDetail = (admissionId: string | null) =>
  useQuery({ queryKey: ['inpatient', 'admission', admissionId], queryFn: () => loadAdmissionDetail(admissionId as string), enabled: !!admissionId, retry });

/** The practice's staff by id: names for "who did it", and the doctors to choose from */
export function useStaff(practiceId: string | null) {
  const query = useQuery({ queryKey: ['inpatient', 'staff', practiceId], queryFn: () => loadPracticeStaff(practiceId), enabled: !!practiceId });
  const staff = query.data ?? [];
  const names = new Map(staff.map(member => [member.id, member.full_name ?? 'Staff member']));
  const doctors = staff.filter(member => member.role === 'doctor' && member.is_active !== false);
  return { names, doctors };
}

export const staffName = (names: ReadonlyMap<string, string>, id: string | null | undefined): string =>
  (id ? names.get(id) : undefined) ?? (id ? 'A staff member' : '');

export const patientName = (admission: Pick<Admission, 'patients'>): string =>
  [admission.patients?.first_name, admission.patients?.last_name].filter(Boolean).join(' ') || 'Patient';

export const rateOf = (bed: Pick<Bed, 'daily_rate'>): number | null => {
  if (bed.daily_rate === null || bed.daily_rate === undefined || bed.daily_rate === '') return null;
  const rate = Number(bed.daily_rate);
  return Number.isFinite(rate) ? rate : null;
};

export interface BoardWard {
  ward: Ward;
  beds: Array<{ bed: Bed; admission: Admission | null; board: BoardBed }>;
}

/** The board per ward: each bed with the patient in it now */
export function boardWards(board: WardBoard): BoardWard[] {
  const admissionById = new Map(board.active.map(admission => [admission.id, admission]));
  const admissionByBed = new Map<string, Admission>();
  for (const allocation of board.current) {
    const admission = admissionById.get(allocation.admission_id);
    if (admission) admissionByBed.set(allocation.bed_id, admission);
  }
  return board.wards.map(ward => ({
    ward,
    beds: board.beds.filter(bed => bed.ward_id === ward.id).map(bed => {
      const admission = admissionByBed.get(bed.id) ?? null;
      return { bed, admission, board: { id: bed.id, status: bed.status, isActive: bed.is_active !== false && ward.is_active !== false, admissionId: admission?.id ?? null } };
    })
  }));
}

/** "Bed 4, Ward B" */
export function bedPlace(board: Pick<WardBoard, 'wards' | 'beds'>, bedId: string | null | undefined): string {
  const bed = board.beds.find(item => item.id === bedId);
  if (!bed) return 'No bed';
  const ward = board.wards.find(item => item.id === bed.ward_id);
  return `Bed ${bed.bed_number}${ward ? `, ${ward.ward_name}` : ''}`;
}

/** The current bed of a stay, from the board */
export const currentBedOf = (board: WardBoard, admissionId: string): Allocation | undefined =>
  board.current.find(allocation => allocation.admission_id === admissionId);

/** The beds a stay used, in order, for the nights billed (stayNights) */
export function staySegments(allocations: readonly Allocation[], board: Pick<WardBoard, 'wards' | 'beds'>): StaySegment[] {
  return allocations.map(allocation => {
    const bed = board.beds.find(item => item.id === allocation.bed_id);
    const ward = board.wards.find(item => item.id === allocation.ward_id);
    return {
      bedId: allocation.bed_id,
      bedLabel: bed?.bed_number ?? '?',
      wardId: allocation.ward_id,
      wardName: ward?.ward_name ?? 'Ward',
      dailyRate: bed ? rateOf(bed) : null,
      from: allocation.allocated_at,
      to: allocation.released_at
    };
  });
}

/** The Inpatient page with this patient's admission, or their stay, open */
export const inpatientLink = (patientId: string, visitId: string | null | undefined, admissionId: string | null): string =>
  `/inpatient?${new URLSearchParams(admissionId ? { tab: 'patients', admission: admissionId } : { admit: patientId, ...(visitId ? { visit: visitId } : {}) }).toString()}`;
