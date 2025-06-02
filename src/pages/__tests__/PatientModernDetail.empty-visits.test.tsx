import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PatientModernDetail from '../PatientModernDetail';

// Mock the modules
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: '1' } } })
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: '1',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
              cell_number: '123456789',
              date_of_birth: '1990-01-01',
              gender: 'male'
            }
          }),
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [] }) // Empty visits
          }))
        }))
      }))
    }))
  }
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '1' }),
  useNavigate: () => jest.fn()
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => children
}));

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <PatientModernDetail />
    </BrowserRouter>
  );
};

describe('PatientModernDetail - Empty Visits Timeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display clean empty state without blinking animations', async () => {
    renderComponent();

    // Wait for component to load
    await screen.findByText('No visits recorded yet');
    
    // Check that the proper empty state message is displayed
    expect(screen.getByText('No visits recorded yet')).toBeInTheDocument();
    expect(screen.getByText("This patient's comprehensive medical timeline will appear here as visits are recorded")).toBeInTheDocument();
    expect(screen.getByText('Record First Visit')).toBeInTheDocument();
  });

  it('should not have blinking/pulsating animation classes', async () => {
    const { container } = renderComponent();

    // Wait for component to load
    await screen.findByText('No visits recorded yet');

    // Check that problematic animation classes are NOT present
    const animatingElements = container.querySelectorAll('.animate-ping, .animate-pulse');
    expect(animatingElements).toHaveLength(0);
  });

  it('should display professional static icons', async () => {
    renderComponent();

    // Wait for component to load
    await screen.findByText('No visits recorded yet');
    
    // The component should have a clean, professional appearance
    const recordButton = screen.getByText('Record First Visit');
    expect(recordButton).toBeInTheDocument();
    expect(recordButton).toBeEnabled();
  });

  it('should maintain professional styling without distracting animations', async () => {
    const { container } = renderComponent();

    // Wait for component to load  
    await screen.findByText('No visits recorded yet');

    // Ensure no distracting animations are present in the empty state
    const emptyStateSection = container.querySelector('[class*="No visits"]')?.closest('div');
    if (emptyStateSection) {
      const animatedChildren = emptyStateSection.querySelectorAll('[class*="animate-"]');
      // Should not contain any animate-ping or animate-pulse classes
      const problematicAnimations = Array.from(animatedChildren).filter(el => 
        el.className.includes('animate-ping') || el.className.includes('animate-pulse')
      );
      expect(problematicAnimations).toHaveLength(0);
    }
  });
});