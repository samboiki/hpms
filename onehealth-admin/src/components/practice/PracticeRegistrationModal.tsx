import React, { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../types/practice.types'
import { generateInitialFormData } from '../../utils/practice.utils'
import { supabase } from '../../lib/supabase'

// Form Steps
import { BasicInfoStep } from './FormSteps/BasicInfoStep'
import { ContactStep } from './FormSteps/ContactStep'
import { BrandingStep } from './FormSteps/BrandingStep'
import { WebsiteStep } from './FormSteps/WebsiteStep'
import { StaffStep } from './FormSteps/StaffStep'
import { PricingStep } from './FormSteps/PricingStep'
import { ReviewStep } from './FormSteps/ReviewStep'
import { StepIndicator } from './StepIndicator'
import { PracticeSuccessModal } from './PracticeSuccessModal'

interface PracticeRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  editMode?: boolean
  existingPractice?: any
}

export function PracticeRegistrationModal({ isOpen, onClose, onSuccess, editMode = false, existingPractice }: PracticeRegistrationModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PracticeFormData>(
    editMode && existingPractice
      ? {
          ...generateInitialFormData(),
          name: existingPractice.name || '',
          practice_type: existingPractice.practice_type || 'general_practice',
          registration_number: existingPractice.registration_number || '',
          tax_number: existingPractice.tax_number || '',
          email: existingPractice.email || existingPractice.contact_email || '',
          phone: existingPractice.phone || existingPractice.contact_phone || '',
          address: existingPractice.address || '',
          city: existingPractice.city || '',
          country: existingPractice.country || '',
          description: existingPractice.about_text || '',
          domain: existingPractice.domain || '',
          primary_color: existingPractice.primary_color || '#3b82f6',
          secondary_color: existingPractice.secondary_color || '#8b5cf6',
          number_of_branches: existingPractice.number_of_branches || 1,
          branch_names: existingPractice.branch_names || ['Main Branch'],
          professional_email_count: existingPractice.professional_email_count || 0,
          email_addresses: existingPractice.professional_email_addresses || [],
          marketing_budget: existingPractice.marketing_budget || 0,
          wants_marketing_website: existingPractice.website_hosting_enabled || false,
          contact_email: existingPractice.contact_email || '',
          contact_phone: existingPractice.contact_phone || ''
        }
      : generateInitialFormData()
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [registeredPractice, setRegisteredPractice] = useState<{
    name: string
    monthlyPremium: number
    numberOfBranches: number
    professionalEmails: number
  } | null>(null)

  // Add gradient animation styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes gradient {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const handleFormSubmit = async () => {
    try {
      setIsSubmitting(true)

      // Calculate pricing breakdown
      const basePrice = 1600
      const branchPrice = 1000
      const emailPrice = 150
      const websitePrice = 300

      const numberOfBranches = formData.number_of_branches || 1
      const branchesCost = (numberOfBranches - 1) * branchPrice
      const emailsCost = (formData.professional_email_count || 0) * emailPrice
      const websiteCost = formData.wants_marketing_website ? websitePrice : 0
      const marketingBudget = formData.marketing_budget || 0
      const totalMonthlyPremium = basePrice + branchesCost + emailsCost + websiteCost + marketingBudget

      // Generate slug from practice name
      const practiceSlug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      const practiceData = {
        name: formData.name,
        slug: practiceSlug,
        about_text: formData.description,
        practice_type: formData.practice_type,
        registration_number: formData.registration_number,
        tax_number: formData.tax_number,
        contact_email: formData.contact_email || formData.email,
        contact_phone: formData.contact_phone || formData.phone,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        domain: formData.domain,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        subscription_tier: 'standard',
        max_users: 10,
        max_patients: 1000,
        is_follow_up_automation_enabled: true,
        status: editMode ? existingPractice.status : 'lead',
        // Admin/Manager fields
        admin_name: formData.admin_name,
        admin_email: formData.admin_email,
        admin_phone: formData.admin_phone,
        admin_role: formData.admin_role,
        admin_job_title: formData.admin_job_title,
        admin_hpcsa_number: formData.admin_hpcsa_number,
        // New pricing fields
        number_of_branches: numberOfBranches,
        branch_names: formData.branch_names || ['Main Branch'],
        professional_email_count: formData.professional_email_count || 0,
        professional_email_addresses: formData.email_addresses || [],
        marketing_budget: marketingBudget,
        website_hosting_enabled: formData.wants_marketing_website || false,
        base_price: basePrice,
        branches_cost: branchesCost,
        website_cost: websiteCost,
        emails_cost: emailsCost,
        total_monthly_premium: totalMonthlyPremium
      }

      let practice
      let practiceError

      if (editMode && existingPractice) {
        // Update existing practice
        const result = await supabase
          .from('practices')
          .update(practiceData)
          .eq('id', existingPractice.id)
          .select()
          .single()
        practice = result.data
        practiceError = result.error
      } else {
        // Create new practice
        const result = await supabase
          .from('practices')
          .insert([practiceData])
          .select()
          .single()
        practice = result.data
        practiceError = result.error
      }

      if (practiceError) {
        throw practiceError
      }

      // Create branch records for each branch (only for new practices)
      if (!editMode) {
        const branchNames = formData.branch_names || ['Main Branch']
        const branchRecords = Array.from({ length: numberOfBranches }).map((_, index) => ({
          practice_id: practice.id,
          name: branchNames[index] || `Branch ${index + 1}`,
          slug: (branchNames[index] || `branch-${index + 1}`).toLowerCase().replace(/\s+/g, '-'),
          is_main_branch: index === 0,
          monthly_cost: index === 0 ? 0 : branchPrice, // First branch is included
          is_active: true
        }))

        const { error: branchError } = await supabase
          .from('branches')
          .insert(branchRecords)

        if (branchError) {
          console.error('Error creating branches:', branchError)
          // Continue anyway, don't fail the whole registration
        }
      }

      // Create SMS/Email subscriptions with default limits (only for new practices)
      if (!editMode) {
        await Promise.all([
          supabase.from('practice_sms_subscriptions').insert([{
            practice_id: practice.id,
            monthly_limit: 200,
            current_usage: 0
          }]),
          supabase.from('practice_email_subscriptions').insert([{
            practice_id: practice.id,
            monthly_limit: 500,
            current_usage: 0
          }])
        ])
      }

      // Store registration details and show success modal
      setRegisteredPractice({
        name: formData.name,
        monthlyPremium: totalMonthlyPremium,
        numberOfBranches: numberOfBranches,
        professionalEmails: formData.professional_email_count || 0
      })
      setShowSuccessModal(true)
      setCurrentStep(1)
      setFormData(generateInitialFormData())
      onSuccess?.()

    } catch (error) {
      console.error('Error registering practice:', error)
      alert('Error registering practice. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep formData={formData} setFormData={setFormData} />
      case 2:
        return <ContactStep formData={formData} setFormData={setFormData} />
      case 3:
        return <BrandingStep formData={formData} setFormData={setFormData} />
      case 4:
        return <WebsiteStep formData={formData} setFormData={setFormData} />
      case 5:
        return <StaffStep formData={formData} setFormData={setFormData} />
      case 6:
        return <PricingStep formData={formData} setFormData={setFormData} />
      case 7:
        return <ReviewStep formData={formData} />
      default:
        return null
    }
  }

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    setRegisteredPractice(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl w-full transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'max-w-none max-h-none h-full rounded-none'
          : 'max-w-6xl max-h-[90vh] rounded-2xl'
      }`}>
        {/* Fixed Header */}
        <div className="p-8 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold mb-2" style={{
                backgroundSize: '200% 200%',
                backgroundImage: 'linear-gradient(to right, rgb(168, 85, 247), rgb(236, 72, 153), rgb(59, 130, 246), rgb(168, 85, 247))',
                backgroundClip: 'text',
                color: 'transparent',
                backgroundPosition: '17.6765% 50%',
                animation: 'gradient 3s ease infinite'
              }}>
                <Icon icon={editMode ? "solar:pen-bold-duotone" : "solar:buildings-3-bold-duotone"} className="w-6 h-6 text-purple-600" />
                {editMode ? 'Edit Practice' : 'Register New Practice'}
              </h2>
              <p className="text-gray-600">Step {currentStep} of 7</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Maximize"}
              >
                <Icon
                  icon={isFullscreen ? "solar:minimize-bold-duotone" : "solar:maximize-bold-duotone"}
                  className="w-4 h-4"
                />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Close"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
              </button>
            </div>
          </div>

          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 pt-4">
            {renderFormStep()}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              {/* OneHealth Logo - Center */}
              <div className="flex justify-center -my-12">
                <a className="flex items-center group relative" href="/">
                  <div className="relative" tabIndex={0} style={{ transform: 'none' }}>
                    <div className="absolute -inset-x-6 inset-y-0 opacity-30 group-hover:opacity-40 transition-opacity duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-transparent to-blue-500 blur-2xl transform skew-x-12"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400 to-transparent blur-xl transform -skew-x-6"></div>
                    </div>
                    <img
                      alt="OneHealth"
                      loading="lazy"
                      width="600"
                      height="180"
                      decoding="async"
                      className="h-40 w-auto relative z-10"
                      src="/onehealthlogo-transparent.png"
                      style={{ color: 'transparent' }}
                    />
                  </div>
                </a>
              </div>

              {currentStep < 7 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Next
                  <Icon icon="solar:round-alt-arrow-right-bold-duotone" className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
                      {editMode ? 'Updating...' : 'Registering...'}
                    </>
                  ) : (
                    <>
                      <Icon icon={editMode ? "solar:check-circle-bold-duotone" : "solar:shield-check-bold-duotone"} className="w-5 h-5" />
                      {editMode ? 'Update Practice' : 'Register Practice'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Success Modal */}
      {registeredPractice && (
        <PracticeSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          practiceName={registeredPractice.name}
          monthlyPremium={registeredPractice.monthlyPremium}
          numberOfBranches={registeredPractice.numberOfBranches}
          professionalEmails={registeredPractice.professionalEmails}
        />
      )}
    </>
  )
}