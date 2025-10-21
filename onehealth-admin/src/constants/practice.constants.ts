import type { AutomationTemplate, FormStep } from '../types/practice.types'

// Available automation templates
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'welcome-patient',
    name: 'Welcome New Patient',
    description: 'Send welcome message to newly registered patients',
    category: 'patient',
    price: 25,
    requires_sms: true,
    requires_email: true
  },
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    description: 'Send reminder 24 hours before appointment',
    category: 'patient',
    price: 35,
    requires_sms: true,
    requires_email: true
  },
  {
    id: 'invoice-ready',
    name: 'Invoice Ready',
    description: 'Notify patient when invoice is generated',
    category: 'billing',
    price: 20,
    requires_sms: true,
    requires_email: true
  },
  {
    id: 'lab-results-ready',
    name: 'Lab Results Ready',
    description: 'Notify patient when lab results are available',
    category: 'clinical',
    price: 30,
    requires_sms: true,
    requires_email: true
  },
  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    description: 'Remind patients of overdue invoices',
    category: 'billing',
    price: 15,
    requires_sms: true,
    requires_email: true
  }
]

// Form steps configuration
export const FORM_STEPS: FormStep[] = [
  { id: 1, label: 'Basic Info', icon: 'solar:buildings-3-bold-duotone' },
  { id: 2, label: 'Contact', icon: 'solar:phone-bold-duotone' },
  { id: 3, label: 'Branding', icon: 'solar:palette-bold-duotone' },
  { id: 4, label: 'Website', icon: 'solar:global-bold-duotone' },
  { id: 5, label: 'Staff', icon: 'solar:users-group-two-rounded-bold-duotone' },
  { id: 6, label: 'Pricing', icon: 'solar:dollar-minimalistic-bold-duotone' },
  { id: 7, label: 'Review', icon: 'solar:clipboard-check-bold-duotone' }
]

// Pricing constants
export const PRICING_CONSTANTS = {
  BASE_PRICE: 1600,
  BASE_SMS_INCLUDED: 200,
  SMS_COST_PER_MESSAGE: 0.50,
  TELEMEDICINE_COST: 150,
  GOOGLE_ADS_DEFAULT_BUDGET: 500,
  SEO_COST: 400,
  SOCIAL_MEDIA_COST: 300,
  ADDITIONAL_BRANCH_COST: 1000,
  PROFESSIONAL_EMAIL_COST: 50
}

// Practice type options
export const PRACTICE_TYPES = [
  { value: 'general_practice', label: 'General Practice' },
  { value: 'dental_practice', label: 'Dental Practice' },
  { value: 'veterinary_clinic', label: 'Veterinary Clinic' },
  { value: 'specialist_clinic', label: 'Specialist Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'other', label: 'Other' }
]

// Country options
export const COUNTRIES = [
  'Namibia',
  'South Africa',
  'Botswana',
  'Zimbabwe'
]

// Domain extensions
export const DOMAIN_EXTENSIONS = [
  '.com',
  '.org',
  '.net',
  '.co.za',
  '.com.na',
  '.org.na',
  '.info',
  '.biz',
  '.clinic',
  '.health',
  '.medical'
]

// Website templates
export const WEBSITE_TEMPLATES = [
  'modern',
  'classic',
  'minimal'
]

// Staff roles
export const STAFF_ROLES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'admin', label: 'Administrator' }
]

// Admin roles
export const ADMIN_ROLES = [
  { value: 'admin', label: 'Practice Admin' },
  { value: 'doctor', label: 'Doctor/Admin' }
]

// Subscription tiers
export const SUBSCRIPTION_TIERS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' }
]