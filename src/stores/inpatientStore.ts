import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

// Types
export interface HospitalWard {
  id: string;
  practice_id: string;
  branch_id?: string;
  ward_name: string;
  ward_code?: string;
  ward_type: 'general' | 'icu' | 'pediatric' | 'maternity' | 'emergency' | 'surgical' | 'psychiatric' | 'oncology';
  floor_number?: number;
  capacity: number;
  current_occupancy: number;
  nurse_station_ext?: string;
  head_nurse_id?: string;
  head_nurse?: {
    id: string;
    name: string;
  };
  description?: string;
  features?: string[];
  visiting_hours_start?: string;
  visiting_hours_end?: string;
  max_visitors_per_patient?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WardBed {
  id: string;
  ward_id: string;
  ward?: HospitalWard;
  bed_number: string;
  bed_code?: string;
  bed_type: 'standard' | 'icu' | 'pediatric' | 'isolation' | 'vip' | 'emergency';
  room_number?: string;
  room_type?: 'single' | 'double' | 'ward' | 'isolation' | 'vip';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'cleaning' | 'blocked';
  features?: string[];
  daily_rate?: number;
  last_cleaned_at?: string;
  next_maintenance_date?: string;
  notes?: string;
  is_active: boolean;
  current_patient?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number?: string;
  };
}

export interface PatientAdmission {
  id: string;
  admission_number: string;
  patient_id: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
    medical_aid_details?: any[];
  };
  visit_id?: string;
  practice_id: string;

  // Admission Details
  admission_date: string;
  expected_discharge_date?: string;
  actual_discharge_date?: string;
  admission_type: 'emergency' | 'scheduled' | 'transfer_in' | 'referral' | 'newborn';
  admission_source?: 'emergency_room' | 'outpatient_clinic' | 'transfer_hospital' | 'transfer_ward' | 'physician_referral' | 'walk_in';

  // Medical Team
  attending_doctor_id?: string;
  attending_doctor?: {
    id: string;
    name: string;
    specialization?: string;
  };
  admitting_doctor_id?: string;
  referring_doctor_name?: string;
  referring_hospital?: string;

  // Diagnosis
  chief_complaint?: string;
  primary_diagnosis?: string;
  primary_diagnosis_code?: string;
  secondary_diagnoses?: string[];
  secondary_diagnosis_codes?: string[];

  // Status
  admission_status: 'active' | 'discharged' | 'transferred' | 'deceased' | 'left_ama';
  patient_condition?: 'stable' | 'fair' | 'serious' | 'critical' | 'undetermined';

  // Current Bed
  current_bed?: {
    bed_id: string;
    bed_number: string;
    ward_name: string;
    room_number?: string;
  };

  // Insurance
  insurance_verified: boolean;
  insurance_verification_date?: string;
  pre_authorization_number?: string;
  estimated_length_of_stay?: number;

  // Additional
  special_requirements?: string[];
  isolation_required?: boolean;
  isolation_type?: string;
  fall_risk?: boolean;
  allergy_alert?: boolean;

  created_at: string;
  updated_at: string;
}

export interface BedAllocation {
  id: string;
  admission_id: string;
  bed_id: string;
  patient_id: string;
  ward_id: string;
  allocated_at: string;
  released_at?: string;
  allocated_by?: string;
  released_by?: string;
  transfer_reason?: 'medical_needs' | 'patient_request' | 'bed_availability' | 'isolation' | 'discharge' | 'deceased';
  notes?: string;
  is_current: boolean;
}

export interface NursingCareRecord {
  id: string;
  admission_id: string;
  patient_id: string;
  nurse_id: string;
  nurse?: {
    id: string;
    name: string;
  };
  shift_type: 'morning' | 'afternoon' | 'night' | 'custom';
  shift_start_time: string;
  shift_end_time?: string;
  vital_signs_checked: boolean;
  medications_given?: any;
  fluid_intake_ml?: number;
  urine_output_ml?: number;
  patient_condition?: string;
  pain_level?: number;
  nursing_notes?: string;
  alerts?: string[];
  created_at: string;
}

