import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { DOMAIN_EXTENSIONS } from '../../../constants/practice.constants'
import { cleanDomainName } from '../../../utils/practice.utils'

interface BrandingStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function BrandingStep({ formData, setFormData }: BrandingStepProps) {
  return (
    <div className="space-y-6">
      {/* Branding & Domain Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
            <p className="text-sm text-gray-500">Visual identity and domain configuration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Domain
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:global-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-orange-500 group-hover:text-gray-700" />
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: cleanDomainName(e.target.value) })}
                    className="flex-1 pl-12 pr-2 py-3 bg-transparent border-0 rounded-l-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="mypractice"
                    required
                  />
                  <select
                    value={formData.domain_extension}
                    onChange={(e) => setFormData({ ...formData, domain_extension: e.target.value })}
                    className="px-3 py-3 bg-gray-300 group-hover:bg-gray-200 text-gray-700 rounded-r-xl transition-colors duration-300 border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer min-w-[100px]"
                  >
                    {DOMAIN_EXTENSIONS.map((ext) => (
                      <option key={ext} value={ext}>
                        {ext}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Your practice website: {formData.domain || 'mypractice'}{formData.domain_extension}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Logo
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div
                className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100 border-2 border-dashed border-gray-300 group-hover:border-purple-400 cursor-pointer"
                onClick={() => document.getElementById('logo-upload')?.click()}
              >
                <div className="p-6 text-center">
                  {formData.logo_url ? (
                    <div className="flex flex-col items-center space-y-4">
                      <img
                        src={formData.logo_url}
                        alt="Practice Logo"
                        className="w-24 h-24 object-contain rounded-lg bg-white p-2 border border-gray-200"
                      />
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFormData({ ...formData, logo_url: '' })
                          }}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            document.getElementById('logo-upload')?.click()
                          }}
                          className="px-3 py-1 text-sm text-orange-600 hover:text-orange-800 transition-colors"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-16 h-16 bg-gray-300 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                        <Icon icon="solar:gallery-bold-duotone" className="w-8 h-8 text-gray-500 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <div>
                        <span className="text-orange-600 hover:text-orange-800 font-medium transition-colors">
                          Click to Upload Logo
                        </span>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // In a real app, you'd upload to a service like Supabase Storage
                        // For now, we'll create a URL for preview
                        const url = URL.createObjectURL(file)
                        setFormData({ ...formData, logo_url: url })
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Upload your practice logo for branding</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Brand Color
            </label>
            <div className="flex space-x-3">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-12 border-0 rounded-xl cursor-pointer"
                    style={{ backgroundColor: formData.primary_color }}
                  />
                </div>
              </div>
              <div className="relative group flex-1">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-orange-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="#01b9d4"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Brand Color
            </label>
            <div className="flex space-x-3">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-12 border-0 rounded-xl cursor-pointer"
                    style={{ backgroundColor: formData.secondary_color }}
                  />
                </div>
              </div>
              <div className="relative group flex-1">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-orange-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 md:col-span-2">
            <h4 className="font-medium text-gray-900 mb-3">Brand Preview</h4>
            <div className="flex items-center space-x-4">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Practice Logo"
                  className="w-16 h-16 rounded-lg object-contain bg-white p-2 border border-gray-200"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: formData.primary_color }}
                >
                  {formData.name.slice(0, 2).toUpperCase() || 'MP'}
                </div>
              )}
              <div>
                <h5 className="font-semibold text-gray-900">{formData.name || 'My Practice'}</h5>
                <p className="text-sm text-gray-600">{formData.domain || 'mypractice'}{formData.domain_extension}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: formData.primary_color }}></div>
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: formData.secondary_color }}></div>
                  <span className="text-xs text-gray-500">Brand Colors</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}