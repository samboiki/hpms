import React from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

interface PatientRegistrationFormData {
  // Personal Details
  surname: string;
  firstName: string;
  idNumber: string;
  dateOfBirth: string;
  age: string;
  maritalStatus: string;
  occupation: string;
  cellNo: string;
  homeLanguage: string;
  numberOfDependents: string;

  // Contact Details
  homeAddress: string;
  postalAddress: string;
  postalCode: string;
  emailAddress: string;
  telephone: string;

  // Person Responsible for Account
  accountPerson: {
    fullName: string;
    idNumber: string;
    cellNo: string;
    homeAddress: string;
    postalCode: string;
    telephone: string;
  };

  // Employer Details
  employer: {
    name: string;
    address: string;
  };

  // Medical Aid
  medicalAid: {
    fund: string;
    number: string;
    optionPlan: string;
    mainMemberName: string;
  };

  // Next of Kin
  nextOfKin: {
    name: string;
    relationship: string;
    address: string;
    telephone: string;
  };

  // Referral
  referredBy: {
    name: string;
    address: string;
    telephone: string;
  };

  // Family Members
  familyMembers: Array<{
    name: string;
    dateOfBirth: string;
    allergies: string;
    comments: string;
  }>;
}

// Update the Props interface to include onSuccess
interface Props {
  onSuccess?: () => void;
}

const PatientRegistrationForm: React.FC<Props> = ({ onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<PatientRegistrationFormData>();

  const onSubmit = (data: PatientRegistrationFormData) => {
    console.log(data);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm">
      {/* Personal Details */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Personal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Surname</label>
            <input
              type="text"
              {...register('surname', { required: 'Surname is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
            {errors.surname && (
              <p className="mt-1 text-sm text-red-600">{errors.surname.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">First Names</label>
            <input
              type="text"
              {...register('firstName', { required: 'First name is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ID Number</label>
            <input
              type="text"
              {...register('idNumber', { required: 'ID number is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
            <input
              type="date"
              {...register('dateOfBirth')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
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
              <option value="english">English</option>
              <option value="afrikaans">Afrikaans</option>
              <option value="oshiwambo">Oshiwambo</option>
              <option value="other">Other</option>
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
        </div>
      </div>

      {/* Medical Aid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Medical Aid</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fund</label>
            <input
              type="text"
              {...register('medicalAid.fund')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Number</label>
            <input
              type="text"
              {...register('medicalAid.number')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Option/Plan</label>
            <input
              type="text"
              {...register('medicalAid.optionPlan')}
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              {...register('nextOfKin.address')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telephone</label>
            <input
              type="tel"
              {...register('nextOfKin.telephone')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Family Members */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Family Members</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allergies</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[0, 1, 2].map((index) => (
                <tr key={index}>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      {...register(`familyMembers.${index}.name`)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="date"
                      {...register(`familyMembers.${index}.dateOfBirth`)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      {...register(`familyMembers.${index}.allergies`)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      {...register(`familyMembers.${index}.comments`)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-primary focus:ring-brand-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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