export interface WardRound {
  id: string;
  admission_id: string;
  patient_id: string;
  doctor_id: string;
  doctor?: {
    id: string;
    name: string;
    specialization?: string;
  };
  round_datetime: string;
  round_type?: 'regular' | 'emergency' | 'discharge' | 'consultation';
  patient_condition: 'stable' | 'improving' | 'unchanged' | 'deteriorating' | 'critical';
  examination_findings?: string;
  treatment_changes?: string;
  new_orders?: string[];
  doctor_notes?: string;
  next_review_date?: string;
  created_at: string;
}

interface InpatientStore {
  // State
  wards: HospitalWard[];
  beds: WardBed[];
  admissions: PatientAdmission[];
  activeAdmissions: PatientAdmission[];
  bedAllocations: BedAllocation[];
  nursingRecords: NursingCareRecord[];
  wardRounds: WardRound[];

  // Loading states
  isLoading: boolean;
  isAdmitting: boolean;
  isDischarging: boolean;
  isTransferring: boolean;

  // Statistics
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;

  // Actions - Ward Management
  fetchWards: (practiceId: string) => Promise<void>;
  createWard: (wardData: Partial<HospitalWard>) => Promise<HospitalWard | null>;
  updateWard: (wardId: string, updates: Partial<HospitalWard>) => Promise<void>;

  // Actions - Bed Management
  fetchBeds: (wardId?: string) => Promise<void>;
  fetchAllBedsWithStatus: (practiceId: string) => Promise<void>;
  updateBedStatus: (bedId: string, status: WardBed['status']) => Promise<void>;
  getAvailableBeds: (wardType?: string) => WardBed[];

  // Actions - Admission Management
  fetchAdmissions: (practiceId: string, status?: 'active' | 'all') => Promise<void>;
  admitPatient: (admissionData: Partial<PatientAdmission>) => Promise<PatientAdmission | null>;
  dischargePatient: (admissionId: string, dischargeData: any) => Promise<void>;
  updateAdmission: (admissionId: string, updates: Partial<PatientAdmission>) => Promise<void>;

  // Actions - Bed Allocation
  allocateBed: (admissionId: string, bedId: string, notes?: string) => Promise<void>;
  transferBed: (admissionId: string, newBedId: string, reason: string) => Promise<void>;
  releaseBed: (allocationId: string) => Promise<void>;

  // Actions - Clinical Records
  fetchNursingRecords: (admissionId: string) => Promise<void>;
  addNursingRecord: (record: Partial<NursingCareRecord>) => Promise<void>;
  fetchWardRounds: (admissionId: string) => Promise<void>;
  addWardRound: (round: Partial<WardRound>) => Promise<void>;

  // Utility
  calculateOccupancy: () => void;
  reset: () => void;
}

const initialState = {
  wards: [],
  beds: [],
  admissions: [],
  activeAdmissions: [],
  bedAllocations: [],
  nursingRecords: [],
  wardRounds: [],
  isLoading: false,
  isAdmitting: false,
  isDischarging: false,
  isTransferring: false,
  totalBeds: 0,
  occupiedBeds: 0,
  availableBeds: 0,
  occupancyRate: 0,
};

