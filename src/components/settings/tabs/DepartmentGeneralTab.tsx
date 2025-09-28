import React from 'react';
import { Icon } from '@iconify/react';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../../ui/PremiumInput';

interface DepartmentGeneralTabProps {
  isEditing: boolean;
  editFormData: any;
  selectedDepartment: any;
  practiceStaff: any[];
  selectedHeadUser: any;
  departmentColors: Array<{
    name: string;
    value: string;
    gradient: string;
  }>;
  onEditClick: () => void;
  onCancelClick: () => void;
  onSaveClick: () => void;
  onEditFormDataChange: (data: any) => void;
  onHeadUserChange: (user: any) => void;
}

const DepartmentGeneralTab: React.FC<DepartmentGeneralTabProps> = ({
  isEditing,
  editFormData,
  selectedDepartment,
  practiceStaff,
  selectedHeadUser,
  departmentColors,
  onEditClick,
  onCancelClick,
  onSaveClick,
  onEditFormDataChange,
  onHeadUserChange,
}) => {
  return (
    <div className="p-6 space-y-6">
      {/* Header Section with White Background - Always visible */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
              <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                General Information
              </h3>
              <p className="text-sm text-gray-600">Department details and configuration</p>
            </div>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={onCancelClick}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={onSaveClick}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
              >
                <Icon icon="solar:diskette-bold-duotone" className="w-4 h-4" />
                Save Department
              </button>
            </div>
          ) : (
            <button
              onClick={onEditClick}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200"
            >
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
              Edit Department
            </button>
          )}
        </div>
      </div>

      {/* Content Section - Shows based on isEditing */}
      {isEditing ? (
        <div className="space-y-6">
          {/* Department Information Section - White Background */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
                <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-800">Department Information</h3>
                <p className="text-sm text-gray-600">Basic department details and configuration</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department Name</label>
                <PremiumInput
                  type="text"
                  value={editFormData?.department_name || editFormData?.name || ''}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    department_name: e.target.value,
                    name: e.target.value
                  })}
                  placeholder="e.g., Emergency Department"
                  icon="solar:hospital-bold-duotone"
                  iconColor="text-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department Code</label>
                <PremiumInput
                  type="text"
                  value={editFormData?.department_code || editFormData?.code || ''}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    department_code: e.target.value,
                    code: e.target.value
                  })}
                  placeholder="e.g., MED-01"
                  icon="solar:code-bold-duotone"
                  iconColor="text-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <PremiumTextarea
                  value={editFormData?.description || ''}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    description: e.target.value
                  })}
                  placeholder="Department description..."
                  rows={3}
                  icon="solar:document-text-bold-duotone"
                  iconColor="text-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <PremiumSelect
                  value={editFormData?.is_active ? 'active' : 'inactive'}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    is_active: e.target.value === 'active'
                  })}
                  icon="solar:shield-check-bold-duotone"
                  iconColor="text-green-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </PremiumSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department Color Theme</label>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-5 gap-3">
                    {departmentColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => onEditFormDataChange({
                          ...editFormData,
                          color: color.value
                        })}
                        className={`relative group transition-all duration-200 ${
                          editFormData?.color === color.value
                            ? 'scale-105'
                            : 'hover:scale-105'
                        }`}
                        title={color.name}
                      >
                        <div
                          className={`h-12 rounded-lg bg-gradient-to-br ${color.gradient} transition-all duration-200 ${
                            editFormData?.color === color.value
                              ? 'ring-2 ring-offset-2 ring-purple-500 shadow-lg'
                              : 'hover:shadow-md'
                          }`}
                        >
                          {editFormData?.color === color.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white rounded-full p-1">
                                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-purple-600" />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs mt-1 text-center font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {color.name}
                        </p>
                      </button>
                    ))}
                  </div>
                  {editFormData?.color && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Selected:</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md border-2 border-gray-200 shadow-sm"
                            style={{ backgroundColor: editFormData.color }}
                          />
                          <span className="text-sm font-semibold text-gray-700">
                            {departmentColors.find(c => c.value === editFormData.color)?.name || 'Custom'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditFormDataChange({ ...editFormData, color: undefined })}
                        className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information Section - White Background */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
                <p className="text-sm text-gray-600">Department head and contact details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Department Head</label>
                <PremiumSelect
                  value={editFormData?.head_user_id || ''}
                  onChange={(e) => {
                    const selectedStaff = practiceStaff.find(s => s.id === e.target.value);
                    onEditFormDataChange({
                      ...editFormData,
                      head_user_id: e.target.value,
                      head_of_department: selectedStaff?.full_name
                    });
                    onHeadUserChange(selectedStaff || null);
                  }}
                  icon="solar:user-bold-duotone"
                  iconColor="text-purple-500"
                >
                  <option value="">Select department head...</option>
                  {practiceStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} {staff.job_title || staff.role ? `- ${staff.job_title || staff.role}` : ''}
                    </option>
                  ))}
                </PremiumSelect>
                {selectedHeadUser && (
                  <div className="mt-2 p-3 bg-purple-50 rounded-lg flex items-center gap-3">
                    {selectedHeadUser.avatar ? (
                      <img
                        src={selectedHeadUser.avatar}
                        alt={selectedHeadUser.full_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                        <Icon icon="solar:user-bold-duotone" className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedHeadUser.full_name}</p>
                      <p className="text-xs text-gray-600">{selectedHeadUser.job_title || selectedHeadUser.role}</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <PremiumInput
                  type="email"
                  value={editFormData?.contact_email || ''}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    contact_email: e.target.value
                  })}
                  placeholder="department@example.com"
                  icon="solar:letter-bold-duotone"
                  iconColor="text-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <PremiumInput
                  type="tel"
                  value={editFormData?.contact_phone || ''}
                  onChange={(e) => onEditFormDataChange({
                    ...editFormData,
                    contact_phone: e.target.value
                  })}
                  placeholder="+1234567890"
                  icon="solar:phone-bold-duotone"
                  iconColor="text-green-500"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Department Information Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
                <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-800">Department Information</h3>
                <p className="text-sm text-gray-600">Basic department details and configuration</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Department Name with Color */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          background: `linear-gradient(135deg, ${selectedDepartment?.color || '#30b4be'}20, ${selectedDepartment?.color || '#2a9da6'}20)`
                        }}
                      >
                        <Icon
                          icon="solar:hospital-bold-duotone"
                          className="w-4 h-4"
                          style={{ color: selectedDepartment?.color || '#30b4be' }}
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">Department Name</span>
                        <p className="text-xs text-gray-600">{selectedDepartment?.name || selectedDepartment?.department_name}</p>
                        {selectedDepartment?.color && (
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-5 h-5 rounded-md border-2 border-gray-200 shadow-sm"
                              style={{ backgroundColor: selectedDepartment.color }}
                            />
                            <span className="text-xs font-medium text-gray-600">
                              {departmentColors.find(c => c.value === selectedDepartment.color)?.name || selectedDepartment.color}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Department Code */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                        <Icon icon="solar:code-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">Department Code</span>
                        <p className="text-xs text-gray-600">{selectedDepartment?.code || selectedDepartment?.department_code || 'Not set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                          <Icon icon="solar:document-text-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Description</span>
                      </div>
                      <p className="text-xs text-gray-600">{selectedDepartment?.description || 'No description'}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                          <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Status</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          selectedDepartment?.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedDepartment?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
                <p className="text-sm text-gray-600">Department head and contact details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Head of Department */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      {selectedDepartment?.head_user_id ? (
                        <>
                          {(() => {
                            const headUser = practiceStaff.find(s => s.id === selectedDepartment.head_user_id);
                            return headUser?.avatar ? (
                              <img
                                src={headUser.avatar}
                                alt={headUser.full_name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                                <Icon icon="solar:user-bold-duotone" className="w-6 h-6 text-white" />
                              </div>
                            );
                          })()}
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-900">Head of Department</span>
                            <p className="text-xs text-gray-600">
                              {practiceStaff.find(s => s.id === selectedDepartment.head_user_id)?.full_name || 'Not assigned'}
                            </p>
                            {practiceStaff.find(s => s.id === selectedDepartment.head_user_id)?.job_title && (
                              <p className="text-xs text-gray-500">
                                {practiceStaff.find(s => s.id === selectedDepartment.head_user_id)?.job_title}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                            <Icon icon="solar:user-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-900">Head of Department</span>
                            <p className="text-xs text-gray-600">Not assigned</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                        <Icon icon="solar:letter-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">Email</span>
                        <p className="text-xs text-gray-600">{selectedDepartment?.contact_email || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                        <Icon icon="solar:phone-bold-duotone" className="w-4 h-4" style={{ color: '#30b4be' }} />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">Phone</span>
                        <p className="text-xs text-gray-600">{selectedDepartment?.contact_phone || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentGeneralTab;