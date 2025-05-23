import { create } from 'zustand';

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

// Mock data
const mockPatients: Patient[] = [
  {
    id: '1',
    firstName: 'Johannes',
    lastName: 'van der Merwe',
    dateOfBirth: '1980-05-15',
    idNumber: '8005155012087',
    gender: 'male',
    email: 'johannes.vdm@example.com',
    phone: '081 123 4567',
    address: '123 Mandume Ndemufayo Street, Windhoek, Namibia',
    emergencyContact: {
      name: 'Maria van der Merwe',
      relationship: 'Spouse',
      phone: '081 765 4321'
    },
    medicalAidDetails: {
      provider: 'Namibia Medical Care',
      scheme: 'Diamond',
      membershipNumber: 'NMC123456',
      planType: 'Comprehensive',
      mainMember: {
        name: 'Johannes van der Merwe',
        idNumber: '8005155012087',
        relationship: 'Self'
      }
    },
    medicalHistory: [
      {
        id: 'm1',
        date: '2023-02-10',
        type: 'consultation',
        title: 'Annual Check-up',
        description: 'Patient is in good health. BP: 120/80, HR: 72, Temp: 36.6°C',
        doctor: 'Dr. Sarah Nkosi',
        icd10Code: 'Z00.00',
        vitals: {
          bloodPressure: '120/80',
          temperature: 36.6,
          pulseRate: 72,
          weight: 82,
          height: 178,
          bmi: 25.9
        }
      }
    ],
    upcomingAppointments: [],
    chronicConditions: ['Hypertension'],
    allergies: ['Penicillin'],
    bloodType: 'O+',
    occupation: 'Teacher',
    employer: 'Ministry of Education',
    preferredLanguage: 'Afrikaans',
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200'
  },
  {
    id: '2',
    firstName: 'Precious',
    lastName: 'Namupala',
    dateOfBirth: '1992-08-21',
    idNumber: '9208210123456',
    gender: 'female',
    email: 'precious.n@example.com',
    phone: '081 234 5678',
    address: '456 Independence Avenue, Windhoek, Namibia',
    emergencyContact: {
      name: 'Thomas Namupala',
      relationship: 'Father',
      phone: '081 876 5432'
    },
    medicalAidDetails: {
      provider: 'Discovery Health',
      scheme: 'Coastal Core',
      membershipNumber: 'DH789012',
      planType: 'Standard',
      mainMember: {
        name: 'Precious Namupala',
        idNumber: '9208210123456',
        relationship: 'Self'
      }
    },
    medicalHistory: [],
    upcomingAppointments: [],
    chronicConditions: [],
    allergies: [],
    occupation: 'Software Developer',
    employer: 'Tech Solutions Namibia',
    preferredLanguage: 'English',
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200'
  }
];

export const usePatientsStore = create<PatientsState>((set, get) => ({
  patients: mockPatients,
  isLoading: false,
  error: null,
  fetchPatients: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ patients: mockPatients, isLoading: false });
    } catch (error) {
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