import { create } from 'zustand';
import { Appointment } from './patientsStore';

interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  fetchAppointments: () => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  getAverageWaitTime: () => number;
}

// Mock data
const mockAppointments: Appointment[] = [
  {
    id: 'a1',
    patientId: '1',
    doctorId: 'd1',
    doctorName: 'Dr. Jane Smith',
    date: new Date().toISOString().split('T')[0],
    time: '10:30',
    duration: 30,
    type: 'follow-up',
    status: 'scheduled',
    checkInTime: '10:25',
    estimatedWaitTime: 15,
  },
  {
    id: 'a2',
    patientId: '3',
    doctorId: 'd1',
    doctorName: 'Dr. Jane Smith',
    date: new Date().toISOString().split('T')[0],
    time: '14:15',
    duration: 45,
    type: 'check-up',
    status: 'in-progress',
    checkInTime: '14:10',
    estimatedWaitTime: 0,
  },
  {
    id: 'a3',
    patientId: '2',
    doctorId: 'd2',
    doctorName: 'Dr. Michael Chen',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 60,
    type: 'consultation',
    status: 'completed',
    notes: 'Patient discussed ongoing migraine issues. Adjusted medication.',
    checkInTime: '08:55',
    estimatedWaitTime: 0,
  },
  {
    id: 'a4',
    patientId: '1',
    doctorId: 'd1',
    doctorName: 'Dr. Jane Smith',
    date: new Date().toISOString().split('T')[0],
    time: '11:45',
    duration: 30,
    type: 'follow-up',
    status: 'scheduled',
    checkInTime: '11:40',
    estimatedWaitTime: 25,
  },
  {
    id: 'a5',
    patientId: '3',
    doctorId: 'd3',
    doctorName: 'Dr. Sarah Johnson',
    date: new Date().toISOString().split('T')[0],
    time: '13:30',
    duration: 45,
    type: 'consultation',
    status: 'scheduled',
    checkInTime: '13:25',
    estimatedWaitTime: 20,
  },
];

export const useAppointmentsStore = create<AppointmentsState>((set, get) => ({
  appointments: mockAppointments,
  isLoading: false,
  error: null,
  fetchAppointments: async () => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, this would be an API call
      set({ appointments: mockAppointments, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch appointments', isLoading: false });
    }
  },
  addAppointment: async (appointment) => {
    set({ isLoading: true, error: null });
    try {
      const newAppointment = {
        ...appointment,
        id: Math.random().toString(36).substring(2, 11),
      } as Appointment;
      
      set(state => ({
        appointments: [...state.appointments, newAppointment],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to add appointment', isLoading: false });
    }
  },
  updateAppointment: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      set(state => ({
        appointments: state.appointments.map(appointment =>
          appointment.id === id ? { ...appointment, ...updates } : appointment
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to update appointment', isLoading: false });
    }
  },
  cancelAppointment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      set(state => ({
        appointments: state.appointments.map(appointment =>
          appointment.id === id ? { ...appointment, status: 'cancelled' } : appointment
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to cancel appointment', isLoading: false });
    }
  },
  getAverageWaitTime: () => {
    const appointments = get().appointments;
    const waitTimes = appointments
      .filter(app => app.estimatedWaitTime && app.estimatedWaitTime > 0)
      .map(app => app.estimatedWaitTime);
    
    if (waitTimes.length === 0) return 0;
    return Math.round(waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length);
  },
}));