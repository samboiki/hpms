import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FollowUpAutomation from '../settings/FollowUpAutomation';
import FollowUpAutomationMonitor from './FollowUpAutomationMonitor';

export default function FollowUpAutomationTab() {
  const [activeTab, setActiveTab] = useState<'templates' | 'monitor'>('templates');

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Icon icon="solar:magic-stick-3-bold-duotone" className="w-7 h-7 text-purple-600" />
            Follow-up Automation System
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Automatically creates follow-up visits when visits are completed with matching diagnoses or tariff codes
          </p>
        </div>
        
        <div className="flex px-6">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Icon icon="solar:document-text-bold-duotone" className="inline w-5 h-5 mr-2" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'monitor'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Icon icon="solar:monitor-bold-duotone" className="inline w-5 h-5 mr-2" />
            Real-time Monitor
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'templates' ? (
          <div>
            {/* How it works section */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
              <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <Icon icon="solar:lightbulb-bolt-bold-duotone" className="w-5 h-5" />
                How Automatic Triggering Works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-700">Instant Trigger</p>
                    <p className="text-gray-600">Follow-ups are created immediately when a visit is marked as completed</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-700">Practice Isolation</p>
                    <p className="text-gray-600">Each practice's data is processed separately and securely</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon icon="solar:bolt-circle-bold-duotone" className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-700">Blazing Fast</p>
                    <p className="text-gray-600">Database-native processing ensures sub-second follow-up creation</p>
                  </div>
                </div>
              </div>
            </div>
            
            <FollowUpAutomation />
          </div>
        ) : (
          <FollowUpAutomationMonitor />
        )}
      </div>
    </div>
  );
}