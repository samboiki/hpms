import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunicationHub from '../CommunicationHub';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('CommunicationHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all quick setup cards', () => {
    render(<CommunicationHub />);
    
    expect(screen.getByText('Appointment Reminders')).toBeInTheDocument();
    expect(screen.getByText('Birthday Greetings')).toBeInTheDocument();
    expect(screen.getByText('Follow-up Care')).toBeInTheDocument();
    expect(screen.getByText('Payment Reminders')).toBeInTheDocument();
  });

  it('shows Quick Setup button for inactive campaigns', () => {
    render(<CommunicationHub />);
    
    const quickSetupButtons = screen.getAllByText('Quick Setup');
    expect(quickSetupButtons).toHaveLength(4);
  });

  it('opens setup modal when Quick Setup is clicked', async () => {
    render(<CommunicationHub />);
    
    const firstQuickSetupButton = screen.getAllByText('Quick Setup')[0];
    fireEvent.click(firstQuickSetupButton);
    
    await waitFor(() => {
      expect(screen.getByText('Quick Setup: Appointment Reminders')).toBeInTheDocument();
      expect(screen.getByText("What's Included:")).toBeInTheDocument();
    });
  });

  it('activates campaign when Activate Now is clicked', async () => {
    render(<CommunicationHub />);
    
    // Open modal
    const quickSetupButton = screen.getAllByText('Quick Setup')[0];
    fireEvent.click(quickSetupButton);
    
    // Click Activate Now
    await waitFor(() => {
      const activateButton = screen.getByText('Activate Now');
      fireEvent.click(activateButton);
    });
    
    // Check for success notification
    await waitFor(() => {
      expect(screen.getByText(/has been activated successfully!/)).toBeInTheDocument();
    });
  });

  it('shows empty state for Today\'s Messages', () => {
    render(<CommunicationHub />);
    
    expect(screen.getByText('No messages sent today')).toBeInTheDocument();
    expect(screen.getByText('Messages will appear here once campaigns are active')).toBeInTheDocument();
  });

  it('renders all smart suggestions', () => {
    render(<CommunicationHub />);
    
    expect(screen.getByText('Enable Birthday Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Payment Reminder Automation')).toBeInTheDocument();
    expect(screen.getByText('Follow-up Care Messages')).toBeInTheDocument();
  });

  it('clicking suggestion action opens relevant setup modal', async () => {
    render(<CommunicationHub />);
    
    // Find and click the birthday suggestion action
    const suggestionActions = screen.getAllByText('Quick Setup');
    const birthdaySuggestionAction = suggestionActions.find((button) => {
      const parent = button.closest('div');
      return parent?.textContent?.includes('Enable Birthday Campaigns');
    });
    
    if (birthdaySuggestionAction) {
      fireEvent.click(birthdaySuggestionAction);
      
      await waitFor(() => {
        expect(screen.getByText('Quick Setup: Birthday Greetings')).toBeInTheDocument();
      });
    }
  });

  it('displays correct performance metrics with no data', () => {
    render(<CommunicationHub />);
    
    // Check for zero/empty values
    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2); // Messages sent and Time saved
    expect(screen.getAllByText('-')).toHaveLength(4); // Other metrics
  });

  it('shows campaign status as Active after activation', async () => {
    render(<CommunicationHub />);
    
    // Activate a campaign
    const quickSetupButton = screen.getAllByText('Quick Setup')[0];
    fireEvent.click(quickSetupButton);
    
    await waitFor(() => {
      const activateButton = screen.getByText('Activate Now');
      fireEvent.click(activateButton);
    });
    
    // Check for Active status
    await waitFor(() => {
      expect(screen.getByText('Active ✓')).toBeInTheDocument();
    });
  });

  it('allows customization before activation', async () => {
    render(<CommunicationHub />);
    
    const quickSetupButton = screen.getAllByText('Quick Setup')[0];
    fireEvent.click(quickSetupButton);
    
    await waitFor(() => {
      const customizeButton = screen.getByText('Customize First');
      expect(customizeButton).toBeInTheDocument();
      
      fireEvent.click(customizeButton);
      // Modal should close
      expect(screen.queryByText('Quick Setup: Appointment Reminders')).not.toBeInTheDocument();
    });
  });
});