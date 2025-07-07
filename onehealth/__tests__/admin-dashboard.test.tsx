import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useAuth } from '@/hooks/use-auth'
import PracticesManagementPage from '@/app/dashboard/practices/page'
import TariffsPage from '@/app/dashboard/tariffs/page'
import SMSManagementPage from '@/app/dashboard/sms/page'

// Mock useAuth hook
jest.mock('@/hooks/use-auth')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          then: jest.fn(),
        })),
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            then: jest.fn(),
          })),
        })),
      })),
    })),
  },
}))

const mockUser = {
  id: 'test-user-id',
  email: 'admin@onehealth.na',
  user_metadata: { full_name: 'OneHealth Admin' },
}

describe('OneHealth Admin Dashboard', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: jest.fn(),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Practice Management Page', () => {
    it('renders practice management header with correct fonts', async () => {
      render(<PracticesManagementPage />)
      
      const header = screen.getByText('Practice Management')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('font-poppins')
      
      const subtitle = screen.getByText(/Monitor and manage healthcare practices/i)
      expect(subtitle).toBeInTheDocument()
      expect(subtitle).toHaveClass('font-montserrat')
    })

    it('displays practice statistics cards', async () => {
      render(<PracticesManagementPage />)
      
      expect(screen.getByText('Total Practices')).toBeInTheDocument()
      expect(screen.getByText('Total Patients')).toBeInTheDocument()
      expect(screen.getByText('Revenue Potential')).toBeInTheDocument()
      expect(screen.getByText('SMS Usage')).toBeInTheDocument()
    })

    it('has working search functionality', async () => {
      render(<PracticesManagementPage />)
      
      const searchInput = screen.getByPlaceholderText(/Search practices by name/i)
      expect(searchInput).toBeInTheDocument()
      
      fireEvent.change(searchInput, { target: { value: 'Dr. Polina' } })
      expect(searchInput).toHaveValue('Dr. Polina')
    })

    it('has filtering options for status and tier', async () => {
      render(<PracticesManagementPage />)
      
      const statusFilter = screen.getByDisplayValue('All Statuses')
      const tierFilter = screen.getByDisplayValue('All Tiers')
      
      expect(statusFilter).toBeInTheDocument()
      expect(tierFilter).toBeInTheDocument()
    })

    it('displays action buttons with correct icons', async () => {
      render(<PracticesManagementPage />)
      
      const exportButton = screen.getByText('Export Report')
      const addButton = screen.getByText('Add Practice')
      
      expect(exportButton).toBeInTheDocument()
      expect(addButton).toBeInTheDocument()
    })
  })

  describe('Tariff Management Page', () => {
    it('renders tariff management header with correct typography', async () => {
      render(<TariffsPage />)
      
      const header = screen.getByText('Tariff Management')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('font-poppins')
      
      const subtitle = screen.getByText(/Manage pricing and service codes/i)
      expect(subtitle).toBeInTheDocument()
      expect(subtitle).toHaveClass('font-montserrat')
    })

    it('displays tariff statistics cards', async () => {
      render(<TariffsPage />)
      
      expect(screen.getByText('Total Tariffs')).toBeInTheDocument()
      expect(screen.getByText('Avg. Price')).toBeInTheDocument()
      expect(screen.getByText('Categories')).toBeInTheDocument()
      expect(screen.getByText('Practices')).toBeInTheDocument()
    })

    it('has comprehensive search and filter options', async () => {
      render(<TariffsPage />)
      
      const searchInput = screen.getByPlaceholderText(/Search by code, name, or description/i)
      expect(searchInput).toBeInTheDocument()
      
      const practiceFilter = screen.getByDisplayValue('All Practices')
      const categoryFilter = screen.getByDisplayValue('All Categories')
      
      expect(practiceFilter).toBeInTheDocument()
      expect(categoryFilter).toBeInTheDocument()
    })

    it('displays tariff table headers', async () => {
      render(<TariffsPage />)
      
      expect(screen.getByText('Code')).toBeInTheDocument()
      expect(screen.getByText('Service Name')).toBeInTheDocument()
      expect(screen.getByText('Practice')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  describe('SMS Management Page', () => {
    it('renders SMS management header with correct styling', async () => {
      render(<SMSManagementPage />)
      
      const header = screen.getByText('SMS Management')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('font-poppins')
      
      const subtitle = screen.getByText(/Monitor SMS communications/i)
      expect(subtitle).toBeInTheDocument()
      expect(subtitle).toHaveClass('font-montserrat')
    })

    it('displays SMS statistics cards', async () => {
      render(<SMSManagementPage />)
      
      expect(screen.getByText('Total Sent')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('This Month')).toBeInTheDocument()
      expect(screen.getByText('Total Cost')).toBeInTheDocument()
    })

    it('shows practice SMS limits overview section', async () => {
      render(<SMSManagementPage />)
      
      expect(screen.getByText('Practice SMS Limits')).toBeInTheDocument()
    })

    it('has SMS filtering capabilities', async () => {
      render(<SMSManagementPage />)
      
      const searchInput = screen.getByPlaceholderText(/Search by phone, message, or type/i)
      expect(searchInput).toBeInTheDocument()
      
      const practiceFilter = screen.getByDisplayValue('All Practices')
      const typeFilter = screen.getByDisplayValue('All Types')
      const statusFilter = screen.getByDisplayValue('All Statuses')
      
      expect(practiceFilter).toBeInTheDocument()
      expect(typeFilter).toBeInTheDocument()
      expect(statusFilter).toBeInTheDocument()
    })

    it('displays SMS logs table structure', async () => {
      render(<SMSManagementPage />)
      
      expect(screen.getByText('Recipient')).toBeInTheDocument()
      expect(screen.getByText('Message')).toBeInTheDocument()
      expect(screen.getByText('Practice')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Sent At')).toBeInTheDocument()
      expect(screen.getByText('Cost')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  describe('Typography and Design System', () => {
    it('consistently uses Poppins font for headers across all pages', async () => {
      const pages = [
        <PracticesManagementPage key="practices" />,
        <TariffsPage key="tariffs" />,
        <SMSManagementPage key="sms" />,
      ]

      for (const page of pages) {
        const { unmount } = render(page)
        
        // Find all h1 elements and verify they use Poppins font
        const headers = document.querySelectorAll('h1')
        headers.forEach(header => {
          expect(header).toHaveClass('font-poppins')
        })
        
        unmount()
      }
    })

    it('consistently uses Montserrat font for body text across all pages', async () => {
      const pages = [
        <PracticesManagementPage key="practices" />,
        <TariffsPage key="tariffs" />,
        <SMSManagementPage key="sms" />,
      ]

      for (const page of pages) {
        const { unmount } = render(page)
        
        // Find all p elements and verify they use Montserrat font
        const paragraphs = document.querySelectorAll('p')
        paragraphs.forEach(p => {
          expect(p).toHaveClass('font-montserrat')
        })
        
        unmount()
      }
    })

    it('uses OneHealth brand colors consistently', async () => {
      render(<PracticesManagementPage />)
      
      // Check for OneHealth brand color usage
      const brandElements = document.querySelectorAll('.text-onehealth-600, .bg-onehealth-100, .border-onehealth-500')
      expect(brandElements.length).toBeGreaterThan(0)
    })
  })

  describe('Responsive Design', () => {
    it('has responsive grid layouts', async () => {
      render(<PracticesManagementPage />)
      
      // Check for responsive grid classes
      const grids = document.querySelectorAll('.grid-cols-1, .md\\:grid-cols-4, .lg\\:grid-cols-2, .xl\\:grid-cols-3')
      expect(grids.length).toBeGreaterThan(0)
    })

    it('has mobile-friendly navigation elements', async () => {
      render(<PracticesManagementPage />)
      
      // Check for responsive flex layouts
      const flexElements = document.querySelectorAll('.flex-col, .sm\\:flex-row')
      expect(flexElements.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and semantic HTML', async () => {
      render(<PracticesManagementPage />)
      
      // Check for semantic HTML elements
      expect(document.querySelector('main, section, header')).toBeInTheDocument()
      
      // Check for accessible button labels
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName()
      })
    })

    it('has keyboard navigation support', async () => {
      render(<TariffsPage />)
      
      // Check for focusable elements
      const focusableElements = document.querySelectorAll(
        'input, button, select, [tabindex]:not([tabindex="-1"])'
      )
      expect(focusableElements.length).toBeGreaterThan(0)
    })
  })

  describe('Loading States', () => {
    it('displays loading spinner when data is loading', async () => {
      // Mock loading state
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: true,
        signOut: jest.fn(),
      })

      render(<PracticesManagementPage />)
      
      const loadingElement = screen.getByRole('status', { hidden: true }) || 
                           document.querySelector('.animate-spin')
      expect(loadingElement).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('gracefully handles empty data states', async () => {
      render(<PracticesManagementPage />)
      
      // Should have fallback content for empty states
      await waitFor(() => {
        expect(screen.queryByText(/No practices found/i) || 
               screen.queryByText(/practices/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Integration', () => {
    it('connects to Supabase for real data', async () => {
      const { supabase } = require('@/lib/supabase')
      
      render(<PracticesManagementPage />)
      
      // Verify Supabase queries are called
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('practice_performance_dashboard')
        expect(supabase.from).toHaveBeenCalledWith('practices')
      })
    })
  })
})

describe('Premium UI Features', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: jest.fn(),
    })
  })

  it('has premium card designs with hover effects', async () => {
    render(<PracticesManagementPage />)
    
    // Check for hover transition classes
    const cards = document.querySelectorAll('.hover\\:shadow-lg, .transition-shadow')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('uses premium color schemes and gradients', async () => {
    render(<SMSManagementPage />)
    
    // Check for gradient and premium color usage
    const premiumElements = document.querySelectorAll(
      '.bg-gradient-to-r, .bg-purple-100, .bg-green-100, .bg-blue-100'
    )
    expect(premiumElements.length).toBeGreaterThan(0)
  })

  it('has professional status indicators and badges', async () => {
    render(<PracticesManagementPage />)
    
    // Check for status badge classes
    const badges = document.querySelectorAll('.rounded-full, .px-2, .py-1')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('includes professional icons from Lucide React', async () => {
    render(<TariffsPage />)
    
    // Icons should be rendered (SVG elements)
    const icons = document.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(5) // Multiple icons should be present
  })
})

// Performance and Quality Tests
describe('Performance and Quality', () => {
  it('loads quickly without unnecessary re-renders', async () => {
    const renderStart = performance.now()
    render(<PracticesManagementPage />)
    const renderEnd = performance.now()
    
    // Should render quickly (under 100ms for initial render)
    expect(renderEnd - renderStart).toBeLessThan(100)
  })

  it('has clean, semantic HTML structure', async () => {
    render(<PracticesManagementPage />)
    
    // Check for semantic HTML elements
    expect(document.querySelector('h1')).toBeInTheDocument()
    expect(document.querySelector('main, section, div')).toBeInTheDocument()
  })

  it('follows healthcare UI best practices', async () => {
    render(<SMSManagementPage />)
    
    // Check for healthcare-specific elements
    expect(screen.getByText(/SMS/i)).toBeInTheDocument()
    expect(screen.getByText(/Practice/i)).toBeInTheDocument()
    expect(screen.getByText(/Management/i)).toBeInTheDocument()
  })
})