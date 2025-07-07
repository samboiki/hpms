import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AddVisitTabs from '../AddVisitTabs';

// Mock the supabase client
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'test-visit-id' },
            error: null
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { practice_id: 'test-practice-id' },
            error: null
          }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null
      })),
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      }))
    }
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock child components
vi.mock('../../../services/invoiceService', () => ({
  invoiceService: {
    generateInvoiceFromVisit: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../../uploads/FileUploadComponent', () => ({
  default: () => <div data-testid="file-upload-component">File Upload Component</div>
}));

vi.mock('../../uploads/FileDisplayComponent', () => ({
  default: () => <div data-testid="file-display-component">File Display Component</div>
}));

vi.mock('../../uploads/MediaUploadWrapper', () => ({
  default: () => <div data-testid="media-upload-wrapper">Media Upload Wrapper</div>
}));

vi.mock('../../requests/LabResultsTable', () => ({
  default: () => <div data-testid="lab-results-table">Lab Results Table</div>
}));

vi.mock('../../requests/ImagingTabContentSimple', () => ({
  default: () => <div data-testid="imaging-tab-content">Imaging Tab Content</div>
}));

describe('AddVisitTabs', () => {
  const mockProps = {
    patientId: 'test-patient-id',
    activeTab: 'general',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    selectedServices: [],
    onSelectedServicesChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with default form values', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Check for main form elements
    expect(screen.getByText('Create Visit')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('displays general visit information tab by default', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should show general visit form fields
    expect(screen.getByDisplayValue('consultation')).toBeInTheDocument();
  });

  it('switches to lab results tab when activeTab is lab', () => {
    render(<AddVisitTabs {...mockProps} activeTab="lab" />);
    
    // Should show lab results table
    expect(screen.getByTestId('lab-results-table')).toBeInTheDocument();
  });

  it('switches to imaging tab when activeTab is imaging', () => {
    render(<AddVisitTabs {...mockProps} activeTab="imaging" />);
    
    // Should show imaging content
    expect(screen.getByTestId('imaging-tab-content')).toBeInTheDocument();
  });

  it('switches to media tab when activeTab is media', () => {
    render(<AddVisitTabs {...mockProps} activeTab="media" />);
    
    // Should show media upload components
    expect(screen.getByTestId('media-upload-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('file-display-component')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables create button during submission', async () => {
    render(<AddVisitTabs {...mockProps} />);
    
    const createButton = screen.getByText('Create Visit');
    fireEvent.click(createButton);
    
    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Creating Visit...')).toBeInTheDocument();
    });
  });

  it('shows correct button text for creating new visit', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should show "Create Visit" not "Update Visit"
    expect(screen.getByText('Create Visit')).toBeInTheDocument();
    expect(screen.queryByText('Update Visit')).not.toBeInTheDocument();
  });

  it('initializes with empty form for new visit', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Form should start with default values for new visit
    const chiefComplaintField = screen.getByPlaceholderText(/chief complaint/i);
    expect(chiefComplaintField).toHaveValue('');
  });

  it('calls onSuccess after successful visit creation', async () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Fill out required fields
    const chiefComplaintField = screen.getByPlaceholderText(/chief complaint/i);
    fireEvent.change(chiefComplaintField, { target: { value: 'Test complaint' } });
    
    const diagnosisField = screen.getByPlaceholderText(/diagnosis/i);
    fireEvent.change(diagnosisField, { target: { value: 'Test diagnosis' } });
    
    const createButton = screen.getByText('Create Visit');
    fireEvent.click(createButton);
    
    // Should call onSuccess after successful creation
    await waitFor(() => {
      expect(mockProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('handles visit type selection correctly', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should show visit type dropdown with default "consultation"
    expect(screen.getByDisplayValue('consultation')).toBeInTheDocument();
  });

  it('renders vitals section with input fields', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should show vitals input fields
    expect(screen.getByPlaceholderText(/weight/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/height/i)).toBeInTheDocument();
  });

  it('does not load existing visit data on mount', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should not attempt to load existing visit data since we're creating new
    // Form fields should be empty/default
    const notesField = screen.getByPlaceholderText(/notes/i);
    expect(notesField).toHaveValue('');
  });

  it('uses correct form id for new visit', () => {
    render(<AddVisitTabs {...mockProps} />);
    
    // Should use "add-visit-form" not "edit-visit-form"
    const form = document.getElementById('add-visit-form');
    expect(form).toBeInTheDocument();
    
    const editForm = document.getElementById('edit-visit-form');
    expect(editForm).not.toBeInTheDocument();
  });
});