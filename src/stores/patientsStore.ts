import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { practiceDataService } from '../lib/practiceDataService';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  idNumber: string; // National ID number
  gender: 'male' | 'female' | 'other';
  email: string;
  phone: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  medicalAidDetails?: {
    provider: string;
    scheme: string;
    membershipNumber: string;
    planType: string;
    mainMember: {
      name: string;
      idNumber: string;
      relationship: string;
    };
    dependentCode?: string;
  };
  medicalHistory: MedicalRecord[];
  upcomingAppointments: Appointment[];
  chronicConditions: string[];
  allergies: string[];
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  occupation?: string;
  employer?: string;
  referralSource?: string;
  preferredLanguage: 'English' | 'Afrikaans' | 'Oshiwambo' | 'Other';
  avatar?: string;
}

export interface MedicalRecord {
  id: string;
  date: string;
  type: 'consultation' | 'procedure' | 'prescription' | 'lab' | 'referral' | 'sick-note';
  title: string;
  description: string;
  doctor: string;
  icd10Code?: string;
  nappi?: string;
  attachments?: { name: string; url: string }[];
  vitals?: {
    bloodPressure?: string;
    temperature?: number;
    pulseRate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  billingCode?: string;
  followUp?: {
    required: boolean;
    date?: string;
    notes?: string;
  };
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  checkInTime?: string;
  estimatedWaitTime?: number;
  paymentStatus?: 'medical-aid' | 'cash' | 'pending' | 'completed';
  referralRequired?: boolean;
  referralDetails?: {
    referringDoctor: string;
    practice: string;
    referralDate: string;
    referralNumber: string;
  };
}

interface PatientsState {
  patients: Patient[];
  isLoading: boolean;
  error: string | null;
  fetchPatients: () => Promise<void>;
  getPatientById: (id: string) => Patient | undefined;
  addPatient: (patient: Omit<Patient, 'id'>) => Promise<void>;
  updatePatient: (id: string, patient: Partial<Patient>) => Promise<void>;
}

/** The patients columns this store reads (all present in src/types/database.types.ts). */
export const PATIENT_STORE_COLUMNS =
  'id, first_name, last_name, date_of_birth, id_number, gender, email, cell_number, home_address, occupation, employer, home_language';

export interface PatientStoreRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  id_number: string | null;
  gender: string | null;
  email: string | null;
  cell_number: string | null;
  home_address: string | null;
  occupation: string | null;
  employer: string | null;
  home_language: string | null;
}

const LANGUAGES: Patient['preferredLanguage'][] = ['English', 'Afrikaans', 'Oshiwambo'];

/**
 * Maps a patients row to this store's Patient shape. Fields the table doesn't hold (history,
 * appointments, conditions, emergency contact) start empty rather than being made up.
 */
export function toStorePatient(row: PatientStoreRow): Patient {
  const gender = (row.gender || '').trim().toLowerCase();
  const language = LANGUAGES.find(
    (name) => name.toLowerCase() === (row.home_language || '').trim().toLowerCase()
  );
  return {
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    dateOfBirth: row.date_of_birth || '',
    idNumber: row.id_number || '',
    gender: gender.startsWith('f') ? 'female' : gender.startsWith('m') ? 'male' : 'other',
    email: row.email || '',
    phone: row.cell_number || '',
    address: row.home_address || '',
    emergencyContact: { name: '', relationship: '', phone: '' },
    medicalHistory: [],
    upcomingAppointments: [],
    chronicConditions: [],
    allergies: [],
    occupation: row.occupation || undefined,
    employer: row.employer || undefined,
    preferredLanguage: language || 'Other'
  };
}

// This store used to hold two invented patients with made-up phone numbers, which the message
// composer offered as recipients. It now starts empty and loads the practice's real patients.
export const usePatientsStore = create<PatientsState>((set, get) => ({
  patients: [],
  isLoading: false,
  error: null,
  fetchPatients: async () => {
    set({ isLoading: true, error: null });
    try {
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext?.practiceId) {
        set({ patients: [], isLoading: false, error: 'No practice selected, so no patients can be listed.' });
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select(PATIENT_STORE_COLUMNS)
        .eq('practice_id', authContext.practiceId)
        .order('last_name', { ascending: true });
      if (error) throw error;
      set({ patients: ((data || []) as PatientStoreRow[]).map(toStorePatient), isLoading: false });
    } catch (error) {
      console.error('Error fetching patients:', error);
      set({ error: 'Failed to fetch patients', isLoading: false });
    }
  },
  getPatientById: (id: string) => {
    return get().patients.find(patient => patient.id === id);
  },
  addPatient: async (patient) => {
    set({ isLoading: true, error: null });
    try {
      const newPatient = {
        ...patient,
        id: Math.random().toString(36).substring(2, 11),
      } as Patient;
      set(state => ({ 
        patients: [...state.patients, newPatient],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to add patient', isLoading: false });
    }
  },
  updatePatient: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      set(state => ({
        patients: state.patients.map(patient =>
          patient.id === id ? { ...patient, ...updates } : patient
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to update patient', isLoading: false });
    }
  },
}));