import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VisualWorkflowBuilder from '../VisualWorkflowBuilder';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('VisualWorkflowBuilder', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the workflow builder modal', () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    expect(screen.getByText('Create Workflow')).toBeInTheDocument();
    expect(screen.getByText('Choose a Trigger')).toBeInTheDocument();
  });

  it('shows all trigger options in step 1', () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    expect(screen.getByText('Appointment Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Appointment Reminder')).toBeInTheDocument();
    expect(screen.getByText('Patient Birthday')).toBeInTheDocument();
    expect(screen.getByText('Visit Completed')).toBeInTheDocument();
    expect(screen.getByText('Payment Due')).toBeInTheDocument();
    expect(screen.getByText('Health Screening Due')).toBeInTheDocument();
  });

  it('advances to template selection when trigger is clicked', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Click appointment reminder trigger
    fireEvent.click(screen.getByText('Appointment Reminder'));
    
    await waitFor(() => {
      expect(screen.getByText('Select a Template')).toBeInTheDocument();
      expect(screen.getByText('What message should be sent?')).toBeInTheDocument();
    });
  });

  it('shows template options in step 2', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Go to step 2
    fireEvent.click(screen.getByText('Appointment Reminder'));
    
    await waitFor(() => {
      expect(screen.getByText('Appointment Reminder SMS')).toBeInTheDocument();
      expect(screen.getByText('Appointment Reminder Email')).toBeInTheDocument();
    });
  });

  it('advances to timing selection when template is clicked', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Go through steps
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    
    await waitFor(() => {
      expect(screen.getByText('Set Timing')).toBeInTheDocument();
      expect(screen.getByText('When should the message be sent?')).toBeInTheDocument();
    });
  });

  it('shows timing presets in step 3', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Navigate to timing step
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    
    await waitFor(() => {
      expect(screen.getByText('Immediately')).toBeInTheDocument();
      expect(screen.getByText('24 hours before')).toBeInTheDocument();
      expect(screen.getByText('2 hours before')).toBeInTheDocument();
      expect(screen.getByText('1 day after')).toBeInTheDocument();
    });
  });

  it('shows time picker for non-immediate timing', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Navigate to timing step
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    
    await waitFor(() => {
      expect(screen.getByText('Send at specific time (optional)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
    });
  });

  it('advances to review step when Continue is clicked', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Navigate through steps
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    await waitFor(() => screen.getByText('Set Timing'));
    fireEvent.click(screen.getByText('Continue'));
    
    await waitFor(() => {
      expect(screen.getByText('Review Your Workflow')).toBeInTheDocument();
      expect(screen.getByText('Everything look good?')).toBeInTheDocument();
    });
  });

  it('allows naming the workflow in review step', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Navigate to review
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    await waitFor(() => screen.getByText('Set Timing'));
    fireEvent.click(screen.getByText('Continue'));
    
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('e.g., 24 Hour Appointment Reminder');
      expect(nameInput).toBeInTheDocument();
      
      fireEvent.change(nameInput, { target: { value: 'My Test Workflow' } });
      expect(nameInput).toHaveValue('My Test Workflow');
    });
  });

  it('can navigate back through steps', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Go to review step
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    await waitFor(() => screen.getByText('Set Timing'));
    fireEvent.click(screen.getByText('Continue'));
    
    // Click back
    await waitFor(() => {
      fireEvent.click(screen.getByText('Back'));
    });
    
    // Should be back at timing step
    expect(screen.getByText('Set Timing')).toBeInTheDocument();
  });

  it('creates workflow when Create Workflow is clicked', async () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Navigate through all steps
    fireEvent.click(screen.getByText('Appointment Reminder'));
    await waitFor(() => screen.getByText('Select a Template'));
    fireEvent.click(screen.getByText('Appointment Reminder SMS'));
    await waitFor(() => screen.getByText('Set Timing'));
    fireEvent.click(screen.getByText('Continue'));
    
    // Fill in name and create
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('e.g., 24 Hour Appointment Reminder');
      fireEvent.change(nameInput, { target: { value: 'Test Workflow' } });
      
      fireEvent.click(screen.getByText('Create Workflow'));
    });
    
    // Should close modal
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when clicking outside', () => {
    const { container } = render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Click on backdrop
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when X button is clicked', () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows progress indicators for all steps', () => {
    render(<VisualWorkflowBuilder onClose={mockOnClose} />);
    
    // Should show 4 step indicators
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});