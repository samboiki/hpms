import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface PatientRegistrationFormData {
  // Personal Details
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  cellNo: string;
  homeLanguage: string;
  email: string;

  // Contact Details
  homeAddress: string;
  postalAddress: string;
  postalCode: string;

  // Medical Aid
  medicalAid: {
    provider: string;
    scheme: string;
    membershipNumber: string;
    mainMemberName: string;
    mainMemberIdNumber: string;
    relationship: string;
  };

  // Next of Kin
  nextOfKin: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
}

interface Props {
  onSuccess?: () => void;
}

const PatientRegistrationForm: React.FC<Props> = ({ onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<PatientRegistrationFormData>();

  const onSubmit = async (data: PatientRegistrationFormData) => {
    try {
      // Check for duplicate ID number first
      const { data: existingPatient, error: checkError } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('id_number', data.idNumber)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingPatient) {
        alert(`Patient with ID number ${data.idNumber} already exists: ${existingPatient.first_name} ${existingPatient.last_name}`);
        return;
      }

      // Add practice_id to patient data
      const { data: { user } } = await supabase.auth.getUser();
      let practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3'; // Default to Dr. Polina's practice

      // Try to get user's practice from users table
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();
        
        if (userData?.practice_id) {
          practiceId = userData.practice_id;
        }
      }

      // Insert patient data
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{
          first_name: data.firstName,
          last_name: data.lastName,
          id_number: data.idNumber,
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
          marital_status: data.maritalStatus,
          occupation: data.occupation,
          cell_number: data.cellNo,
          home_language: data.homeLanguage,
          email: data.email,
          home_address: data.homeAddress,
          postal_address: data.postalAddress,
          postal_code: data.postalCode,
          practice_id: practiceId
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      // Insert medical aid details
      if (data.medicalAid.provider) {
        const { error: medicalAidError } = await supabase
          .from('medical_aid_details')
          .insert([{
            patient_id: patientData.id,
            provider: data.medicalAid.provider,
            scheme: data.medicalAid.scheme,
            membership_number: data.medicalAid.membershipNumber,
            main_member_name: data.medicalAid.mainMemberName,
            main_member_id_number: data.medicalAid.mainMemberIdNumber,
            relationship_to_main: data.medicalAid.relationship
          }]);

        if (medicalAidError) throw medicalAidError;
      }

      // Insert next of kin
      if (data.nextOfKin.name) {
        const { error: nextOfKinError } = await supabase
          .from('next_of_kin')
          .insert([{
            patient_id: patientData.id,
            name: data.nextOfKin.name,
            relationship: data.nextOfKin.relationship,
            phone: data.nextOfKin.phone,
            address: data.nextOfKin.address
          }]);

        if (nextOfKinError) throw nextOfKinError;
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error registering patient:', error);
      // Handle error (show error message to user)
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm">
      {/* Personal Details */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Personal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              {...register('firstName', { required: 'First name is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              {...register('lastName', { required: 'Last name is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ID Number</label>
            <input
              type="text"
              {...register('idNumber', { required: 'ID number is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.idNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.idNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
            <input
              type="date"
              {...register('dateOfBirth', { required: 'Date of birth is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.dateOfBirth && (
              <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              {...register('gender', { required: 'Gender is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {errors.gender && (
              <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Marital Status</label>
            <select
              {...register('maritalStatus')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            >
              <option value="">Select status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Home Language</label>
            <select
              {...register('homeLanguage')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            >
              <option value="">Select language</option>
              <option value="English">English</option>
              <option value="Afrikaans">Afrikaans</option>
              <option value="Oshiwambo">Oshiwambo</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Cell No.</label>
            <input
              type="tel"
              {...register('cellNo')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Occupation</label>
            <input
              type="text"
              {...register('occupation')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Contact Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Home Address</label>
            <textarea
              {...register('homeAddress')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Postal Address</label>
            <textarea
              {...register('postalAddress')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Postal Code</label>
            <input
              type="text"
              {...register('postalCode')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Medical Aid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Medical Aid</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Provider</label>
            <input
              type="text"
              {...register('medicalAid.provider')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Scheme</label>
            <input
              type="text"
              {...register('medicalAid.scheme')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Membership Number</label>
            <input
              type="text"
              {...register('medicalAid.membershipNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Main Member's Name</label>
            <input
              type="text"
              {...register('medicalAid.mainMemberName')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Main Member's ID Number</label>
            <input
              type="text"
              {...register('medicalAid.mainMemberIdNumber')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Relationship to Main Member</label>
            <input
              type="text"
              {...register('medicalAid.relationship')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Next of Kin */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Next of Kin</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              {...register('nextOfKin.name')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Relationship</label>
            <input
              type="text"
              {...register('nextOfKin.relationship')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              {...register('nextOfKin.phone')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              {...register('nextOfKin.address')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]">
          Register Patient
        </Button>
      </div>
    </form>
  );
};

export default PatientRegistrationForm;