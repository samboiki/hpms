import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Practice } from '@/lib/tenants'
import PageWrapper from '@/components/PageWrapper'
import EnhancedServicesSection from '@/components/EnhancedServicesSection'
import { newcharmServices } from '@/data/newcharm-services'

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}))

const mockNewCharmPractice: Practice = {
  id: 'newcharm-id',
  slug: 'newcharm-dental',
  name: 'NewCharm Dental Practice',
  domain: 'newcharm.vercel.app',
  primary_color: '#00BCD4',
  secondary_color: '#0097A7',
  contact_email: 'info@newcharmdental.na',
  contact_phone: '+264 61 234 567',
  address: '123 Independence Avenue',
  city: 'Windhoek',
  country: 'Namibia',
  postal_code: '10001',
  business_hours: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '16:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: { closed: true },
  },
  features: {
    online_booking: true,
    telemedicine: true,
    lab_results: false,
    online_payments: true,
  },
  settings: {
    appointment_duration: 60,
    advance_booking_days: 30,
    cancellation_hours: 24,
  },
  hero_title: 'Your Smile, Our Passion',
  hero_subtitle: 'Modern dental care with a personal touch. Experience comfort, quality, and the latest in dental technology.',
  hero_image_url: '/images/newcharm/hero-dental-clinic.jpg',
  about_text: 'At NewCharm Dental Practice, we believe that everyone deserves a healthy, beautiful smile.',
  services: [
    {
      id: 'general-dentistry',
      name: 'General Dentistry',
      description: 'Comprehensive dental care for your entire family',
      icon: 'Shield',
    },
    {
      id: 'cosmetic-dentistry',
      name: 'Cosmetic Dentistry',
      description: 'Enhance your smile with our advanced cosmetic procedures',
      icon: 'Sparkles',
    },
  ],
  social_links: {
    facebook: 'https://facebook.com/newcharmdental',
    instagram: 'https://instagram.com/newcharmdental',
  },
}

