import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../pages/Settings';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';

// Mock stores
jest.mock('../stores/authStore');
jest.mock('../stores/themeStore');

// Mock user data
const mockUser = {
  id: '1',
  name: 'Dr. John Smith',
  email: 'john.smith@example.com',
  role: 'doctor',
  avatar: 'https://example.com/avatar.jpg'
};

// Mock theme data
const mockThemes = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean and professional',
    colors: {
      primary: { from: '#01b9d4', to: '#0891b2' }
    },
    gradients: {
      sidebar: 'from-cyan-500 to-blue-600'
    }
  },
  {
    id: 'purple',
    name: 'Purple',
    description: 'Modern and vibrant',
    colors: {
      primary: { from: '#8B5CF6', to: '#7C3AED' }
    },
    gradients: {
      sidebar: 'from-purple-500 to-indigo-600'
    }
  }
];

const mockCurrentTheme = mockThemes[0];

// Mock store implementations
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

// Wrapper component for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Settings Page', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      initialize: jest.fn()
    });

    mockUseTheme.mockReturnValue({
      currentTheme: mockCurrentTheme,
      themes: mockThemes,
      setTheme: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Page Structure', () => {
    test('renders settings page with correct title and description', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Manage your account and application preferences')).toBeInTheDocument();
    });

    test('renders all navigation tabs', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Practice')).toBeInTheDocument();
    });

    test('displays sidebar navigation with icons', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const accountTab = screen.getByRole('button', { name: /account/i });
      const securityTab = screen.getByRole('button', { name: /security/i });
      const notificationsTab = screen.getByRole('button', { name: /notifications/i });
      
      expect(accountTab).toBeInTheDocument();
      expect(securityTab).toBeInTheDocument();
      expect(notificationsTab).toBeInTheDocument();
    });
  });

  describe('Account Tab', () => {
    test('displays user profile information', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue(mockUser.name)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockUser.email)).toBeInTheDocument();
      expect(screen.getByText(mockUser.role, { exact: false })).toBeInTheDocument();
    });

    test('shows user avatar or default placeholder', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const avatar = screen.getByAltText(mockUser.name);
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockUser.avatar);
    });

    test('displays theme selection with available themes', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText('Color Theme')).toBeInTheDocument();
      expect(screen.getByText('Choose your preferred color theme')).toBeInTheDocument();
      
      mockThemes.forEach(theme => {
        expect(screen.getByText(theme.name)).toBeInTheDocument();
        expect(screen.getByText(theme.description)).toBeInTheDocument();
      });
    });

    test('shows current theme as selected', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const currentThemeElement = screen.getByText(mockCurrentTheme.name).closest('div');
      expect(currentThemeElement).toHaveClass('border-blue-500');
    });

    test('allows theme selection', () => {
      const mockSetTheme = jest.fn();
      mockUseTheme.mockReturnValue({
        currentTheme: mockCurrentTheme,
        themes: mockThemes,
        setTheme: mockSetTheme
      });

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const purpleTheme = screen.getByText('Purple').closest('div');
      fireEvent.click(purpleTheme!);

      expect(mockSetTheme).toHaveBeenCalledWith('purple');
    });

    test('displays preferences toggles', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      expect(screen.getByText('Show Online Status')).toBeInTheDocument();
      expect(screen.getByText('Appointment Notification Sounds')).toBeInTheDocument();
    });
  });

  describe('Security Tab', () => {
    test('switches to security tab when clicked', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      expect(screen.getByText('Change Password')).toBeInTheDocument();
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText('Login Sessions')).toBeInTheDocument();
    });

    test('displays password change form', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    });

    test('shows 2FA status', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      expect(screen.getByText('Two-factor authentication is enabled')).toBeInTheDocument();
    });

    test('displays active sessions', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      expect(screen.getByText('Current Session')).toBeInTheDocument();
      expect(screen.getByText('Mac OS • Chrome')).toBeInTheDocument();
    });
  });

  describe('Notifications Tab', () => {
    test('switches to notifications tab when clicked', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const notificationsTab = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationsTab);

      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      expect(screen.getByText('Appointment Notifications')).toBeInTheDocument();
      expect(screen.getByText('Patient Notifications')).toBeInTheDocument();
      expect(screen.getByText('System Notifications')).toBeInTheDocument();
    });

    test('displays notification checkboxes', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const notificationsTab = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationsTab);

      expect(screen.getByLabelText('New appointment created')).toBeInTheDocument();
      expect(screen.getByLabelText('Appointment reminders (1 day before)')).toBeInTheDocument();
      expect(screen.getByLabelText('New patient registration')).toBeInTheDocument();
    });

    test('displays notification method toggles', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const notificationsTab = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationsTab);

      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('SMS Notifications')).toBeInTheDocument();
      expect(screen.getByText('Browser Notifications')).toBeInTheDocument();
    });
  });

  describe('System Tab', () => {
    test('switches to system tab when clicked', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const systemTab = screen.getByRole('button', { name: /system/i });
      fireEvent.click(systemTab);

      expect(screen.getByText('System Information')).toBeInTheDocument();
      expect(screen.getByText('Data Management')).toBeInTheDocument();
      expect(screen.getByText('Compliance Settings')).toBeInTheDocument();
    });

    test('displays system information', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const systemTab = screen.getByRole('button', { name: /system/i });
      fireEvent.click(systemTab);

      expect(screen.getByText('System Version')).toBeInTheDocument();
      expect(screen.getByText('Last Updated')).toBeInTheDocument();
      expect(screen.getByText('Database Status')).toBeInTheDocument();
      expect(screen.getByText('Storage Usage')).toBeInTheDocument();
    });

    test('displays compliance settings', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const systemTab = screen.getByRole('button', { name: /system/i });
      fireEvent.click(systemTab);

      expect(screen.getByText('HIPAA Audit Logging')).toBeInTheDocument();
      expect(screen.getByText('Data Encryption')).toBeInTheDocument();
      expect(screen.getByText('Session Timeout')).toBeInTheDocument();
    });
  });

  describe('Practice Tab', () => {
    test('switches to practice tab when clicked', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const practiceTab = screen.getByRole('button', { name: /practice/i });
      fireEvent.click(practiceTab);

      expect(screen.getByText('Practice Management')).toBeInTheDocument();
      expect(screen.getByText('Practice Info')).toBeInTheDocument();
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Hours & Availability')).toBeInTheDocument();
    });

    test('displays practice information in profile tab', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const practiceTab = screen.getByRole('button', { name: /practice/i });
      fireEvent.click(practiceTab);

      expect(screen.getByText('HealthCare Medical Center')).toBeInTheDocument();
      expect(screen.getByText('Practice Description')).toBeInTheDocument();
      expect(screen.getByText('Specialties & Services')).toBeInTheDocument();
    });

    test('displays staff members in staff tab', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const practiceTab = screen.getByRole('button', { name: /practice/i });
      fireEvent.click(practiceTab);

      const staffTab = screen.getByRole('button', { name: /^staff$/i });
      fireEvent.click(staffTab);

      expect(screen.getByText('Practice Staff')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Michael Chen')).toBeInTheDocument();
    });

    test('displays hours of operation in hours tab', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const practiceTab = screen.getByRole('button', { name: /practice/i });
      fireEvent.click(practiceTab);

      const hoursTab = screen.getByRole('button', { name: /hours & availability/i });
      fireEvent.click(hoursTab);

      expect(screen.getByText('Hours of Operation')).toBeInTheDocument();
      expect(screen.getByText('Staff Availability')).toBeInTheDocument();
      expect(screen.getByText('Monday')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('highlights active tab', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const accountTab = screen.getByRole('button', { name: /account/i });
      expect(accountTab).toHaveClass('bg-primary-50', 'text-primary-700');
    });

    test('changes content when switching tabs', async () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      // Start on account tab
      expect(screen.getByText('Profile Information')).toBeInTheDocument();

      // Switch to security tab
      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      await waitFor(() => {
        expect(screen.getByText('Change Password')).toBeInTheDocument();
        expect(screen.queryByText('Profile Information')).not.toBeInTheDocument();
      });
    });

    test('maintains correct tab styling on switch', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const securityTab = screen.getByRole('button', { name: /security/i });
      fireEvent.click(securityTab);

      expect(securityTab).toHaveClass('bg-primary-50', 'text-primary-700');
      
      const accountTab = screen.getByRole('button', { name: /account/i });
      expect(accountTab).toHaveClass('text-gray-700');
    });
  });

  describe('Form Interactions', () => {
    test('save buttons are present and clickable', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).not.toBeDisabled();

      fireEvent.click(saveButton);
      // Add assertions for save functionality when implemented
    });

    test('toggle switches work correctly', () => {
      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const toggles = screen.getAllByRole('checkbox');
      expect(toggles.length).toBeGreaterThan(0);

      // Test first toggle
      const firstToggle = toggles[0];
      const initialChecked = firstToggle.checked;
      
      fireEvent.click(firstToggle);
      expect(firstToggle.checked).toBe(!initialChecked);
    });
  });

  describe('Responsive Design', () => {
    test('renders correctly on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();
      // Check that mobile-specific classes are applied
      const container = screen.getByText('Settings').closest('div');
      expect(container).toHaveClass('min-h-screen');
    });
  });

  describe('Error Handling', () => {
    test('handles missing user data gracefully', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
        login: jest.fn(),
        logout: jest.fn(),
        initialize: jest.fn()
      });

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      // Should still render without crashing
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    test('handles missing theme data gracefully', () => {
      mockUseTheme.mockReturnValue({
        currentTheme: mockCurrentTheme,
        themes: [],
        setTheme: jest.fn()
      });

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      // Should still render without crashing
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});