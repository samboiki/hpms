import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PatientModernDetail from '../PatientModernDetail';

// Mock the hooks and modules
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-patient-id' }),
    useNavigate: () => vi.fn()
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              id: 'test-patient-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john.doe@example.com',
              cell_number: '+1234567890',
              date_of_birth: '1990-01-01',
              gender: 'Male'
            },
            error: null
          })),
          order: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>
  }
}));

const PatientModernDetailWrapper = () => (
  <BrowserRouter>
    <PatientModernDetail />
  </BrowserRouter>
);

describe('PatientModernDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders premium medical aid card', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Medical Aid');
    
    // Check if premium elements are present
    expect(screen.getByText('Medical Aid')).toBeInTheDocument();
    expect(screen.getByText('Insurance Coverage')).toBeInTheDocument();
  });

  it('renders premium next of kin card', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Next of Kin');
    
    // Check if premium elements are present
    expect(screen.getByText('Next of Kin')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
  });

  it('renders doctor appointment management dashboard', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Appointments Today');
    
    // Check if appointment management elements are present
    expect(screen.getByText('Appointments Today')).toBeInTheDocument();
    expect(screen.getByText('Live Queue Management')).toBeInTheDocument();
    expect(screen.getByText('Start Next Visit')).toBeInTheDocument();
  });

  it('renders visit history section', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Visit History');
    
    // Check if visit history elements are present
    expect(screen.getByText('Visit History')).toBeInTheDocument();
  });

  it('handles loading state properly', () => {
    // This test would need to mock the loading state
    render(<PatientModernDetailWrapper />);
    
    // The component should handle loading gracefully
    expect(screen.getByRole('main')).toBeTruthy();
  });
});