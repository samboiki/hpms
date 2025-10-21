import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { AUTOMATION_TEMPLATES, SUBSCRIPTION_TIERS } from '../../../constants/practice.constants'

interface FeaturesStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function FeaturesStep({ formData, setFormData }: FeaturesStepProps) {
  const toggleAutomation = (automationId: string) => {
    const isSelected = formData.selected_automations.includes(automationId)
    const newAutomations = isSelected
      ? formData.selected_automations.filter(id => id !== automationId)
      : [...formData.selected_automations, automationId]
    setFormData({ ...formData, selected_automations: newAutomations })
  }

  const handleAddProfessionalEmail = () => {
    const currentEmails = formData.professional_emails || []
    setFormData({
      ...formData,
      professional_emails: [...currentEmails, '']
    })
  }

  const handleRemoveProfessionalEmail = (index: number) => {
    const updatedEmails = (formData.professional_emails || []).filter((_, i) => i !== index)
    setFormData({ ...formData, professional_emails: updatedEmails })
  }

  const handleProfessionalEmailChange = (index: number, value: string) => {
    const updatedEmails = [...(formData.professional_emails || [])]
    updatedEmails[index] = value
    setFormData({ ...formData, professional_emails: updatedEmails })
  }

  return (
    <div className="space-y-6">
      {/* Pricing & Features Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pricing & Features</h3>
            <p className="text-sm text-gray-500">Configure your practice setup and pricing options</p>
          </div>
        </div>

        {/* Section 1: Basic Practice Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 font-bold text-sm">1</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Basic Practice Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subscription Tier
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:crown-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-indigo-500 group-hover:text-gray-700" />
                  </div>
                  <select
                    value={formData.subscription_tier}
                    onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                  >
                    {SUBSCRIPTION_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Users
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-indigo-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="Maximum number of users"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Patients
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:user-heart-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-indigo-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="number"
                    value={formData.max_patients}
                    onChange={(e) => setFormData({ ...formData, max_patients: parseInt(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="Maximum patient records"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly SMS Limit
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:chat-round-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-indigo-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="number"
                    value={formData.sms_limit}
                    onChange={(e) => setFormData({ ...formData, sms_limit: parseInt(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="SMS messages per month"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_follow_up_automation_enabled"
                  checked={formData.is_follow_up_automation_enabled}
                  onChange={(e) => setFormData({ ...formData, is_follow_up_automation_enabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_follow_up_automation_enabled" className="text-sm font-medium text-gray-700">
                  Enable follow-up automation
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Emails Section */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-bold text-sm">2</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Professional Email Addresses</h4>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h5 className="font-medium text-green-900 mb-2">📧 Professional Email Management</h5>
            <p className="text-sm text-green-700 mb-3">
              Get professional email addresses linked to your domain. Each email address costs <strong>N$50/month</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Addresses Needed
            </label>
            <div className="space-y-3">
              {formData.professional_emails?.map((email, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1 relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                    <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                        <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-green-500 group-hover:text-gray-700" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleProfessionalEmailChange(index, e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                        placeholder="admin@yourpractice.com"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProfessionalEmail(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                  </button>
                </div>
              )) || (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No email addresses added yet</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleAddProfessionalEmail}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
                Add Email
              </button>
            </div>
          </div>
        </div>

        {/* SMS Automation Features */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-700 font-bold text-sm">3</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">SMS Automation Features</h4>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <h5 className="font-medium text-purple-900 mb-2">🤖 Patient Communication Automation</h5>
            <p className="text-sm text-purple-700">
              Automate patient communication and save 4-5 hours/week. Each automation feature has individual pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUTOMATION_TEMPLATES.map((automation) => (
              <div
                key={automation.id}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  formData.selected_automations.includes(automation.id)
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50'
                }`}
                onClick={() => toggleAutomation(automation.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      automation.category === 'patient' ? 'bg-blue-50' :
                      automation.category === 'billing' ? 'bg-green-50' :
                      automation.category === 'clinical' ? 'bg-orange-50' :
                      'bg-gray-50'
                    }`}>
                      <Icon
                        icon={
                          automation.category === 'patient' ? 'solar:user-heart-bold-duotone' :
                          automation.category === 'billing' ? 'solar:bill-list-bold-duotone' :
                          automation.category === 'clinical' ? 'solar:health-bold-duotone' :
                          'solar:settings-bold-duotone'
                        }
                        className={`w-5 h-5 ${
                          automation.category === 'patient' ? 'text-blue-600' :
                          automation.category === 'billing' ? 'text-green-600' :
                          automation.category === 'clinical' ? 'text-orange-600' :
                          'text-gray-600'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{automation.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          automation.category === 'patient' ? 'bg-blue-100 text-blue-700' :
                          automation.category === 'billing' ? 'bg-green-100 text-green-700' :
                          automation.category === 'clinical' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {automation.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-600">N${automation.price}/month</span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      formData.selected_automations.includes(automation.id)
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-gray-300'
                    }`}>
                      {formData.selected_automations.includes(automation.id) && (
                        <Icon icon="solar:check-bold" className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">{automation.description}</p>

                <div className="flex items-center gap-4 text-xs">
                  {automation.requires_sms && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4" />
                      SMS
                    </div>
                  )}
                  {automation.requires_email && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Icon icon="solar:letter-bold-duotone" className="w-4 h-4" />
                      Email
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  💡 Saves: 4-5 hours/week on {automation.category} follow-ups
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}