export const useInpatientStore = create<InpatientStore>((set, get) => ({
  ...initialState,

  // Ward Management
  fetchWards: async (practiceId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('ward_name');

      if (error) throw error;
      set({ wards: data || [] });
      get().calculateOccupancy();
    } catch (error: any) {
      console.error('❌ Error fetching wards:', error);
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      toast.error(`Failed to load wards: ${error?.message || 'Unknown error'}`);
    } finally {
      set({ isLoading: false });
    }
  },

  createWard: async (wardData: Partial<HospitalWard>) => {
    try {
      const { data, error } = await supabase
        .from('wards')
        .insert([wardData])
        .select()
        .single();

      if (error) throw error;

      set(state => ({
        wards: [...state.wards, data]
      }));

      toast.success('Ward created successfully');
      return data;
    } catch (error) {
      console.error('Error creating ward:', error);
      toast.error('Failed to create ward');
      return null;
    }
  },

  updateWard: async (wardId: string, updates: Partial<HospitalWard>) => {
    try {
      const { error } = await supabase
        .from('wards')
        .update(updates)
        .eq('id', wardId);

      if (error) throw error;

      set(state => ({
        wards: state.wards.map(w => w.id === wardId ? { ...w, ...updates } : w)
      }));

      toast.success('Ward updated successfully');
    } catch (error) {
      console.error('Error updating ward:', error);
      toast.error('Failed to update ward');
    }
  },

  // Bed Management
  fetchBeds: async (wardId?: string) => {
    set({ isLoading: true });
    try {
      let query = supabase
        .from('beds')
        .select(`
          *,
          room:rooms!inner(
            id,
            room_number,
            ward:wards!inner(id, ward_name, ward_type)
          )
        `)
        .eq('is_active', true);

      if (wardId) {
        query = query.eq('room.ward_id', wardId);
      }

      const { data: beds, error: bedsError} = await query.order('bed_number');
      if (bedsError) throw bedsError;

      // Fetch current allocations to get patient info
      const { data: allocations, error: allocError } = await supabase
        .from('bed_allocations')
        .select(`
          *,
          patient:patients(id, first_name, last_name),
          admission:patient_admissions(admission_number)
        `)
        .eq('is_current', true);

      if (allocError) throw allocError;

      // Map patient info to occupied beds
      const bedsWithPatients = beds?.map(bed => {
        const allocation = allocations?.find(a => a.bed_id === bed.id);
        if (allocation) {
          return {
            ...bed,
            current_patient: {
              id: allocation.patient.id,
              first_name: allocation.patient.first_name,
              last_name: allocation.patient.last_name,
              admission_number: allocation.admission.admission_number
            }
          };
        }
        return bed;
      });

      set({ beds: bedsWithPatients || [] });
      get().calculateOccupancy();
    } catch (error) {
      console.error('Error fetching beds:', error);
      toast.error('Failed to load beds');
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAllBedsWithStatus: async (practiceId: string) => {
    set({ isLoading: true });
    try {
      // First fetch all wards for this practice
      const { data: wards, error: wardsError } = await supabase
        .from('wards')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('is_active', true);

      if (wardsError) throw wardsError;

      const wardIds = wards?.map(w => w.id) || [];

      // Fetch all beds for these wards
      const { data: beds, error: bedsError } = await supabase
        .from('beds')
        .select(`
          *,
          ward:wards(id, ward_name, ward_type)
        `)
        .in('ward_id', wardIds)
        .eq('is_active', true)
        .order('ward_id, bed_number');

      if (bedsError) throw bedsError;

      // Fetch current allocations
      const { data: allocations, error: allocError } = await supabase
        .from('bed_allocations')
        .select(`
          *,
          patient:patients(id, first_name, last_name),
          admission:patient_admissions(admission_number)
        `)
        .eq('is_current', true);

      if (allocError) throw allocError;

      // Map patient info to occupied beds
      const bedsWithPatients = beds?.map(bed => {
        const allocation = allocations?.find(a => a.bed_id === bed.id);
        if (allocation) {
          return {
            ...bed,
            current_patient: {
              id: allocation.patient.id,
              first_name: allocation.patient.first_name,
              last_name: allocation.patient.last_name,
              admission_number: allocation.admission.admission_number
            }
          };
        }
        return bed;
      });

      set({ beds: bedsWithPatients || [] });
      get().calculateOccupancy();
    } catch (error: any) {
      console.error('❌ Error fetching beds:', error);
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      toast.error(`Failed to load bed status: ${error?.message || 'Unknown error'}`);
    } finally {
      set({ isLoading: false });
    }
  },

  updateBedStatus: async (bedId: string, status: WardBed['status']) => {
    try {
      const { error } = await supabase
        .from('beds')
        .update({ bed_status: status, updated_at: new Date().toISOString() })
        .eq('id', bedId);

      if (error) throw error;

      set(state => ({
        beds: state.beds.map(b => b.id === bedId ? { ...b, bed_status: status, status } : b)
      }));

      toast.success('Bed status updated');
      get().calculateOccupancy();
    } catch (error) {
      console.error('Error updating bed status:', error);
      toast.error('Failed to update bed status');
    }
  },

  getAvailableBeds: (wardType?: string) => {
    const { beds } = get();
    return beds.filter(bed => {
      const isAvailable = (bed.bed_status === 'available' || bed.status === 'available') && bed.is_active;
      if (!wardType) return isAvailable;
      return isAvailable && bed.ward?.ward_type === wardType;
    });
  },

  // Admission Management
  fetchAdmissions: async (practiceId: string, status = 'active' as 'active' | 'all') => {
    set({ isLoading: true });
    try {
      let query = supabase
        .from('patient_admissions')
        .select(`
          *,
          patient:patients(id, first_name, last_name, date_of_birth, gender),
          attending_doctor:users!patient_admissions_attending_doctor_id_fkey(id, full_name)
        `)
        .eq('practice_id', practiceId);

      if (status === 'active') {
        query = query.eq('admission_status', 'active');
      }

      const { data: admissions, error: admissionsError } = await query.order('admission_date', { ascending: false });

      if (admissionsError) throw admissionsError;

      // Fetch current bed allocations separately (using beds table)
      const { data: allocations, error: allocationsError } = await supabase
        .from('bed_allocations')
        .select(`
          admission_id,
          bed_id,
          bed:beds(bed_number, room:rooms(room_number), ward:wards(ward_name))
        `)
        .eq('is_current', true);

      if (allocationsError) throw allocationsError;

      // Transform data to include current bed info
      const admissionsWithBeds = admissions?.map(admission => {
        const allocation = allocations?.find(a => a.admission_id === admission.id);
        return {
          ...admission,
          current_bed: allocation ? {
            bed_id: allocation.bed_id,
            bed_number: allocation.bed?.bed_number,
            room_number: allocation.bed?.room?.room_number,
            ward_name: allocation.bed?.ward?.ward_name
          } : undefined
        };
      });

      if (status === 'active') {
        set({ activeAdmissions: admissionsWithBeds || [] });
      }
      set({ admissions: admissionsWithBeds || [] });
    } catch (error: any) {
      console.error('❌ Error fetching admissions:', error);
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      toast.error(`Failed to load admissions: ${error?.message || 'Unknown error'}`);
    } finally {
      set({ isLoading: false });
    }
  },

  admitPatient: async (admissionData: Partial<PatientAdmission>) => {
    set({ isAdmitting: true });
    try {
      // Create admission record (admission_number will be auto-generated by trigger)
      const { data: admission, error: admissionError } = await supabase
        .from('patient_admissions')
        .insert([{
          ...admissionData,
          admission_status: 'active',
          admission_date: admissionData.admission_date || new Date().toISOString()
        }])
        .select()
        .single();

      if (admissionError) throw admissionError;

      // If a bed was selected, create bed allocation
      if (admissionData.current_bed?.bed_id) {
        const { error: allocationError } = await supabase
          .from('bed_allocations')
          .insert([{
            admission_id: admission.id,
            bed_id: admissionData.current_bed.bed_id,
            patient_id: admission.patient_id,
            ward_id: admissionData.current_bed.ward_id,
            is_current: true
          }]);

        if (allocationError) throw allocationError;
      }

      // Create or update visit record if provided
      if (admissionData.visit_id) {
        const { error: visitError } = await supabase
          .from('visits')
          .update({
            admission_id: admission.id,
            visit_category: 'inpatient'
          })
          .eq('id', admissionData.visit_id);

        if (visitError) throw visitError;
      }

      set(state => ({
        admissions: [admission, ...state.admissions],
        activeAdmissions: [admission, ...state.activeAdmissions]
      }));

      toast.success(`Patient admitted successfully. Admission #${admission.admission_number}`);
      return admission;
    } catch (error) {
      console.error('Error admitting patient:', error);
      toast.error('Failed to admit patient');
      return null;
    } finally {
      set({ isAdmitting: false });
    }
  },

  dischargePatient: async (admissionId: string, dischargeData: any) => {
    set({ isDischarging: true });
    try {
      // Update admission record
      const { error: admissionError } = await supabase
        .from('patient_admissions')
        .update({
          admission_status: 'discharged',
          actual_discharge_date: new Date().toISOString(),
          discharge_type: dischargeData.discharge_type,
          discharge_disposition: dischargeData.discharge_disposition,
          discharge_instructions: dischargeData.discharge_instructions,
          follow_up_required: dischargeData.follow_up_required,
          follow_up_date: dischargeData.follow_up_date
        })
        .eq('id', admissionId);

      if (admissionError) throw admissionError;

      // Release bed allocation
      const { error: allocationError } = await supabase
        .from('bed_allocations')
        .update({
          is_current: false,
          released_at: new Date().toISOString(),
          transfer_reason: 'discharge'
        })
        .eq('admission_id', admissionId)
        .eq('is_current', true);

      if (allocationError) throw allocationError;

      // Update state
      set(state => ({
        activeAdmissions: state.activeAdmissions.filter(a => a.id !== admissionId),
        admissions: state.admissions.map(a =>
          a.id === admissionId
            ? { ...a, admission_status: 'discharged' as const, actual_discharge_date: new Date().toISOString() }
            : a
        )
      }));

      toast.success('Patient discharged successfully');
    } catch (error) {
      console.error('Error discharging patient:', error);
      toast.error('Failed to discharge patient');
    } finally {
      set({ isDischarging: false });
    }
  },

  updateAdmission: async (admissionId: string, updates: Partial<PatientAdmission>) => {
    try {
      const { error } = await supabase
        .from('patient_admissions')
        .update(updates)
        .eq('id', admissionId);

      if (error) throw error;

      set(state => ({
        admissions: state.admissions.map(a => a.id === admissionId ? { ...a, ...updates } : a),
        activeAdmissions: state.activeAdmissions.map(a => a.id === admissionId ? { ...a, ...updates } : a)
      }));

      toast.success('Admission updated');
    } catch (error) {
      console.error('Error updating admission:', error);
      toast.error('Failed to update admission');
    }
  },

  // Bed Allocation
  allocateBed: async (admissionId: string, bedId: string, notes?: string) => {
    set({ isTransferring: true });
    try {
      // Get ward_id from bed
      const { data: bed, error: bedError } = await supabase
        .from('beds')
        .select('ward_id')
        .eq('id', bedId)
        .single();

      if (bedError) throw bedError;

      // Get patient_id from admission
      const { data: admission, error: admissionError } = await supabase
        .from('patient_admissions')
        .select('patient_id')
        .eq('id', admissionId)
        .single();

      if (admissionError) throw admissionError;

      // Create new allocation
      const { error: allocationError } = await supabase
        .from('bed_allocations')
        .insert([{
          admission_id: admissionId,
          bed_id: bedId,
          patient_id: admission.patient_id,
          ward_id: bed.ward_id,
          is_current: true,
          notes
        }]);

      if (allocationError) throw allocationError;

      toast.success('Bed allocated successfully');
      await get().fetchBeds();
    } catch (error) {
      console.error('Error allocating bed:', error);
      toast.error('Failed to allocate bed');
    } finally {
      set({ isTransferring: false });
    }
  },

  transferBed: async (admissionId: string, newBedId: string, reason: string) => {
    set({ isTransferring: true });
    try {
      // Release current bed
      const { error: releaseError } = await supabase
        .from('bed_allocations')
        .update({
          is_current: false,
          released_at: new Date().toISOString(),
          transfer_reason: 'bed_availability'
        })
        .eq('admission_id', admissionId)
        .eq('is_current', true);

      if (releaseError) throw releaseError;

      // Allocate new bed
      await get().allocateBed(admissionId, newBedId, `Transfer reason: ${reason}`);

      // Record transfer in history
      // TODO: Implement bed_transfer_history if needed

      toast.success('Patient transferred successfully');
    } catch (error) {
      console.error('Error transferring bed:', error);
      toast.error('Failed to transfer patient');
    } finally {
      set({ isTransferring: false });
    }
  },

  releaseBed: async (allocationId: string) => {
    try {
      const { error } = await supabase
        .from('bed_allocations')
        .update({
          is_current: false,
          released_at: new Date().toISOString()
        })
        .eq('id', allocationId);

      if (error) throw error;

      await get().fetchBeds();
      toast.success('Bed released');
    } catch (error) {
      console.error('Error releasing bed:', error);
      toast.error('Failed to release bed');
    }
  },

  // Clinical Records
  fetchNursingRecords: async (admissionId: string) => {
    try {
      const { data, error } = await supabase
        .from('nursing_care_records')
        .select(`
          *,
          nurse:users(id, full_name)
        `)
        .eq('admission_id', admissionId)
        .order('shift_start_time', { ascending: false });

      if (error) throw error;
      set({ nursingRecords: data || [] });
    } catch (error) {
      console.error('Error fetching nursing records:', error);
      toast.error('Failed to load nursing records');
    }
  },

  addNursingRecord: async (record: Partial<NursingCareRecord>) => {
    try {
      const { data, error } = await supabase
        .from('nursing_care_records')
        .insert([record])
        .select()
        .single();

      if (error) throw error;

      set(state => ({
        nursingRecords: [data, ...state.nursingRecords]
      }));

      toast.success('Nursing record added');
    } catch (error) {
      console.error('Error adding nursing record:', error);
      toast.error('Failed to add nursing record');
    }
  },

  fetchWardRounds: async (admissionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ward_rounds')
        .select(`
          *,
          doctor:users(id, full_name)
        `)
        .eq('admission_id', admissionId)
        .order('round_datetime', { ascending: false });

      if (error) throw error;
      set({ wardRounds: data || [] });
    } catch (error) {
      console.error('Error fetching ward rounds:', error);
      toast.error('Failed to load ward rounds');
    }
  },

  addWardRound: async (round: Partial<WardRound>) => {
    try {
      const { data, error } = await supabase
        .from('ward_rounds')
        .insert([round])
        .select()
        .single();

      if (error) throw error;

      set(state => ({
        wardRounds: [data, ...state.wardRounds]
      }));

      toast.success('Ward round documented');
    } catch (error) {
      console.error('Error adding ward round:', error);
      toast.error('Failed to add ward round');
    }
  },

  // Utility
  calculateOccupancy: () => {
    const { beds, wards } = get();

    // If beds table has data, use it
    if (beds.length > 0) {
      const totalBeds = beds.length;
      const occupiedBeds = beds.filter(b => b.bed_status === 'occupied' || b.status === 'occupied').length;
      const availableBeds = beds.filter(b => b.bed_status === 'available' || b.status === 'available').length;
      const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

      set({
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate
      });
    } else {
      // Fallback: Use ward aggregate counters when beds table is empty
      const totalBeds = wards.reduce((sum, ward) => sum + (ward.capacity || 0), 0);
      const occupiedBeds = wards.reduce((sum, ward) => sum + (ward.current_occupancy || 0), 0);
      const availableBeds = totalBeds - occupiedBeds;
      const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

      set({
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate
      });
    }
  },

  reset: () => {
    set(initialState);
  }
}));