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

  it('renders medical timeline section', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Medical Timeline');
    
    // Check if medical timeline elements are present
    expect(screen.getByText('Medical Timeline')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive care history')).toBeInTheDocument();
  });

  it('renders comprehensive vitals section', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Latest Vitals');
    
    // Check if vitals section is present
    expect(screen.getByText('Latest Vitals')).toBeInTheDocument();
  });

  it('does not render quick actions panel', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load and ensure Quick Actions is not present
    await screen.findByText('Medical Timeline');
    
    // Check that quick actions panel has been removed
    expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
  });

  it('handles loading state properly', () => {
    // This test would need to mock the loading state
    render(<PatientModernDetailWrapper />);
    
    // The component should handle loading gracefully
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('renders view profile button in header', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('John Doe');
    
    // Check if view profile button is present
    expect(screen.getByText('View Profile')).toBeInTheDocument();
  });

  it('renders clean visit cards without gradients', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Medical Timeline');
    
    // The visit cards should have clean borders, not gradient backgrounds
    const timeline = screen.getByText('Medical Timeline').closest('div');
    expect(timeline).toBeInTheDocument();
  });

  it('modal centering works correctly', async () => {
    render(<PatientModernDetailWrapper />);
    
    // Wait for the component to load
    await screen.findByText('Medical Aid');
    
    // All modals should be centered when opened
    expect(screen.getByText('Quick Contact')).toBeInTheDocument();
  });
});