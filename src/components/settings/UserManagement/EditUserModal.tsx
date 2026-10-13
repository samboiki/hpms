import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { DepartmentSelectionModal } from './DepartmentSelectionModal';
import DateInput from '../../ui/DateInput';
import { personalAvatar } from '../../../utils/avatarUtils';
import { UserAvatar } from '../../layout/ProfileMenu';
import { useAuthStore } from '../../../stores/authStore';
import type { Database } from '../../../types/database.types';
import { describeDbError, ensureRowsUpdated } from './staffUtils';
import PractitionerBillingFields from './PractitionerBillingFields';
import { usePractitionerBillingDraft } from './usePractitionerBillingDraft';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  department?: string;
  is_active: boolean;
  contact_number?: string;
  address?: string;
  start_date?: string;
  employee_number?: string;
  reporting_manager_id?: string;
  avatar?: string;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  gender?: string;
  hpcsa_number?: string | null;
}

type UserUpdate = Database['public']['Tables']['users']['Update'] & { gender?: string | null };

interface EditUserModalProps {
  user: UserData;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSuccess }) => {
  // Escape closes this window, as its X does
  useEscapeToClose(true, onClose);
  const { user: currentUser } = useAuthStore();
  const isEditingSelf = currentUser?.id === user.id;
  // A partner's own practice number and rate decide who the fund pays and what is billed: administrators change them
  const billingDraft = usePractitionerBillingDraft(user.id);
  const canEditBilling = currentUser?.role === 'admin' || currentUser?.is_super_admin === true;
  const bankingLoaded = 'bank_name' in user || 'account_number' in user;
  const [loading, setLoading] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(personalAvatar(user.avatar) ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    role: user.role,
    job_title: user.job_title || '',
    department: user.department || '',
    contact_number: user.contact_number || '',
    address: user.address || '',
    employee_number: user.employee_number || '',
    start_date: user.start_date || '',
    bank_name: user.bank_name || '',
    account_number: user.account_number || '',
    account_type: user.account_type || '',
    gender: user.gender || '',
    hpcsa_number: user.hpcsa_number || ''
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Avatar image must be less than 5MB');
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploadingAvatar(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to documents bucket
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = formData.full_name.trim();
    if (!fullName) {
      toast.error('Full name is required');
      return;
    }

    if (isEditingSelf && user.role === 'admin' && formData.role !== 'admin') {
      toast.error('You cannot remove your own administrator role. Ask another administrator to change it.');
      return;
    }

    if (canEditBilling && billingDraft.problem) {
      toast.error(billingDraft.problem);
      return;
    }

    setLoading(true);

    try {
      // Their own photo only: a stock photo saved by older versions is cleared (initials show instead)
      let avatarUrl = personalAvatar(user.avatar);
      
      // Upload avatar if a new file was selected
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar(avatarFile, user.id);
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      }

      // Status changes go through Deactivate/Reactivate (with confirmation), not this form.
      // Passwords cannot be set from the browser: auth admin APIs need the service role key.
      const updates: UserUpdate = {
        full_name: fullName,
        role: formData.role,
        job_title: formData.job_title.trim() || null,
        department: formData.department || null,
        contact_number: formData.contact_number.trim() || null,
        address: formData.address.trim() || null,
        employee_number: formData.employee_number.trim() || null,
        start_date: formData.start_date || null,
        hpcsa_number: formData.hpcsa_number.trim() || null,
        avatar: avatarUrl || null,
        updated_at: new Date().toISOString()
      };
      // Only write banking details that were actually loaded, so a partial record can never blank them
      if (bankingLoaded) {
        updates.bank_name = formData.bank_name.trim() || null;
        updates.account_number = formData.account_number.trim() || null;
        updates.account_type = formData.account_type || null;
      }
      // `gender` is not in the generated schema; only send it when the loaded row has the column
      if ('gender' in user) {
        updates.gender = formData.gender || null;
      }

      const { data: updatedRows, error: userError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select('id');

      if (userError) throw userError;
      ensureRowsUpdated(updatedRows, `${fullName}'s details`);
      // Their own practice number and rate (set_practitioner_billing), when an administrator changed them
      if (canEditBilling) await billingDraft.save();

      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(describeDbError(error, 'Could not save staff details'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Edit User</CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                <Icon icon={SolarIcons.close} className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h3>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-200">
                      {/* Their own photo, or their initials (never a stock photo of a stranger) */}
                      <span className="block h-full w-full text-2xl"><UserAvatar avatar={avatarPreview} name={formData.full_name || user.full_name} /></span>
                    </div>
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                    <label htmlFor="avatar-upload">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="cursor-pointer" 
                        disabled={uploadingAvatar}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('avatar-upload')?.click();
                        }}
                      >
                        <Icon icon={SolarIcons.upload} className="w-4 h-4 mr-2" />
                        Upload New Photo
                      </Button>
                    </label>
                    <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max size 5MB.</p>
                    <p className="text-xs text-gray-500">Without a photo, their initials are shown.</p>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => {
                        setFormData({ ...formData, gender: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-hpcsa-number" className="block text-sm font-medium text-gray-700 mb-1">
                      Professional Registration No.
                    </label>
                    <input
                      id="edit-hpcsa-number"
                      type="text"
                      value={formData.hpcsa_number}
                      onChange={(e) => setFormData({ ...formData, hpcsa_number: e.target.value })}
                      placeholder={formData.role === 'doctor' || formData.role === 'nurse' ? 'e.g. MP 12345' : 'Not required for this role'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">HPCNA/HPCSA number printed on medical aid claims.</p>
                  </div>
                </div>
              </div>

              {/* Billing: a partner's own practice number and rate (doctors and nurses) */}
              <PractitionerBillingFields draft={billingDraft} role={formData.role} canEdit={canEditBilling} />

              {/* Role & Department */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Role & Department</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="receptionist">Receptionist</option>
                      <option value="nurse">Nurse</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.department}
                        readOnly
                        placeholder="Click to select department"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer"
                        onClick={() => setShowDepartmentModal(true)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDepartmentModal(true)}
                        className="px-3"
                      >
                        <Icon icon={SolarIcons.building} className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      value={formData.employee_number}
                      onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_number}
                      onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <DateInput
                      label="Start Date"
                      value={formData.start_date}
                      onChange={(value) => setFormData({ ...formData, start_date: value })}
                      placeholder="Select start date"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Banking Details (only when the full record was loaded) */}
              {bankingLoaded && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., Standard Bank"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="e.g., 123456789"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type
                    </label>
                    <select
                      value={formData.account_type}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select account type</option>
                      <option value="savings">Savings</option>
                      <option value="current">Current/Cheque</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                </div>
              </div>
              )}

              {/* Passwords are managed by each staff member */}
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <Icon icon={SolarIcons.lock} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                  Passwords are private to each staff member. They change their own password under
                  Settings &rarr; Account &rarr; Security. Status changes use the Deactivate / Reactivate action on the profile.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Icon icon={SolarIcons.check} className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Department Selection Modal - only updates the form; saved with "Save Changes" so Cancel discards it */}
      {showDepartmentModal && (
        <DepartmentSelectionModal
          currentDepartment={formData.department}
          onClose={() => setShowDepartmentModal(false)}
          onSuccess={(departmentName) => {
            setFormData({ ...formData, department: departmentName });
            setShowDepartmentModal(false);
          }}
        />
      )}
    </div>
  );
};