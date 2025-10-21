import React from 'react'
import { Icon } from '@iconify/react'
import type { PracticeFormData  } from '../../../types/practice.types'
import { ADMIN_ROLES, STAFF_ROLES } from '../../../constants/practice.constants'

interface StaffStepProps {
  formData: PracticeFormData
  setFormData: (data: PracticeFormData) => void
}

export function StaffStep({ formData, setFormData }: StaffStepProps) {
  const handleAddStaff = () => {
    const newStaff = {
      full_name: '',
      email: '',
      role: 'receptionist' as const,
      phone: '',
      hpcsa_number: '',
      staff_title: '',
      password: ''
    }
    setFormData({
      ...formData,
      additional_staff: [...formData.additional_staff, newStaff]
    })
  }

  const handleRemoveStaff = (index: number) => {
    const updatedStaff = formData.additional_staff.filter((_, i) => i !== index)
    setFormData({ ...formData, additional_staff: updatedStaff })
  }

  const handleStaffChange = (index: number, field: string, value: string) => {
    const updatedStaff = [...formData.additional_staff]
    ;(updatedStaff[index] as any)[field] = value
    setFormData({ ...formData, additional_staff: updatedStaff })
  }

  return (
    <div className="space-y-6">
      {/* Staff & Administration Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Staff & Administration</h3>
            <p className="text-sm text-gray-500">Setup your practice administrator and team members</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 mb-6">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
            Practice Administrator Setup
          </h4>
          <p className="text-sm text-blue-700">
            💡 <strong>Important:</strong> This person will have full access to manage your practice, staff, and patients. Choose someone who will be responsible for day-to-day operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:user-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="text"
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Manager's full name"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="manager@example.com"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="tel"
                  value={formData.admin_phone}
                  onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="+264 xx xxx xxxx"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:shield-user-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <select
                  value={formData.admin_role}
                  onChange={(e) => setFormData({ ...formData, admin_role: e.target.value as any })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  {ADMIN_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
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
              Job Title
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="text"
                  value={formData.admin_job_title}
                  onChange={(e) => setFormData({ ...formData, admin_job_title: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Practice Manager, Medical Director, etc."
                />
              </div>
            </div>
          </div>

          {formData.admin_role === 'doctor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HPCSA Number
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                  </div>
                  <input
                    type="text"
                    value={formData.admin_hpcsa_number || ''}
                    onChange={(e) => setFormData({ ...formData, admin_hpcsa_number: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                    placeholder="Medical license number"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
              <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:lock-password-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-purple-500 group-hover:text-gray-700" />
                </div>
                <input
                  type="password"
                  value={formData.admin_password}
                  onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                  placeholder="Create secure password"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Staff Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Additional Staff</h3>
              <p className="text-sm text-gray-500">Add doctors, nurses, and other staff members</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddStaff}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <Icon icon="solar:user-plus-bold-duotone" className="w-4 h-4" />
            Add Staff
          </button>
        </div>

        {formData.additional_staff.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No additional staff added yet</p>
            <p className="text-sm">Click "Add Staff" to add doctors, nurses, and other team members</p>
          </div>
        ) : (
          <div className="space-y-6">
            {formData.additional_staff.map((staff, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-900">Staff Member #{index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaff(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:user-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <input
                          type="text"
                          value={staff.full_name}
                          onChange={(e) => handleStaffChange(index, 'full_name', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                          placeholder="Staff member's name"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <input
                          type="email"
                          value={staff.email}
                          onChange={(e) => handleStaffChange(index, 'email', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                          placeholder="staff@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:shield-user-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <select
                          value={staff.role}
                          onChange={(e) => handleStaffChange(index, 'role', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                        >
                          {STAFF_ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
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
                      Phone
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <input
                          type="tel"
                          value={staff.phone || ''}
                          onChange={(e) => handleStaffChange(index, 'phone', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                          placeholder="+264 xx xxx xxxx"
                        />
                      </div>
                    </div>
                  </div>

                  {staff.role === 'doctor' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        HPCSA Number
                      </label>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                        <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                            <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                          </div>
                          <input
                            type="text"
                            value={staff.hpcsa_number || ''}
                            onChange={(e) => handleStaffChange(index, 'hpcsa_number', e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                            placeholder="Medical license number"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Title
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:bookmark-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <input
                          type="text"
                          value={staff.staff_title || ''}
                          onChange={(e) => handleStaffChange(index, 'staff_title', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                          placeholder="e.g. Senior Nurse, Practice Manager"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300"></div>
                      <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-all duration-200 group-hover:bg-gray-100">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <Icon icon="solar:lock-keyhole-bold-duotone" className="w-5 h-5 transition-colors duration-300 text-emerald-500 group-hover:text-gray-700" />
                        </div>
                        <input
                          type="password"
                          value={staff.password}
                          onChange={(e) => handleStaffChange(index, 'password', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-transparent border-0 rounded-xl focus:ring-0 focus:outline-none placeholder-gray-500"
                          placeholder="Secure password"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}