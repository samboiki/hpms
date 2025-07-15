import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../stores/authStore';
import { usePractice } from '../contexts/PracticeContext';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';
import PatientManagementView from '../components/patients/PatientManagementView';
import PatientAnalytics from '../components/patients/PatientAnalytics';
import { usePatientsStoreNew } from '../stores/patientsStoreNew';
import { motion, AnimatePresence } from 'framer-motion';
import { usePatientSettings } from '../hooks/usePatientSettings';

// Main Patients Page Component
const Patients: React.FC = () => {
  const { practiceId } = usePractice();
  const { user, logout } = useAuthStore();
  const { patients } = usePatientsStoreNew();
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<'patients' | 'analytics' | 'settings'>('patients');
  const { settings, loading: settingsLoading, saving, saveSettings } = usePatientSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local settings when loaded from database
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header Section - Clean Professional Style */}
        <div className="rounded-xl">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                  <Icon icon="solar:user-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">Patient Management</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Comprehensive patient database and management</p>
                </div>
              </div>
              
              {/* User Avatar with Dropdown - Same as Dashboard */}
              {user && (
                <div className="relative">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="relative group focus:outline-none"
                  >
                    {/* Pulsating outer ring - Purple theme */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full opacity-50"></div>
                    
                    {/* Avatar circle */}
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                      <img 
                        src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                        alt={user.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                        }}
                      />
                    </div>
                  </button>

                  {/* Premium Dropdown Modal - Using Portal for maximum z-index control */}
                  {isAvatarDropdownOpen && createPortal(
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200" 
                        onClick={() => setIsAvatarDropdownOpen(false)}
                      />
                      
                      {/* Premium Modal Dropdown */}
                      <div 
                        style={{
                          position: 'fixed',
                          top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                          right: avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0,
                          zIndex: 99999
                        }}
                        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                          <button 
                            onClick={() => setIsAvatarDropdownOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                        
                        {/* User Info Card */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                          <div className="flex items-start gap-4">
                            <div className="relative flex-shrink-0">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img 
                                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-base font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user.email}</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white mt-1">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Logout Button */}
                        <button
                          onClick={() => {
                            setIsAvatarDropdownOpen(false);
                            handleLogout();
                          }}
                          className="w-full px-4 py-3 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl transition-colors font-semibold hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Tab Navigation - Professional Style */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 gap-0 w-full">
            {(['patients', 'analytics', 'settings'] as const).map((tab, index) => {
              const tabConfig = {
                patients: { icon: 'solar:users-group-two-rounded-bold-duotone', label: 'Patients' },
                analytics: { icon: 'solar:chart-square-bold-duotone', label: 'Analytics' },
                settings: { icon: 'solar:settings-minimalistic-bold-duotone', label: 'Settings' }
              };
              const { icon, label } = tabConfig[tab];
              const isActive = activeTab === tab;
              const isFirst = index === 0;
              const isLast = index === 2;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-200 capitalize ${
                    isFirst ? 'rounded-l-xl' : ''
                  } ${
                    isLast ? 'rounded-r-xl' : ''
                  } ${
                    !isFirst ? '-ml-px' : ''
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg z-10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={icon} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === 'patients' && (
              <motion.div
                key="patients"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PatientManagementView />
              </motion.div>
            )}
            
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                  <PatientAnalytics patients={patients} />
                </div>
              </motion.div>
            )}
            
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Patient Settings</h2>
              {hasChanges && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}
            </div>
            
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon icon="solar:hourglass-line-duotone" className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Default Values Section */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Default Values</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Country</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        value={localSettings.defaultCountry}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, defaultCountry: e.target.value });
                          setHasChanges(true);
                        }}
                      >
                        <option value="Namibia">Namibia</option>
                        <option value="South Africa">South Africa</option>
                        <option value="Botswana">Botswana</option>
                        <option value="Zimbabwe">Zimbabwe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Language</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        value={localSettings.defaultLanguage}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, defaultLanguage: e.target.value });
                          setHasChanges(true);
                        }}
                      >
                        <option value="English">English</option>
                        <option value="Afrikaans">Afrikaans</option>
                        <option value="Oshiwambo">Oshiwambo</option>
                        <option value="German">German</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Data Privacy Section */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Privacy</h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" 
                        checked={localSettings.requireDataConsent}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, requireDataConsent: e.target.checked });
                          setHasChanges(true);
                        }}
                      />
                      <span className="ml-2 text-sm text-gray-700">Require consent for data processing</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" 
                        checked={localSettings.enableDataExport}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, enableDataExport: e.target.checked });
                          setHasChanges(true);
                        }}
                      />
                      <span className="ml-2 text-sm text-gray-700">Enable patient data export requests</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" 
                        checked={localSettings.autoAnonymizeAfterYears === 7}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, autoAnonymizeAfterYears: e.target.checked ? 7 : null });
                          setHasChanges(true);
                        }}
                      />
                      <span className="ml-2 text-sm text-gray-700">Auto-anonymize inactive patient records after 7 years</span>
                    </label>
                  </div>
                </div>
                
                {/* Patient ID Format */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Patient ID Format</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ID Prefix</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" 
                        placeholder="e.g., PAT" 
                        value={localSettings.idPrefix}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, idPrefix: e.target.value });
                          setHasChanges(true);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ID Format</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        value={localSettings.idFormat}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, idFormat: e.target.value as 'sequential' | 'year_number' | 'random_alphanumeric' });
                          setHasChanges(true);
                        }}
                      >
                        <option value="sequential">Sequential Numbers (PAT001, PAT002...)</option>
                        <option value="year_number">Year + Number (PAT2024001, PAT2024002...)</option>
                        <option value="random_alphanumeric">Random Alphanumeric (PATX7K9M2...)</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Activity Threshold Settings */}
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Activity Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Inactive Patient Threshold</label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        value={localSettings.inactiveThresholdDays}
                        onChange={(e) => {
                          setLocalSettings({ ...localSettings, inactiveThresholdDays: Number(e.target.value) });
                          setHasChanges(true);
                        }}
                      >
                        <option value="90">3 Months</option>
                        <option value="180">6 Months</option>
                        <option value="365">1 Year</option>
                        <option value="730">2 Years</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Patients who haven't visited within this period are marked as inactive</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-700">Active Patient</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <span className="text-sm text-gray-700">Inactive Patient</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="flex justify-end pt-6 gap-3">
                  {hasChanges && (
                    <button 
                      onClick={() => {
                        setLocalSettings(settings);
                        setHasChanges(false);
                      }}
                      className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      const success = await saveSettings(localSettings);
                      if (success) {
                        setHasChanges(false);
                      }
                    }}
                    disabled={!hasChanges || saving}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                      hasChanges && !saving
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {saving && <Icon icon="solar:hourglass-line-duotone" className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Floating Visit Tracker - Same as Dashboard */}
      {practiceId && <FloatingVisitTracker practiceId={practiceId} selectedDate={new Date()} />}
    </div>
  );
};

export default Patients;