// Practice Management Type Definitions

// Practice Status Enum
export type PracticeStatus = 'lead' | 'contacted' | 'qualified' | 'onboarding' | 'active' | 'inactive'

export interface PracticeStats {
  totalPractices: number
  activePractices: number
  pendingApproval: number
  totalBranches: number
  averageStaffPerPractice: number
  totalRevenue: number
  monthlyGrowth: number
  // Status breakdown
  leadCount: number
  contactedCount: number
  qualifiedCount: number
  onboardingCount: number
  inactiveCount: number
}

export interface Practice {
  id: string
  name: string
  practice_type: string
  status: PracticeStatus
  subscription_tier: string
  created_at: string
  email: string
  phone: string
  city: string
  country: string
}

export interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  qualifications: string
  hpcsa_number: string
}

export interface PracticeFormData {
  // Basic Information
  name: string
  description: string
  practice_type: 'general_practice' | 'dental_practice' | 'veterinary_clinic' | 'specialist_clinic' | 'hospital' | 'pharmacy' | 'other'
  registration_number: string
  tax_number: string

  // Contact Information
  email: string
  phone: string
  contact_email: string
  contact_phone: string

  // Address
  address: string
  city: string
  country: string

  // Website & Marketing
  website: string
  wants_marketing_website: boolean
  website_template: string
  website_description: string
  website_emails?: Array<{
    name: string
    email: string
  }>
  social_media_links: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  }

  // Branding
  domain: string
  domain_extension: string
  logo_url: string
  primary_color: string
  secondary_color: string

  // Settings
  subscription_tier: string
  max_users: number
  max_patients: number
  is_follow_up_automation_enabled: boolean

  // SMS/Email Limits
  sms_limit: number
  sms_used: number

  // Pricing & Usage Calculations
  average_patients_per_day: number
  expected_sms_per_patient: number

  // Feature Add-ons
  telemedicine_enabled: boolean
  telemedicine_monthly_calls: number

  // Marketing Add-ons
  google_ads_enabled: boolean
  google_ads_budget: number
  seo_optimization_enabled: boolean
  social_media_management_enabled: boolean

  // Automation Selection
  selected_automations: string[]

  // Additional Services
  number_of_branches?: number
  additional_branches?: number
  branch_names?: string[]
  professional_emails?: string[]
  professional_email_count?: number
  email_addresses?: string[]
  marketing_budget?: number
  facebook_url?: string
  twitter_url?: string
  instagram_url?: string
  linkedin_url?: string

  // Practice Manager/Admin User
  admin_name: string
  admin_email: string
  admin_phone: string
  admin_password: string
  admin_hpcsa_number?: string
  admin_role: 'admin' | 'doctor'
  admin_job_title: string

  // Additional Staff Members
  additional_staff: Array<{
    full_name: string
    email: string
    role: 'admin' | 'doctor' | 'nurse' | 'receptionist'
    phone?: string
    hpcsa_number?: string
    staff_title?: string
    password: string
  }>
}

export interface StatsCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: string
  trend?: {
    value: number
    isPositive: boolean
  }
  loading?: boolean
}

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: 'patient' | 'billing' | 'clinical'
  price: number
  requires_sms: boolean
  requires_email: boolean
}

export interface PricingCalculation {
  basePrice: number
  extraSMSCost: number
  averageMonthlySMS: number
  extraSMS: number
  telemedicineCost: number
  googleAdsCost: number
  seoCost: number
  socialMediaCost: number
  automationCost: number
  additionalBranchesCost: number
  professionalEmailsCost: number
  totalMonthly: number
}

export type TabType = 'overview' | 'register' | 'manage' | 'pipeline'

export interface FormStep {
  id: number
  label: string
  icon: string
}

// Kanban Board Types
export interface KanbanColumn {
  id: PracticeStatus
  title: string
  icon: string
  color: string
  bgColor: string
  practices: Practice[]
}

export interface StatusTransition {
  from: PracticeStatus
  to: PracticeStatus
  action: string
}