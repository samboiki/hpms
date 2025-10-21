import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { WEBSITE_TEMPLATES } from '../../../constants/practice.constants'

interface WebsiteStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function WebsiteStep({ formData, setFormData }: WebsiteStepProps) {
  return (
    <div className="space-y-6">
      {/* Website & Marketing Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:global-bold-duotone" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Website & Marketing</h3>
            <p className="text-sm text-gray-500">Online presence and marketing website setup</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Existing Website (Optional)
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:global-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-blue-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="https://www.yourexistingsite.com"
                />
              </div>
            </div>
          </div>

          {/* Premium Marketing Website Toggle */}
          <div className="md:col-span-2 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-dashed border-purple-200 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="wants_marketing_website"
                  checked={formData.wants_marketing_website}
                  onChange={(e) => setFormData({ ...formData, wants_marketing_website: e.target.checked })}
                  className="w-5 h-5 text-purple-600 bg-white border-2 border-purple-300 rounded focus:ring-purple-500 focus:ring-2"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="wants_marketing_website" className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="solar:crown-bold-duotone" className="w-5 h-5 text-purple-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Premium Marketing Website</h4>
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">Select in Pricing</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Get a professional marketing website designed specifically for your practice.
                    Includes patient booking, services showcase, and SEO optimization.
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-current" />
                      <span>Mobile Responsive</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-current" />
                      <span>SEO Ready</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-current" />
                      <span>Online Booking</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {formData.wants_marketing_website && (
            <>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website Template
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {WEBSITE_TEMPLATES.map((template) => (
                    <div
                      key={template}
                      onClick={() => setFormData({ ...formData, website_template: template })}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.website_template === template
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="aspect-video bg-gray-100 rounded-lg mb-3"></div>
                      <h4 className="font-medium text-gray-900 capitalize">{template}</h4>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website Description
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                  <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                    <textarea
                      value={formData.website_description}
                      onChange={(e) => setFormData({ ...formData, website_description: e.target.value })}
                      className="w-full p-4 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                      rows={3}
                      placeholder="Describe your practice and services for the website..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}