import React from 'react';
import { Microscope } from 'lucide-react';
import RequestsOverview from '../components/requests/RequestsOverview';

const Requests: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <Microscope size={28} className="text-primary-600 mr-3" />
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">
            Lab & Media Requests
          </h1>
          <p className="text-gray-600">Track and manage lab tests and imaging requests</p>
        </div>
      </div>

      <RequestsOverview />
      </div>
    </div>
  );
};

export default Requests;