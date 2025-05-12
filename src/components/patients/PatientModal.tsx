import React from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import { Patient } from '../../stores/patientsStore';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

Modal.setAppElement('#root');

const PatientModal: React.FC<PatientModalProps> = ({ isOpen, onClose, patient }) => {
  if (!patient) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="max-w-4xl mx-auto mt-20 bg-white rounded-xl shadow-xl"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4"
    >
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Patient Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Demographics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Demographics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">First Name</label>
                  <input
                    type="text"
                    defaultValue={patient.firstName}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Last Name</label>
                  <input
                    type="text"
                    defaultValue={patient.lastName}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Date of Birth</label>
                  <input
                    type="date"
                    defaultValue={patient.dateOfBirth}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Gender</label>
                  <select
                    defaultValue={patient.gender}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Email</label>
                  <input
                    type="email"
                    defaultValue={patient.email}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Phone</label>
                  <input
                    type="tel"
                    defaultValue={patient.phone}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Address</label>
                  <textarea
                    defaultValue={patient.address}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
              </div>
            </div>

            {/* Insurance Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Insurance Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Provider</label>
                  <input
                    type="text"
                    defaultValue={patient.insuranceProvider}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Policy Number</label>
                  <input
                    type="text"
                    defaultValue={patient.insuranceNumber}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-teal focus:ring-brand-teal"
                  />
                </div>
              </div>
            </div>

            {/* Medical History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Medical History</h3>
              <div className="space-y-4">
                <div className="max-h-48 overflow-y-auto">
                  {patient.medicalHistory.map((record) => (
                    <div key={record.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{record.title}</h4>
                          <p className="text-sm text-gray-600">{record.date}</p>
                        </div>
                        <span className="text-xs font-medium text-brand-teal bg-brand-light px-2 py-1 rounded">
                          {record.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{record.description}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Add Medical Record
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PatientModal;