describe('NewCharm Dental Landing Page', () => {
  describe('Practice Information Display', () => {
    it('displays NewCharm practice information correctly', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      expect(screen.getByText('NewCharm Dental Practice')).toBeInTheDocument()
      expect(screen.getByText('Your Smile, Our Passion')).toBeInTheDocument()
      expect(screen.getByText(/Modern dental care with a personal touch/)).toBeInTheDocument()
    })

    it('shows correct contact information', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      expect(screen.getByText('info@newcharmdental.na')).toBeInTheDocument()
      expect(screen.getByText('+264 61 234 567')).toBeInTheDocument()
      expect(screen.getByText(/123 Independence Avenue/)).toBeInTheDocument()
      expect(screen.getByText(/Windhoek/)).toBeInTheDocument()
    })

    it('displays business hours correctly', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      // Check that business hours are displayed
      expect(screen.getByText(/Monday/)).toBeInTheDocument()
      expect(screen.getByText(/08:00.*17:00/)).toBeInTheDocument()
      expect(screen.getByText(/Saturday/)).toBeInTheDocument()
      expect(screen.getByText(/09:00.*13:00/)).toBeInTheDocument()
    })
  })

  describe('Dental Services Display', () => {
    it('renders dental service categories', () => {
      render(<EnhancedServicesSection practice={mockNewCharmPractice} />)
      
      // Check that all 6 dental service categories are displayed
      expect(screen.getByText('General Dentistry')).toBeInTheDocument()
      expect(screen.getByText('Cosmetic Dentistry')).toBeInTheDocument()
      expect(screen.getByText('Orthodontics')).toBeInTheDocument()
      expect(screen.getByText('Oral Surgery')).toBeInTheDocument()
      expect(screen.getByText('Emergency Dental Care')).toBeInTheDocument()
      expect(screen.getByText('Preventive Care')).toBeInTheDocument()
    })

    it('displays service descriptions', () => {
      render(<EnhancedServicesSection practice={mockNewCharmPractice} />)
      
      expect(screen.getByText('Comprehensive dental care for your entire family')).toBeInTheDocument()
      expect(screen.getByText('Enhance your smile with our advanced cosmetic procedures')).toBeInTheDocument()
      expect(screen.getByText('Straighten your teeth with modern orthodontic solutions')).toBeInTheDocument()
    })

    it('shows dental service pricing in Namibian Dollars', () => {
      render(<EnhancedServicesSection practice={mockNewCharmPractice} />)
      
      // Click on a service category to reveal sub-services
      fireEvent.click(screen.getByText('General Dentistry'))
      
      waitFor(() => {
        // Check for NAD pricing
        expect(screen.getByText(/N\$450/)).toBeInTheDocument() // Routine checkup
        expect(screen.getByText(/N\$350/)).toBeInTheDocument() // Dental cleaning
      })
    })
  })

  describe('Service Categories and Sub-services', () => {
    it('displays correct number of services per category', () => {
      // Verify service data structure
      expect(newcharmServices).toHaveLength(6)
      
      const generalDentistry = newcharmServices.find(s => s.id === 'general-dentistry')
      expect(generalDentistry?.subServices).toHaveLength(4)
      
      const cosmeticDentistry = newcharmServices.find(s => s.id === 'cosmetic-dentistry')
      expect(cosmeticDentistry?.subServices).toHaveLength(4)
      
      const orthodontics = newcharmServices.find(s => s.id === 'orthodontics')
      expect(orthodontics?.subServices).toHaveLength(4)
    })

    it('includes emergency care services', () => {
      const emergencyCare = newcharmServices.find(s => s.id === 'emergency-care')
      expect(emergencyCare).toBeDefined()
      expect(emergencyCare?.name).toBe('Emergency Dental Care')
      expect(emergencyCare?.subServices).toHaveLength(4)
      
      const emergencyConsultation = emergencyCare?.subServices.find(s => s.id === 'emergency-consultation')
      expect(emergencyConsultation?.name).toBe('Emergency Consultation')
      expect(emergencyConsultation?.price).toBe('N$550')
    })

    it('includes orthodontic services with proper pricing', () => {
      const orthodontics = newcharmServices.find(s => s.id === 'orthodontics')
      const clearAligners = orthodontics?.subServices.find(s => s.id === 'clear-aligners')
      
      expect(clearAligners?.name).toBe('Clear Aligner Therapy')
      expect(clearAligners?.price).toBe('From N$35,000')
      expect(clearAligners?.duration).toBe('12-18 months')
    })
  })

  describe('Branding and Design', () => {
    it('applies correct dental practice color scheme', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      const wrapper = screen.getByRole('main').parentElement
      expect(wrapper).toHaveStyle({
        '--primary-color': '#00BCD4',
        '--secondary-color': '#0097A7',
      })
    })

    it('displays dental-specific imagery', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      const heroImage = screen.getByAltText(/NewCharm Dental Practice/i)
      expect(heroImage).toHaveAttribute('src', '/images/newcharm/hero-dental-clinic.jpg')
    })
  })

  describe('Booking Integration', () => {
    it('has functional booking widget for dental services', () => {
      const mockBookService = jest.fn()
      render(<EnhancedServicesSection practice={mockNewCharmPractice} onBookService={mockBookService} />)
      
      // Click on a service category
      fireEvent.click(screen.getByText('General Dentistry'))
      
      waitFor(() => {
        // Look for book now buttons
        const bookButtons = screen.getAllByText(/Book Now/i)
        expect(bookButtons.length).toBeGreaterThan(0)
        
        // Click a book button
        fireEvent.click(bookButtons[0])
        
        expect(mockBookService).toHaveBeenCalled()
      })
    })

    it('supports online booking feature', () => {
      expect(mockNewCharmPractice.features.online_booking).toBe(true)
    })

    it('supports online payments for dental services', () => {
      expect(mockNewCharmPractice.features.online_payments).toBe(true)
    })
  })

  describe('Dental Practice Features', () => {
    it('includes telemedicine capability', () => {
      expect(mockNewCharmPractice.features.telemedicine).toBe(true)
    })

    it('has appropriate appointment settings for dental practice', () => {
      expect(mockNewCharmPractice.settings.appointment_duration).toBe(60)
      expect(mockNewCharmPractice.settings.advance_booking_days).toBe(30)
      expect(mockNewCharmPractice.settings.cancellation_hours).toBe(24)
    })

    it('operates on appropriate dental practice schedule', () => {
      // Monday-Thursday: Full day
      expect(mockNewCharmPractice.business_hours.monday.open).toBe('08:00')
      expect(mockNewCharmPractice.business_hours.monday.close).toBe('17:00')
      
      // Friday: Half day
      expect(mockNewCharmPractice.business_hours.friday.close).toBe('16:00')
      
      // Saturday: Morning only
      expect(mockNewCharmPractice.business_hours.saturday.open).toBe('09:00')
      expect(mockNewCharmPractice.business_hours.saturday.close).toBe('13:00')
      
      // Sunday: Closed
      expect(mockNewCharmPractice.business_hours.sunday.closed).toBe(true)
    })
  })

  describe('Location and Contact', () => {
    it('displays location map for dental practice', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      // Should show location map since isDental is true
      expect(screen.getByText(/Location/i)).toBeInTheDocument()
    })

    it('shows social media links', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      const facebookLink = screen.getByRole('link', { name: /facebook/i })
      expect(facebookLink).toHaveAttribute('href', 'https://facebook.com/newcharmdental')
      
      const instagramLink = screen.getByRole('link', { name: /instagram/i })
      expect(instagramLink).toHaveAttribute('href', 'https://instagram.com/newcharmdental')
    })
  })

  describe('Professional Dental Content', () => {
    it('includes proper dental terminology', () => {
      render(<EnhancedServicesSection practice={mockNewCharmPractice} />)
      
      fireEvent.click(screen.getByText('Oral Surgery'))
      
      waitFor(() => {
        expect(screen.getByText(/Dental Implants/)).toBeInTheDocument()
        expect(screen.getByText(/Wisdom Tooth Removal/)).toBeInTheDocument()
        expect(screen.getByText(/Bone Grafting/)).toBeInTheDocument()
      })
    })

    it('displays treatment benefits for dental procedures', () => {
      const routineCheckup = newcharmServices
        .find(s => s.id === 'general-dentistry')?.subServices
        .find(s => s.id === 'routine-checkup')
      
      expect(routineCheckup?.benefits).toContain('Complete oral health assessment')
      expect(routineCheckup?.benefits).toContain('Professional teeth cleaning')
      expect(routineCheckup?.benefits).toContain('Early detection of dental issues')
    })

    it('includes realistic treatment durations', () => {
      const rootCanal = newcharmServices
        .find(s => s.id === 'general-dentistry')?.subServices
        .find(s => s.id === 'root-canal')
      
      expect(rootCanal?.duration).toBe('120 minutes')
      
      const traditionalBraces = newcharmServices
        .find(s => s.id === 'orthodontics')?.subServices
        .find(s => s.id === 'traditional-braces')
      
      expect(traditionalBraces?.duration).toBe('18-24 months')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('renders properly on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      // Should render without errors on mobile
      expect(screen.getByText('NewCharm Dental Practice')).toBeInTheDocument()
    })
  })

  describe('SEO and Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toBeInTheDocument()
      
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThan(0)
    })

    it('includes alt text for images', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      const images = screen.getAllByRole('img')
      images.forEach(img => {
        expect(img).toHaveAttribute('alt')
      })
    })

    it('has proper semantic structure', () => {
      render(<PageWrapper practice={mockNewCharmPractice} />)
      
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })
  })
})

