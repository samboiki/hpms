/**
 * The bed board is what ward staff look at all day: an occupied bed must open the patient's stay, a free bed must offer
 * "Admit to this bed", and only nurses and administrators may take a bed out of use (reception may not). Invented data.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BedBoardTab } from '../BedBoardTab';
import type { BoardWard } from '../inpatientData';
import type { Admission, Bed, Ward } from '../../../services/inpatientService';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const ward: Ward = {
  id: 'w1', ward_name: 'Ward B', ward_code: null, ward_type: 'general', floor_number: 1, description: null, visiting_hours_start: '14:00:00',
  visiting_hours_end: '16:00:00', max_visitors_per_patient: 2, is_active: true, bed_day_code: 'W100', daily_codes: []
};
const bed = (id: string, number: string, status: string): Bed => ({
  id, ward_id: 'w1', bed_number: number, bed_code: null, bed_type: 'standard', room_number: null, room_type: null, status,
  daily_rate: 950, last_cleaned_at: null, notes: null, is_active: true
});
const admission = { id: 'adm-1', admission_number: 'ADM-2026-000001', admission_date: new Date().toISOString(), fall_risk: true,
  isolation_required: false, allergy_alert: false, patients: { first_name: 'Test', last_name: 'Patient' } } as unknown as Admission;

const wards = (): BoardWard[] => [{
  ward,
  beds: [
    { bed: bed('b1', '1', 'occupied'), admission, board: { id: 'b1', status: 'occupied', isActive: true, admissionId: 'adm-1' } },
    { bed: bed('b2', '2', 'available'), admission: null, board: { id: 'b2', status: 'available', isActive: true, admissionId: null } },
    { bed: bed('b3', '3', 'cleaning'), admission: null, board: { id: 'b3', status: 'cleaning', isActive: true, admissionId: null } }
  ]
}];

describe('the bed board', () => {
  it('opens the stay of the patient in an occupied bed, and shows their name and safety flags on the bed', () => {
    const onOpen = vi.fn();
    render(<BedBoardTab wards={wards()} role="nurse" onOpenAdmission={onOpen} onAdmit={vi.fn()} />);
    expect(screen.getByText('Fall risk')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Bed 1: Occupied, Test Patient/ }));
    expect(onOpen).toHaveBeenCalledWith('adm-1');
  });

  it('offers a free bed for admission, and keeps "Out of use" from reception', () => {
    const onAdmit = vi.fn();
    render(<BedBoardTab wards={wards()} role="receptionist" onOpenAdmission={vi.fn()} onAdmit={onAdmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bed 2: Free' }));
    expect(screen.queryByRole('button', { name: /Out of use/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Admit to this bed/ }));
    expect(onAdmit).toHaveBeenCalledWith('b2');
  });

  it('lets a nurse mark a cleaned bed free, but never admit into a bed still being cleaned', () => {
    render(<BedBoardTab wards={wards()} role="nurse" onOpenAdmission={vi.fn()} onAdmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bed 3: Needs cleaning' }));
    expect(screen.getByRole('button', { name: /Cleaned: mark free/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Out of use/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Admit to this bed/ })).toBeNull();
  });

  it('tells an administrator where to set up wards when there are none', () => {
    const onSetUp = vi.fn();
    render(<BedBoardTab wards={[]} role="admin" onOpenAdmission={vi.fn()} onAdmit={vi.fn()} onSetUp={onSetUp} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up wards' }));
    expect(onSetUp).toHaveBeenCalled();
  });
});
