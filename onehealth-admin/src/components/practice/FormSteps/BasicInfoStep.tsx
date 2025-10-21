import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { PRACTICE_TYPES } from '../../../constants/practice.constants'

interface BasicInfoStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function BasicInfoStep({ formData, setFormData }: BasicInfoStepProps) {
  return (
    <div className="space-y-6">
      {/* Practice Information Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:buildings-3-bold-duotone" className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Practice Information</h3>
            <p className="text-sm text-gray-500">Basic details about the healthcare practice</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-red-50 p-4 rounded-lg border border-blue-200 mb-6">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
            Getting Started
          </h4>
          <p className="text-sm text-blue-700">
            💡 <strong>Tip:</strong> Enter your practice information exactly as it appears on official documents. This ensures consistency across all your patient communications and legal documents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Name *
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 This appears on patient invoices, appointment confirmations, and all communications
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:buildings-3-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-red-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Enter practice name"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Type *
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Select the type that best matches your primary healthcare services
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-red-500 group-hover:text-gray-700" />
                </div>
                <select
                  value={formData.practice_type}
                  onChange={(e) => setFormData({ ...formData, practice_type: e.target.value as any })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  {PRACTICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Brief description that helps patients understand your practice specialties
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-4 z-10 pointer-events-none">
                  <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-red-500 group-hover:text-gray-700" />
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500 resize-none"
                  placeholder="Brief description of the practice"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registration Number
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Your official healthcare practice registration number (required for compliance)
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:document-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-red-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Practice registration number"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Number
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 VAT/Tax number for invoicing and financial record keeping
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:calculator-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-red-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="text"
                  value={formData.tax_number}
                  onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Tax/VAT number"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}