import { create } from 'zustand';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  email: string;
  phone: string;
  address: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  medicalHistory: MedicalRecord[];
  upcomingAppointments: Appointment[];
  avatar?: string;
}

export interface MedicalRecord {
  id: string;
  date: string;
  type: 'visit' | 'diagnosis' | 'prescription' | 'lab' | 'immunization';
  title: string;
  description: string;
  doctor: string;
  attachments?: { name: string; url: string }[];
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: 'check-up' | 'follow-up' | 'consultation' | 'emergency';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
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
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1980-05-15',
    gender: 'male',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    address: '123 Main St, Anytown, CA 94321',
    insuranceProvider: 'Blue Cross',
    insuranceNumber: 'BC123456789',
    medicalHistory: [
      {
        id: 'm1',
        date: '2023-02-10',
        type: 'visit',
        title: 'Annual Physical',
        description: 'Patient is in good health. BP: 120/80, HR: 72, Temp: 98.6F',
        doctor: 'Dr. Jane Smith',
      },
      {
        id: 'm2',
        date: '2023-05-22',
        type: 'lab',
        title: 'Blood Work',
        description: 'CBC, CMP, Lipid Panel - All within normal ranges',
        doctor: 'Dr. Jane Smith',
        attachments: [
          { name: 'Blood Work Results.pdf', url: '#' },
        ],
      },
    ],
    upcomingAppointments: [
      {
        id: 'a1',
        patientId: '1',
        doctorId: 'd1',
        doctorName: 'Dr. Jane Smith',
        date: '2023-11-15',
        time: '10:30',
        duration: 30,
        type: 'follow-up',
        status: 'scheduled',
      },
    ],
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    dateOfBirth: '1992-08-21',
    gender: 'female',
    email: 'sarah.johnson@example.com',
    phone: '(555) 987-6543',
    address: '456 Oak Ave, Othertown, NY 10001',
    insuranceProvider: 'Aetna',
    insuranceNumber: 'AE987654321',
    medicalHistory: [
      {
        id: 'm3',
        date: '2023-03-05',
        type: 'diagnosis',
        title: 'Migraine',
        description: 'Patient reports frequent migraines. Prescribed sumatriptan 50mg.',
        doctor: 'Dr. Michael Chen',
      },
    ],
    upcomingAppointments: [],
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    id: '3',
    firstName: 'Robert',
    lastName: 'Williams',
    dateOfBirth: '1975-11-30',
    gender: 'male',
    email: 'robert.williams@example.com',
    phone: '(555) 456-7890',
    address: '789 Pine Dr, Somewhere, TX 75001',
    insuranceProvider: 'UnitedHealthcare',
    insuranceNumber: 'UH543216789',
    medicalHistory: [
      {
        id: 'm4',
        date: '2023-01-18',
        type: 'prescription',
        title: 'Hypertension Medication',
        description: 'Prescribed lisinopril 10mg daily for hypertension management.',
        doctor: 'Dr. Jane Smith',
      },
    ],
    upcomingAppointments: [
      {
        id: 'a2',
        patientId: '3',
        doctorId: 'd1',
        doctorName: 'Dr. Jane Smith',
        date: '2023-11-17',
        time: '14:15',
        duration: 45,
        type: 'check-up',
        status: 'confirmed',
      },
    ],
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
];

export const usePatientsStore = create<PatientsState>((set, get) => ({
  patients: mockPatients,
  isLoading: false,
  error: null,
  fetchPatients: async () => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, this would be an API call
      // For demo purposes, we're just using the mock data
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
      // In a real app, this would be an API call
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
      // In a real app, this would be an API call
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