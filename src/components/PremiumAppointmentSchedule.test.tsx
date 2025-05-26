import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import PremiumAppointmentSchedule from './PremiumAppointmentSchedule';
import type { Appointment } from './PremiumAppointmentSchedule';

describe('PremiumAppointmentSchedule', () => {
  const mockOnDateChange = vi.fn();
  const mockOnUpdateAppointment = vi.fn();
  const mockOnView = vi.fn();
  const mockOnCreateAppointment = vi.fn();

  const mockAppointments: Appointment[] = [
    {
      id: '1',
      patient_id: 'p1',
      doctor_id: 'd1',
      date: '2025-05-25',
      time: '09:00',
      duration: 30,
      type: 'consultation',
      status: 'scheduled',
      patient: {
        id: 'p1',
        first_name: 'John',
        last_name: 'Doe'
      },
      doctor: {
        id: 'd1',
        full_name: 'Dr. Smith'
      }
    },
    {
      id: '2',
      patient_id: 'p2',
      doctor_id: 'd1',
      date: '2025-05-25',
      time: '09:30',
      duration: 30,
      type: 'follow-up',
      status: 'confirmed',
      patient: {
        id: 'p2',
        first_name: 'Jane',
        last_name: 'Smith'
      },
      doctor: {
        id: 'd1',
        full_name: 'Dr. Smith'
      }
    },
    // Overlapping appointment to test conflict detection
    {
      id: '3',
      patient_id: 'p3',
      doctor_id: 'd1',
      date: '2025-05-25',
      time: '09:15',
      duration: 30,
      type: 'consultation',
      status: 'scheduled',
      patient: {
        id: 'p3',
        first_name: 'Bob',
        last_name: 'Johnson'
      },
      doctor: {
        id: 'd1',
        full_name: 'Dr. Smith'
      }
    }
  ];

  const defaultProps = {
    date: new Date('2025-05-25'),
    appointments: mockAppointments,
    isLoading: false,
    error: null,
    onDateChange: mockOnDateChange,
    onUpdateAppointment: mockOnUpdateAppointment,
    onView: mockOnView,
    onCreateAppointment: mockOnCreateAppointment
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PremiumAppointmentSchedule {...defaultProps} />);
    expect(screen.getByText(/Schedule/)).toBeInTheDocument();
  });

  it('displays appointments for the selected date', () => {
    render(<PremiumAppointmentSchedule {...defaultProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<PremiumAppointmentSchedule {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading appointments...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const errorMessage = 'Failed to load appointments';
    render(<PremiumAppointmentSchedule {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('filters appointments by selected date', () => {
    const differentDateAppointments = [
      ...mockAppointments,
      {
        id: '4',
        patient_id: 'p4',
        doctor_id: 'd1',
        date: '2025-05-26', // Different date
        time: '10:00',
        duration: 30,
        type: 'consultation',
        status: 'scheduled' as const,
        patient: {
          id: 'p4',
          first_name: 'Alice',
          last_name: 'Williams'
        },
        doctor: {
          id: 'd1',
          full_name: 'Dr. Smith'
        }
      }
    ];

    render(
      <PremiumAppointmentSchedule
        {...defaultProps}
        appointments={differentDateAppointments}
      />
    );

    // Should show appointments for the selected date
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    
    // Should not show appointment from different date
    expect(screen.queryByText('Alice Williams')).not.toBeInTheDocument();
  });

  it('calculates appointment statistics correctly', () => {
    render(<PremiumAppointmentSchedule {...defaultProps} />);
    
    // Check if statistics are displayed (based on the mock data)
    // 2 scheduled, 1 confirmed, 0 completed
    const totalStat = screen.getByText('3'); // Total appointments
    expect(totalStat).toBeInTheDocument();
  });

  it('handles overlapping appointments correctly', () => {
    // The component should detect that appointments 1 and 3 overlap
    // and adjust their display accordingly
    render(<PremiumAppointmentSchedule {...defaultProps} />);
    
    // This is a visual test - we're checking that the component renders
    // without errors when appointments overlap
    const appointmentElements = screen.getAllByTestId(/appointment-/);
    expect(appointmentElements.length).toBe(3);
  });

  it('processes appointments with correct time calculations', () => {
    // Test that appointments are positioned correctly based on time
    render(<PremiumAppointmentSchedule {...defaultProps} />);
    
    // Check that time slots are rendered
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('9:30 AM')).toBeInTheDocument();
  });
});