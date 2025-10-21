import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData } from '../../../types/practice.types'

interface PricingStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function PricingStep({ formData, setFormData }: PricingStepProps) {
  // Initialize branch names if not present
  const branchNames = formData.branch_names || ['Main Branch']
  const emailAddresses = formData.email_addresses || []

  const updateBranchCount = (count: number) => {
    const currentNames = formData.branch_names || ['Main Branch']
    let newNames = [...currentNames]

    if (count > currentNames.length) {
      // Add new branches
      for (let i = currentNames.length; i < count; i++) {
        newNames.push(`Branch ${i + 1}`)
      }
    } else {
      // Remove branches
      newNames = currentNames.slice(0, count)
    }

    setFormData({
      ...formData,
      number_of_branches: count,
      branch_names: newNames
    })
  }

  const updateBranchName = (index: number, name: string) => {
    const names = [...(formData.branch_names || ['Main Branch'])]
    names[index] = name
    setFormData({ ...formData, branch_names: names })
  }

  const updateEmailCount = (count: number) => {
    const currentEmails = formData.email_addresses || []
    let newEmails = [...currentEmails]

    if (count > currentEmails.length) {
      // Add new emails
      for (let i = currentEmails.length; i < count; i++) {
        newEmails.push('')
      }
    } else {
      // Remove emails
      newEmails = currentEmails.slice(0, count)
    }

    setFormData({
      ...formData,
      professional_email_count: count,
      email_addresses: newEmails
    })
  }

  const updateEmailAddress = (index: number, email: string) => {
    const emails = [...(formData.email_addresses || [])]
    emails[index] = email
    setFormData({ ...formData, email_addresses: emails })
  }

  return (
    <div className="space-y-6">
      {/* Main Container */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-100">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Service Selection</h3>
            <p className="text-sm text-gray-500">Choose the services your practice needs</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Base Package - Always included */}
          <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 p-5 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">OneHealth Base Platform</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Complete practice management system</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-gray-500">N$</span>
                  <span className="text-2xl font-bold text-green-600">1,600</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">per month</p>
              </div>
            </div>
          </div>

          {/* Branches Section */}
          <div className="bg-gray-50 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:buildings-bold-duotone" className="w-5 h-5 text-gray-700" />
                <h4 className="font-medium text-gray-900">Practice Branches</h4>
              </div>
              <span className="text-sm text-gray-500">N$1,000 per additional branch</span>
            </div>

            <div className="space-y-4">
              {/* Quick Select Buttons */}
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => updateBranchCount(num)}
                    className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                      (formData.number_of_branches || 1) === num
                        ? 'border-green-500 bg-white text-green-700 shadow-sm'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Or enter custom:</span>
                <input
                  type="number"
                  value={formData.number_of_branches || 1}
                  onChange={(e) => updateBranchCount(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  min="1"
                  max="100"
                />
                <span className="text-sm text-gray-600">branches</span>
                {(formData.number_of_branches || 1) > 1 && (
                  <span className="ml-auto text-sm font-semibold text-green-600">
                    +N${((formData.number_of_branches || 1) - 1) * 1000}/month
                  </span>
                )}
              </div>

              {/* Branch Names */}
              {(formData.number_of_branches || 1) > 0 && (
                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Branch Names:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: formData.number_of_branches || 1 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Icon
                          icon="solar:map-point-bold-duotone"
                          className={`w-4 h-4 ${index === 0 ? 'text-green-600' : 'text-gray-400'}`}
                        />
                        <input
                          type="text"
                          value={branchNames[index] || `Branch ${index + 1}`}
                          onChange={(e) => updateBranchName(index, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder={index === 0 ? "Main Branch" : `Branch ${index + 1}`}
                        />
                        {index === 0 && (
                          <span className="text-xs text-green-600 font-medium">Included</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Website Section */}
          <div className="bg-gray-50 p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon icon="solar:global-bold-duotone" className="w-5 h-5 text-gray-700" />
                <div>
                  <h4 className="font-medium text-gray-900">Professional Website</h4>
                  <p className="text-sm text-gray-500 mt-0.5">Custom website development & hosting</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-green-600">N$300/month</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.wants_marketing_website}
                    onChange={(e) => setFormData({ ...formData, wants_marketing_website: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Email Section */}
          <div className="bg-gray-50 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-gray-700" />
                <div>
                  <h4 className="font-medium text-gray-900">Professional Email Addresses</h4>
                  <p className="text-sm text-gray-500 mt-0.5">Business email @yourpractice.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">N$150 each</span>
                <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300">
                  <button
                    type="button"
                    onClick={() => updateEmailCount(Math.max(0, (formData.professional_email_count || 0) - 1))}
                    className="p-2 hover:bg-gray-100 transition-colors rounded-l-lg"
                  >
                    <Icon icon="solar:minus-bold" className="w-4 h-4 text-gray-600" />
                  </button>
                  <input
                    type="number"
                    value={formData.professional_email_count || 0}
                    onChange={(e) => updateEmailCount(parseInt(e.target.value) || 0)}
                    className="w-12 text-center font-medium focus:outline-none"
                    min="0"
                    max="50"
                  />
                  <button
                    type="button"
                    onClick={() => updateEmailCount((formData.professional_email_count || 0) + 1)}
                    className="p-2 hover:bg-gray-100 transition-colors rounded-r-lg"
                  >
                    <Icon icon="solar:add-bold" className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                {(formData.professional_email_count || 0) > 0 && (
                  <span className="text-sm font-semibold text-green-600">
                    N${(formData.professional_email_count || 0) * 150}/mo
                  </span>
                )}
              </div>
            </div>

            {/* Email Address Inputs */}
            {(formData.professional_email_count || 0) > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Email Addresses:</p>
                <div className="space-y-2">
                  {Array.from({ length: formData.professional_email_count || 0 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Icon icon="solar:letter-unread-bold-duotone" className="w-4 h-4 text-blue-500" />
                      <input
                        type="email"
                        value={emailAddresses[index] || ''}
                        onChange={(e) => updateEmailAddress(index, e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder={`admin${index + 1}@yourpractice.com`}
                      />
                      <span className="text-xs text-gray-500">N$150/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Marketing Budget Section */}
          <div className="bg-gray-50 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-gray-700" />
                <h4 className="font-medium text-gray-900">Marketing Budget</h4>
              </div>
              <span className="text-sm text-gray-500">Monthly advertising spend</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                {[0, 500, 1000, 2000, 5000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setFormData({ ...formData, marketing_budget: amount })}
                    className={`px-4 py-2 rounded-lg border font-medium transition-all text-sm ${
                      (formData.marketing_budget || 0) === amount
                        ? 'border-green-500 bg-white text-green-700 shadow-sm'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {amount === 0 ? 'None' : `N$${amount.toLocaleString()}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-gray-600">Custom:</span>
                <input
                  type="number"
                  value={formData.marketing_budget || 0}
                  onChange={(e) => setFormData({ ...formData, marketing_budget: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>
          </div>

          {/* Total Section - Prominent */}
          <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/90 text-sm font-medium">Monthly Total</p>
                <p className="text-white/70 text-xs mt-1">All services included</p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-white/90 text-lg">N$</span>
                  <span className="text-white text-4xl font-bold">
                    {(
                      1600 +
                      ((formData.number_of_branches || 1) - 1) * 1000 +
                      (formData.wants_marketing_website ? 300 : 0) +
                      (formData.professional_email_count || 0) * 150 +
                      (formData.marketing_budget || 0)
                    ).toLocaleString()}
                  </span>
                </div>
                <p className="text-white/70 text-sm mt-1">per month</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}