import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { COUNTRIES } from '../../../constants/practice.constants'

interface ContactStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function ContactStep({ formData, setFormData }: ContactStepProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-current" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            <p className="text-sm text-gray-500">Communication details and practice location</p>
          </div>
        </div>

        <div className="p-4 rounded-lg border mb-6" style={{ background: 'linear-gradient(to right, rgba(48, 180, 190, 0.1), rgba(59, 130, 246, 0.1))', borderColor: 'rgba(48, 180, 190, 0.3)' }}>
          <h4 className="font-medium text-current mb-2 flex items-center gap-2">
            <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
            Communication Setup
          </h4>
          <p className="text-sm" style={{ color: 'rgba(48, 180, 190, 0.8)' }}>
            💡 <strong>Important:</strong> These contact details will be used for patient communications, appointment reminders, and system notifications. Ensure they're monitored regularly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Email *
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Main email for patient communications, system alerts, and reports
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="practice@example.com"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Phone *
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Main phone number for patient calls and appointment bookings
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="+264 xx xxx xxxx"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Alternative email for backup communications (optional)
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address *
              <span className="block text-xs text-gray-500 font-normal mt-1">
                💡 Complete physical address where patients visit your practice
              </span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-4 z-10 pointer-events-none">
                  <Icon icon="solar:map-point-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500 resize-none"
                  placeholder="Full practice address"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:city-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Windhoek"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:global-bold-duotone" className="w-5 h-5 transition-colors duration-300 group-hover:text-gray-700" style={{ color: 'rgb(48, 180, 190)' }} />
                </div>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}