import React from 'react';
import { Icon } from '@iconify/react';

const TestComponent = () => {
  const isEditing = true;
  const editFormData = { name: 'Test', color: '#8B5CF6' };

  const renderGeneralTab = () => {
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
                <p className="text-sm text-gray-600">Visit details, clinical notes, and encounter information</p>
              </div>
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <button className="px-4 py-2">Cancel</button>
                <button className="px-4 py-2">Save</button>
              </div>
            ) : (
              <button className="px-4 py-2">Edit</button>
            )}
          </div>
        </div>

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
                  <input type="text" className="w-full p-2 border rounded" />
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" className="w-full p-2 border rounded" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3>View Mode</h3>
            </div>
          </div>
        )}
      </div>
    );
  };

  return renderGeneralTab();
};

export default TestComponent;