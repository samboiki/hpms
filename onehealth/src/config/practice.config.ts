// Practice-specific configuration
export const practiceConfig = {
  // Practice Details
  practiceName: 'New Charm Dental Practice',
  practiceId: 'newcharmdental', // This should match the branch name
  
  // Branding
  logo: '/logo.png',
  primaryColor: '#8b5cf6', // Purple
  secondaryColor: '#3b82f6', // Blue
  
  // Contact Information
  phone: '+27 XX XXX XXXX',
  email: 'info@newcharmdentalpractice.com',
  address: 'Your Practice Address',
  
  // Features (can be toggled per practice)
  features: {
    appointments: true,
    messaging: true,
    billing: true,
    medicalRecords: true,
    prescriptions: true,
    labResults: true,
    telemedicine: true,
  },
  
  // Custom domain
  domain: 'newcharmdentalpractice.com',
  
  // Practice Type
  practiceType: 'dental',
}