import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { User, Phone, Stethoscope } from 'lucide-react';

interface EditPatientFormData {
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  occupation: string;
  employer: string;
  home_language: string;
  home_address: string;
  postal_address: string;
  postal_code: string;
}

interface Props {
  patientId: string;
  initialData: EditPatientFormData;
  onSuccess: () => void;
}

const EditPatientForm: React.FC<Props> = ({ patientId, initialData, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const { register, handleSubmit, formState: { errors } } = useForm<EditPatientFormData>({
    defaultValues: initialData
  });

  const onSubmit = async (data: EditPatientFormData) => {
    try {
      const { error } = await supabase
        .from('patients')
        .update(data)
        .eq('id', patientId);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'contact', label: 'Contact Details', icon: Phone },
    { id: 'medical', label: 'Medical Info', icon: Stethoscope }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-[#01b9d5] text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                type="text"
                {...register('first_name', { required: 'First name is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                type="text"
                {...register('last_name', { required: 'Last name is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                {...register('date_of_birth', { required: 'Date of birth is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              />
              {errors.date_of_birth && (
                <p className="mt-1 text-sm text-red-600">{errors.date_of_birth.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                {...register('gender', { required: 'Gender is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Marital Status</label>
              <select
                {...register('marital_status')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Language</label>
              <select
                {...register('home_language')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
              >
                <option value="">Select Language</option>
                <option value="English">English</option>
                <option value="Afrikaans">Afrikaans</option>
                <option value="Oshiwambo">Oshiwambo</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cell Number</label>
                <input
                  type="tel"
                  {...register('cell_number')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Home Address</label>
              <textarea
                {...register('home_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter home address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Address</label>
              <textarea
                {...register('postal_address')}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Code</label>
              <input
                type="text"
                {...register('postal_code')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter postal code"
              />
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Occupation</label>
              <input
                type="text"
                {...register('occupation')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter occupation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Employer</label>
              <input
                type="text"
                {...register('employer')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#01b9d5] focus:ring-[#01b9d5]"
                placeholder="Enter employer name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical History</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Medical history information will be managed through patient visits and medical records.</p>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies & Conditions</label>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p>Allergies and chronic conditions are tracked in the patient's medical records.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit">
          Update Patient
        </Button>
      </div>
    </form>
  );
};

export default EditPatientForm;