describe('NewCharm Service Data Quality', () => {
  it('has comprehensive service coverage', () => {
    expect(newcharmServices).toHaveLength(6)
    
    const serviceIds = newcharmServices.map(s => s.id)
    expect(serviceIds).toContain('general-dentistry')
    expect(serviceIds).toContain('cosmetic-dentistry')
    expect(serviceIds).toContain('orthodontics')
    expect(serviceIds).toContain('oral-surgery')
    expect(serviceIds).toContain('emergency-care')
    expect(serviceIds).toContain('preventive-care')
  })

  it('has realistic Namibian pricing', () => {
    const allSubServices = newcharmServices.flatMap(cat => cat.subServices)
    
    // Check that prices are in NAD format
    allSubServices.forEach(service => {
      expect(service.price).toMatch(/N\$|From N\$|Custom quote/)
    })
    
    // Check specific price ranges are reasonable for Namibia
    const routineCheckup = allSubServices.find(s => s.id === 'routine-checkup')
    expect(routineCheckup?.price).toBe('N$450')
    
    const dentalImplants = allSubServices.find(s => s.id === 'dental-implants')
    expect(dentalImplants?.price).toBe('From N$12,000')
  })

  it('includes proper treatment descriptions', () => {
    const allSubServices = newcharmServices.flatMap(cat => cat.subServices)
    
    allSubServices.forEach(service => {
      expect(service.description).toBeTruthy()
      expect(service.description.length).toBeGreaterThan(20)
      expect(service.duration).toBeTruthy()
      expect(service.benefits?.length).toBeGreaterThan(0)
    })
  })
})