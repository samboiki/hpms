import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { DepartmentSelectionModal } from './DepartmentSelectionModal';
import DateInput from '../../ui/DateInput';
import { formatRole } from './staffUtils';

interface AddUserModalProps {
  practiceId: string;
  onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creating a staff login needs the Supabase service-role key (auth.admin.inviteUserByEmail),
 * which must never be shipped to the browser. The previous auth.admin.createUser call used the
 * public key and always failed with "User not allowed". Until a server-side invite function
 * exists, this form validates the details and then fails clearly without creating anything.
 * Staff will set their own password from the invite email, so no password is collected here.
 */
const INVITES_UNAVAILABLE_MESSAGE =
  'Staff invitations need a secure server-side invite function, which has not been set up yet. ' +
  'No account was created. Please ask OneHealth support to create this login for now.';

export const AddUserModal: React.FC<AddUserModalProps> = ({ practiceId, onClose }) => {
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'receptionist',
    job_title: '',
    department: '',
    contact_number: '',
    address: '',
    employee_number: '',
    hpcsa_number: '',
    start_date: format(new Date(), 'yyyy-MM-dd')
  });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };
    
  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(formData.email.trim())) nextErrors.email = 'Enter a valid email address';
    if (!formData.full_name.trim()) nextErrors.full_name = 'Full name is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    if (!practiceId) {
      setSubmitError('Your practice could not be identified. Please refresh the page and try again.');
      return;
    }

    // When a server-side invite function exists, send the validated details to it here.
    setSubmitError(INVITES_UNAVAILABLE_MESSAGE);
    toast.error('Invite not sent: staff invitations are not set up yet');
  };

  const fieldClass = (field: string) =>
    `w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-gray-700 hover:bg-gray-200 ${
      errors[field] ? 'ring-2 ring-red-400 focus:ring-red-500' : 'focus:ring-purple-500'
    }`;

  const renderError = (field: string) =>
    errors[field] ? <p className="mt-1 text-sm text-red-600">{errors[field]}</p> : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon icon="solar:user-plus-bold-duotone" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{fontFamily: 'Poppins, sans-serif'}}>
                  Invite Staff Member
                </h2>
                <p className="text-purple-100 text-sm">They will set their own password from the invitation email</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              aria-label="Close"
              className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-white">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Staff invitations are not enabled yet</p>
                <p className="mt-1">
                  Creating a login requires a secure server-side invite function. Until it is set up, invites cannot
                  be sent from here and OneHealth support creates new logins. Existing staff can still be edited,
                  deactivated and managed as normal.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                <Icon icon="solar:danger-circle-bold-duotone" className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            {/* Account Information Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon icon="solar:user-bold-duotone" className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                  <p className="text-sm text-gray-500">Where the invitation will be sent</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:mail-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className={fieldClass('email')}
                      placeholder="user@example.com"
                    />
                  </div>
                  {renderError('email')}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:user-id-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => updateField('full_name', e.target.value)}
                      className={fieldClass('full_name')}
                      placeholder="John Doe"
                    />
                  </div>
                  {renderError('full_name')}
                </div>
              </div>
            </div>

            {/* Role & Department Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Icon icon="solar:crown-bold-duotone" className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Role & Department</h3>
                  <p className="text-sm text-gray-500">Define user role and organizational placement</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:shield-user-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => updateField('role', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                    >
                      {['receptionist', 'nurse', 'doctor', 'admin'].map(role => (
                        <option key={role} value={role}>{formatRole(role)}</option>
                      ))}
                    </select>
                  </div>
                  {formData.role === 'admin' && (
                    <p className="mt-1 text-xs text-amber-700">Administrators can manage staff, payroll and practice settings.</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title
                  </label>
                  <div className="relative">
                    <Icon icon="solar:case-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => updateField('job_title', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      placeholder="Senior Doctor"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Icon icon="solar:buildings-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                      <input
                        type="text"
                        value={formData.department}
                        readOnly
                        placeholder="Click to select department"
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200 cursor-pointer"
                        onClick={() => setShowDepartmentModal(true)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDepartmentModal(true)}
                      aria-label="Choose department"
                      className="px-4 py-3 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <Icon icon="solar:buildings-3-bold-duotone" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee Number
                  </label>
                  <div className="relative">
                    <Icon icon="solar:card-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      value={formData.employee_number}
                      onChange={(e) => updateField('employee_number', e.target.value)}
                      className={fieldClass('employee_number')}
                      placeholder="EMP001"
                    />
                  </div>
                  {renderError('employee_number')}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="add-hpcsa-number" className="block text-sm font-medium text-gray-700 mb-2">
                    Professional Registration No.
                    {(formData.role === 'doctor' || formData.role === 'nurse') && (
                      <span className="ml-2 text-xs font-normal text-gray-500">recommended for clinical staff</span>
                    )}
                  </label>
                  <div className="relative">
                    <Icon icon="solar:diploma-verified-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      id="add-hpcsa-number"
                      type="text"
                      value={formData.hpcsa_number}
                      onChange={(e) => updateField('hpcsa_number', e.target.value)}
                      className={fieldClass('hpcsa_number')}
                      placeholder="HPCNA/HPCSA number, e.g. MP 12345"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Printed as the treating practitioner number on medical aid claims.</p>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                  <p className="text-sm text-gray-500">Personal contact details and employment info</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Icon icon="solar:phone-calling-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="tel"
                      value={formData.contact_number}
                      onChange={(e) => updateField('contact_number', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      placeholder="+264 81 234 5678"
                    />
                  </div>
                </div>
                
                <div>
                  <DateInput
                    label="Start Date"
                    value={formData.start_date}
                    onChange={(value) => updateField('start_date', value)}
                    placeholder="Select start date"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <Icon icon="solar:map-point-bold-duotone" className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                    <textarea
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200 resize-none"
                      rows={3}
                      placeholder="123 Main Street, Windhoek"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-xl"
              >
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
                Send Invite
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Department Selection Modal (no user id: only fills the form) */}
      {showDepartmentModal && (
        <DepartmentSelectionModal
          currentDepartment={formData.department}
          onClose={() => setShowDepartmentModal(false)}
          onSuccess={(departmentName) => {
            updateField('department', departmentName);
            setShowDepartmentModal(false);
          }}
        />
      )}
    </div>
  );
};
