import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { Pill, Activity, ImageIcon, Wallet, Microscope, Film } from 'lucide-react';
import FullScreenModal from '../ui/FullScreenModal';
import EditVisitTabs from './EditVisitTabs';
import FormModal from '../modals/FormModal';
import FloatingVisitTracker from '../dashboard/FloatingVisitTracker';
import PremiumAddAppointmentForm from '../forms/PremiumAddAppointmentForm';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ServiceSelection } from '../../types/billing';
import { useLocation } from 'react-router-dom';

interface FullScreenEditVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitId: string;
  patientId: string;
  onSuccess: () => void;
}

interface Visit {
  id: string;
  visit_date?: string | null;
  visit_time?: string | null;
  visit_type?: 'consultation' | 'follow-up' | 'procedure' | 'emergency' | string | null;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  doctor_id?: string | null;
  patients?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
  tooltip?: string;
}

const tabs: Tab[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'solar:document-bold-duotone',
    tooltip: 'Visit details and clinical notes'
  },
  {
    id: 'vitals',
    label: 'Vitals',
    icon: 'solar:heart-pulse-bold-duotone',
    tooltip: 'Vital signs and measurements'
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: 'solar:pill-bold-duotone',
    tooltip: 'Prescriptions and medications'
  },
  {
    id: 'leave',
    label: 'Leave Form',
    icon: 'solar:document-text-bold-duotone',
    tooltip: 'Medical leave certificates'
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: 'solar:wallet-bold-duotone',
    tooltip: 'Services and billing information'
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'solar:gallery-bold-duotone',
    tooltip: 'Photos and media files'
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    icon: 'solar:test-tube-bold-duotone',
    tooltip: 'Laboratory tests and results'
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: 'solar:camera-bold-duotone',
    tooltip: 'Medical imaging and scans'
  }
];

