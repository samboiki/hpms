import type { PracticeFormData, PricingCalculation } from '../types/practice.types'
import { AUTOMATION_TEMPLATES, PRICING_CONSTANTS } from '../constants/practice.constants'

// Pricing calculation function
export const calculatePricing = (formData: PracticeFormData): PricingCalculation => {
  const {
    BASE_PRICE,
    BASE_SMS_INCLUDED,
    SMS_COST_PER_MESSAGE,
    TELEMEDICINE_COST,
    SEO_COST,
    SOCIAL_MEDIA_COST,
    ADDITIONAL_BRANCH_COST,
    PROFESSIONAL_EMAIL_COST
  } = PRICING_CONSTANTS

  // Calculate SMS costs
  const averageMonthlySMS = formData.average_patients_per_day * formData.expected_sms_per_patient * 30
  const extraSMS = Math.max(0, averageMonthlySMS - BASE_SMS_INCLUDED)
  const extraSMSCost = extraSMS * SMS_COST_PER_MESSAGE

  // Telemedicine costs
  const telemedicineCost = formData.telemedicine_enabled ? TELEMEDICINE_COST : 0

  // Marketing costs
  const googleAdsCost = formData.google_ads_enabled ? formData.google_ads_budget : 0
  const seoCost = formData.seo_optimization_enabled ? SEO_COST : 0
  const socialMediaCost = formData.social_media_management_enabled ? SOCIAL_MEDIA_COST : 0

  // Automation costs
  const automationCost = formData.selected_automations.reduce((total, automationId) => {
    const automation = AUTOMATION_TEMPLATES.find(a => a.id === automationId)
    return total + (automation?.price || 0)
  }, 0)

  // Additional services costs
  const additionalBranchesCost = (formData.additional_branches || 0) * ADDITIONAL_BRANCH_COST
  const professionalEmailsCost = (formData.professional_emails?.length || 0) * PROFESSIONAL_EMAIL_COST

  const totalMonthly = BASE_PRICE + extraSMSCost + telemedicineCost + googleAdsCost + seoCost + socialMediaCost + automationCost + additionalBranchesCost + professionalEmailsCost

  return {
    basePrice: BASE_PRICE,
    extraSMSCost,
    averageMonthlySMS,
    extraSMS,
    telemedicineCost,
    googleAdsCost,
    seoCost,
    socialMediaCost,
    automationCost,
    additionalBranchesCost,
    professionalEmailsCost,
    totalMonthly
  }
}

// Generate initial form data
export const generateInitialFormData = (): PracticeFormData => ({
  name: '',
  description: '',
  practice_type: 'general_practice',
  registration_number: '',
  tax_number: '',
  email: '',
  phone: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  country: 'Namibia',
  website: '',
  wants_marketing_website: false,
  website_template: 'modern',
  website_description: '',
  website_emails: [],
  social_media_links: {
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: ''
  },
  domain: '',
  domain_extension: '.com',
  logo_url: '',
  primary_color: '#01b9d4',
  secondary_color: '#3b82f6',
  subscription_tier: 'standard',
  max_users: 10,
  max_patients: 1000,
  is_follow_up_automation_enabled: true,
  sms_limit: 2000,
  sms_used: 0,
  average_patients_per_day: 20,
  expected_sms_per_patient: 2,
  telemedicine_enabled: false,
  telemedicine_monthly_calls: 30,
  google_ads_enabled: false,
  google_ads_budget: 500,
  seo_optimization_enabled: false,
  social_media_management_enabled: false,
  selected_automations: [],
  number_of_branches: 1,
  additional_branches: 0,
  branch_names: ['Main Branch'],
  professional_emails: [],
  professional_email_count: 0,
  email_addresses: [],
  marketing_budget: 0,
  facebook_url: '',
  twitter_url: '',
  instagram_url: '',
  linkedin_url: '',
  admin_name: '',
  admin_email: '',
  admin_phone: '',
  admin_password: '',
  admin_hpcsa_number: '',
  admin_role: 'admin',
  admin_job_title: '',
  additional_staff: []
})

// Format currency display
export const formatCurrency = (amount: number): string => {
  return `N$${amount.toLocaleString()}`
}

// Validate required fields for each step
export const validateFormStep = (step: number, formData: PracticeFormData): boolean => {
  switch (step) {
    case 1:
      return !!(formData.name && formData.practice_type)
    case 2:
      return !!(formData.email && formData.phone && formData.address && formData.city)
    case 3:
      return !!(formData.domain && formData.primary_color && formData.secondary_color)
    case 4:
      return true // Website step is optional
    case 5:
      return !!(formData.admin_name && formData.admin_email && formData.admin_phone && formData.admin_password)
    case 6:
      return true // Features step is optional
    case 7:
      return true // Review step
    default:
      return false
  }
}

// Clean domain name input
export const cleanDomainName = (domain: string): string => {
  return domain.toLowerCase().replace(/[^a-z0-9-]/g, '')
}