import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'

interface ReviewStepProps {
  formData: PracticeFormData
}

export function ReviewStep({ formData }: ReviewStepProps) {
  // Calculate pricing
  const basePrice = 1600
  const branchPrice = 1000
  const websiteHosting = formData.wants_marketing_website ? 300 : 0
  const emailPrice = 150
  const marketingBudget = formData.marketing_budget || 0

  const totalBranches = (formData.number_of_branches || 1) - 1 // First branch is included
  const branchesCost = totalBranches * branchPrice
  const emailsCost = (formData.professional_email_count || 0) * emailPrice

  const totalMonthly = basePrice + branchesCost + websiteHosting + emailsCost + marketingBudget

  return (
    <div className="space-y-6">
      {/* Review & Confirm Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:clipboard-check-bold-duotone" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Review & Confirm</h3>
            <p className="text-sm text-gray-500">Final review of all practice information</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Icon icon="solar:buildings-2-bold-duotone" className="w-4 h-4" />
                Practice Information
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">Name:</span> {formData.name}</div>
                <div><span className="text-gray-600">Type:</span> {formData.practice_type.replace('_', ' ')}</div>
                <div><span className="text-gray-600">Email:</span> {formData.email}</div>
                <div><span className="text-gray-600">Phone:</span> {formData.phone}</div>
                <div><span className="text-gray-600">Location:</span> {formData.city}, {formData.country}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Icon icon="solar:user-bold-duotone" className="w-4 h-4" />
                Administrator
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">Name:</span> {formData.admin_name}</div>
                <div><span className="text-gray-600">Email:</span> {formData.admin_email}</div>
                <div><span className="text-gray-600">Phone:</span> {formData.admin_phone}</div>
                <div><span className="text-gray-600">Role:</span> {formData.admin_role}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Icon icon="solar:palette-bold-duotone" className="w-4 h-4" />
                Branding & Website
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">Domain:</span> {formData.domain}{formData.domain_extension}</div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Colors:</span>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: formData.primary_color }}></div>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: formData.secondary_color }}></div>
                </div>
                <div><span className="text-gray-600">Marketing Website:</span> {formData.wants_marketing_website ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Icon icon="solar:buildings-bold-duotone" className="w-4 h-4" />
                Branches & Services
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Branches ({formData.number_of_branches || 1}):</span>
                  <ul className="ml-4 mt-1 text-xs text-gray-500">
                    {(formData.branch_names || ['Main Branch']).slice(0, formData.number_of_branches || 1).map((name, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
                {(formData.professional_email_count || 0) > 0 && (
                  <div>
                    <span className="text-gray-600">Email Addresses:</span>
                    <ul className="ml-4 mt-1 text-xs text-gray-500">
                      {(formData.email_addresses || []).slice(0, formData.professional_email_count).map((email, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <Icon icon="solar:letter-bold" className="w-3 h-3" />
                          {email || `email${idx + 1}@practice.com`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div><span className="text-gray-600">Marketing Budget:</span> N${formData.marketing_budget || 0}</div>
              </div>
            </div>
          </div>

          {/* Pricing Summary with Green Theme */}
          <div className="p-6 rounded-xl border bg-white" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <h4 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'rgba(16, 185, 129, 0.9)' }}>
              <Icon icon="solar:calculator-minimalistic-bold-duotone" className="w-5 h-5" />
              Monthly Investment Summary
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Base Platform</span>
                <div className="font-semibold text-lg">
                  <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                  <span style={{ color: 'rgb(16, 185, 129)' }}>{basePrice.toLocaleString()}</span>
                </div>
              </div>
              {totalBranches > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">Additional Branches ({totalBranches} × N${branchPrice})</span>
                  <div className="font-semibold text-lg">
                    <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                    <span style={{ color: 'rgb(16, 185, 129)' }}>{branchesCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {websiteHosting > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">Website Hosting</span>
                  <div className="font-semibold text-lg">
                    <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                    <span style={{ color: 'rgb(16, 185, 129)' }}>{websiteHosting.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {emailsCost > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">Professional Emails ({formData.professional_email_count} × N${emailPrice})</span>
                  <div className="font-semibold text-lg">
                    <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                    <span style={{ color: 'rgb(16, 185, 129)' }}>{emailsCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {marketingBudget > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">Marketing Budget</span>
                  <div className="font-semibold text-lg">
                    <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                    <span style={{ color: 'rgb(16, 185, 129)' }}>{marketingBudget.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t-2" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                <span className="text-xl font-bold" style={{ color: 'rgba(16, 185, 129, 0.9)' }}>Total Monthly Investment</span>
                <div className="font-bold text-3xl">
                  <span style={{ color: 'rgb(16, 185, 129)' }}>N$</span>
                  <span style={{ color: 'rgb(16, 185, 129)' }}>{Math.floor(totalMonthly)}</span>
                  <span style={{ color: 'rgba(16, 185, 129, 0.6)' }}>.{(totalMonthly % 1).toFixed(2).slice(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-gray-700">
                💡 <strong>What you get:</strong> Complete healthcare practice management system with patient records,
                appointments, billing, staff management, and all selected services.
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-start space-x-3">
              <Icon icon="solar:warning-bold-duotone" className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Review Information</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Please review all information carefully. Once submitted, you'll need to contact support to make changes to core practice details.
                  Your practice will be created immediately upon submission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}