const FullScreenEditVisitModal: React.FC<FullScreenEditVisitModalProps> = ({
  isOpen,
  onClose,
  visitId,
  patientId,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);
  const { user } = useAuthStore();
  const location = useLocation();
  
  // Ref to trigger service modal from EditVisitTabs
  const triggerServiceModal = () => {
    window.dispatchEvent(new CustomEvent('triggerServiceModal'));
  };


  // Fetch visit details for header
  useEffect(() => {
    if (visitId && isOpen) {
      fetchVisitDetails();
    }
  }, [visitId, isOpen]);

  const fetchVisitDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          patients!visits_patient_id_fkey(first_name, last_name)
        `)
        .eq('id', visitId)
        .single();

      if (error) throw error;
      setVisit(data);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  const renderHeader = () => (
    <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-600/20 backdrop-blur-sm"></div>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Icon icon="solar:stethoscope-bold-duotone" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Edit Visit</h2>
            {visit && (
              <p className="text-blue-100 text-sm">
                {visit.patients?.first_name} {visit.patients?.last_name} • {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'No date'} • {visit.visit_type || 'Consultation'}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="bg-white border-b border-gray-200/50 relative">
      {/* Mobile: Horizontal scroll tabs | Desktop: Full width tabs */}
      <div className="px-4 sm:px-6">
        <div className="flex overflow-x-auto scrollbar-none md:overflow-x-visible" role="tablist">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isHovered = hoveredTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: 1, 
                  y: 0
                }}
                transition={{ 
                  opacity: { delay: index * 0.05, duration: 0.2 },
                  y: { delay: index * 0.05, duration: 0.2 }
                }}
                whileHover={{ 
                  scale: 1.002,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.998 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab(tab.id);
                }}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className={`
                  flex-shrink-0 md:flex-1 
                  flex items-center justify-center gap-2 
                  px-3 sm:px-4 py-4 
                  min-w-[120px] md:min-w-0
                  min-h-[48px]
                  text-xs sm:text-sm font-medium 
                  border-b-2 transition-all duration-200 
                  relative group cursor-pointer
                  touch-manipulation
                  ${isActive
                    ? 'text-purple-600 border-purple-600 bg-gradient-to-t from-purple-50/50 to-transparent'
                    : 'text-gray-500 border-transparent hover:text-purple-600 hover:bg-purple-50/30'
                  }
                `}
                aria-label={tab.label}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
              >
                {/* Tooltip - Hidden on mobile for better UX */}
                {tab.tooltip && isHovered && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none hidden sm:block"
                  >
                    {tab.tooltip}
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                  </motion.div>
                )}
                
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200 flex-shrink-0 ${
                  isActive ? 'text-purple-600' : ''
                }`} />
                
                {/* Always show text on mobile, but make it smaller */}
                <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{tab.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <>
                    {/* Bottom border shadow/glow */}
                    <motion.div
                      className="absolute -bottom-0.5 left-0 right-0 h-3 shadow-lg shadow-purple-500/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    
                    {/* White rounded indicator */}
                    <motion.div
                      className="absolute -bottom-1.5 left-0 right-0 mx-auto w-8 h-1 bg-white rounded-full"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 32, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    
                    {/* Simple active line indicator */}
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin text-purple-600" />
            <span className="text-gray-600">Loading visit details...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-hidden bg-gray-50">
        <div className="h-full max-w-full mx-auto p-3 sm:p-6">
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            {/* Tab header - Fixed on desktop, scrollable on mobile/tablet */}
            <div className="hidden lg:block p-6 border-b border-gray-200 flex-shrink-0">
              {/* General Tab Header with Follow-up Button */}
              {activeTab === 'general' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon icon="solar:document-bold-duotone" className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        General Information
                      </h3>
                      <p className="text-sm text-gray-600">Visit details, clinical notes, and encounter information</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduleModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-blue-100 text-blue-600 hover:bg-blue-200"
                  >
                    <Icon icon="solar:calendar-check-bold-duotone" className="w-4 h-4" />
                    Schedule Follow-up
                  </button>
                </div>
              )}

              {/* Other Tab Headers - Left Aligned */}
              {activeTab === 'vitals' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Icon icon="solar:heart-pulse-bold-duotone" className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Vitals
                    </h3>
                    <p className="text-sm text-gray-600">Record patient vital signs and physical measurements</p>
                  </div>
                </div>
              )}

              {activeTab === 'medications' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Icon icon="solar:pill-bold-duotone" className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Medications
                    </h3>
                    <p className="text-sm text-gray-600">Manage patient medications, prescriptions, and dosage instructions</p>
                  </div>
                </div>
              )}

              {activeTab === 'laboratory' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Icon icon="solar:test-tube-bold-duotone" className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Laboratory
                    </h3>
                    <p className="text-sm text-gray-600">Upload and manage patient lab results, test reports, and clinical files</p>
                  </div>
                </div>
              )}

              {activeTab === 'imaging' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon icon="solar:camera-bold-duotone" className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Imaging
                    </h3>
                    <p className="text-sm text-gray-600">Upload and manage patient imaging studies, X-rays, and radiology reports</p>
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon="solar:gallery-bold-duotone" className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Media
                    </h3>
                    <p className="text-sm text-gray-600">Upload and manage patient photos, videos, and multimedia clinical files</p>
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                      <Icon icon="solar:wallet-bold-duotone" className="w-5 h-5" style={{ color: '#30b4be' }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Billing
                      </h3>
                      <p className="text-sm text-gray-600">Manage services, procedures, and billing information for this visit</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Add Services Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab !== 'billing') {
                          setActiveTab('billing');
                        }
                        setTimeout(() => triggerServiceModal(), 100);
                      }}
                      className="px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 hover:shadow-md hover:scale-105 flex items-center gap-2 text-sm"
                      style={{ background: 'linear-gradient(135deg, #30b4be, #2a9da6)' }}
                    >
                      <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
                      Add Services
                    </button>
                  
                    {/* Services Counter - Premium Box */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gradient-to-br from-white to-cyan-50/30 border border-cyan-200/50 rounded-lg p-3 shadow-md backdrop-blur-sm min-w-[180px] hover:shadow-lg transition-all duration-200"
                      style={{ borderColor: '#30b4be20' }}
                    >
                      <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#30b4be' }}>Services</div>
                        <motion.div 
                          key={selectedServices.length}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="text-lg font-bold" 
                          style={{ fontFamily: 'Rubik, sans-serif', color: '#30b4be' }}
                        >
                          {selectedServices.length}
                        </motion.div>
                      </div>
                      <div className="w-px h-8 bg-gradient-to-b from-transparent to-transparent mx-3" style={{ backgroundColor: '#30b4be40' }}></div>
                      <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#30b4be' }}>Total</div>
                        <motion.div 
                          key={selectedServices.reduce((total, service) => total + (service.totalPrice || 0), 0)}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="text-lg font-bold" 
                          style={{ fontFamily: 'Rubik, sans-serif' }}
                        >
                          <span style={{ color: '#30b4be' }}>
                            N${Math.floor(selectedServices.reduce((total, service) => total + (service.totalPrice || 0), 0))}
                          </span>
                          <span style={{ color: '#30b4be60' }}>
                            .{String(selectedServices.reduce((total, service) => total + (service.totalPrice || 0), 0).toFixed(2)).split('.')[1]}
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Scrollable content area - includes tab header on mobile/tablet */}
            <div className="flex-1 overflow-auto">
              {/* Tab header for mobile/tablet - inside scrollable area */}
              <div className="block lg:hidden p-4 sm:p-6 border-b border-gray-200">
                {activeTab === 'general' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon icon="solar:document-bold-duotone" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          General Information
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">Visit details, clinical notes, and encounter information</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center sm:justify-start gap-2 bg-blue-100 text-blue-600 hover:bg-blue-200 w-full sm:w-auto"
                    >
                      <Icon icon="solar:calendar-check-bold-duotone" className="w-4 h-4" />
                      Schedule Follow-up
                    </button>
                  </div>
                )}

                {activeTab === 'vitals' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Activity className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Vitals
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Record patient vital signs and physical measurements</p>
                    </div>
                  </div>
                )}

                {activeTab === 'medications' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Pill className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Medications
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Manage patient medications, prescriptions, and dosage instructions</p>
                    </div>
                  </div>
                )}

                {activeTab === 'laboratory' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Microscope className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Laboratory
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Upload and manage patient lab results, test reports, and clinical files</p>
                    </div>
                  </div>
                )}

                {activeTab === 'imaging' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Film className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Imaging
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Upload and manage patient imaging studies, X-rays, and radiology reports</p>
                    </div>
                  </div>
                )}

                {activeTab === 'media' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Media
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Upload and manage patient photos, videos, and multimedia clinical files</p>
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #30b4be20, #2a9da620)' }}>
                        <Wallet className="w-5 h-5" style={{ color: '#30b4be' }} />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          Billing
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">Manage services, procedures, and billing information for this visit</p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab !== 'billing') {
                          setActiveTab('billing');
                        }
                        setTimeout(() => triggerServiceModal(), 100);
                      }}
                      className="px-3 sm:px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 hover:shadow-md hover:scale-105 flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm w-full sm:w-auto"
                      style={{ background: 'linear-gradient(135deg, #30b4be, #2a9da6)' }}
                    >
                      <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
                      Add Services
                    </button>
                  </div>
                )}
              </div>
              
              {/* Main content */}
              <div className="p-4 sm:p-6">
                <EditVisitTabs
                  visitId={visitId}
                  patientId={patientId}
                  activeTab={activeTab}
                  onSuccess={handleSuccess}
                  onCancel={onClose}
                  selectedServices={selectedServices}
                  onSelectedServicesChange={setSelectedServices}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <FullScreenModal isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col h-full bg-gray-50">
          {renderHeader()}
          {renderTabs()}
          {renderContent()}
        </div>
      </FullScreenModal>

      {/* Floating Visit Tracker */}
      {user?.practice_id && isOpen && createPortal(
        <FloatingVisitTracker 
          practiceId={user.practice_id} 
          selectedDate={new Date()} 
          zIndex={2147483648}
        />,
        document.body
      )}

      {/* Schedule Follow-up Appointment Modal */}
      <FormModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
        }}
        title="Schedule Follow-up Appointment"
      >
        <PremiumAddAppointmentForm
          onSuccess={() => {
            setIsScheduleModalOpen(false);
            setFollowUpRequired(true);
          }}
          initialPatientId={patientId}
          initialType="follow-up"
          initialDoctorId={visit?.doctor_id || user?.id}
        />
      </FormModal>
    </>
  );
};

export default FullScreenEditVisitModal;