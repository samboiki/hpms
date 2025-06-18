import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Activity,
  Pill,
  Microscope,
  ImageIcon,
  Film,
  Wallet,
  Loader2,
  Stethoscope,
  CalendarCheck
} from 'lucide-react';
import FullScreenModal from '../ui/FullScreenModal';
import EditVisitTabs from './EditVisitTabs';
import FormModal from '../modals/FormModal';
import AddAppointmentForm from '../forms/AddAppointmentForm';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

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
  patient?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  tooltip?: string;
}

const tabs: Tab[] = [
  {
    id: 'general',
    label: 'General',
    icon: FileText,
    tooltip: 'Visit details and clinical notes'
  },
  {
    id: 'vitals',
    label: 'Vitals',
    icon: Activity,
    tooltip: 'Vital signs and measurements'
  },
  {
    id: 'medications',
    label: 'Medications',
    icon: Pill,
    tooltip: 'Prescriptions and medications'
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: Wallet,
    tooltip: 'Services and billing information'
  },
  {
    id: 'media',
    label: 'Media',
    icon: ImageIcon,
    tooltip: 'Photos and media files'
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    icon: Microscope,
    tooltip: 'Laboratory tests and results'
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: Film,
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
  const { user } = useAuthStore();

  // Debug logging for modal state
  useEffect(() => {
    console.log('🔍 DEBUG: FullScreenEditVisitModal - isScheduleModalOpen changed to:', isScheduleModalOpen);
  }, [isScheduleModalOpen]);

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
          patient:patients(first_name, last_name)
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
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Edit Visit</h2>
            {visit && (
              <p className="text-blue-100 text-sm">
                {visit.patient?.first_name} {visit.patient?.last_name} • {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'No date'} • {visit.visit_type || 'Consultation'}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="bg-white border-b border-gray-200/50 relative">
      <div className="px-6">
        <div className="flex w-full" role="tablist">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isHovered = hoveredTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
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
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 relative group ${
                  isActive
                    ? 'text-purple-600 border-purple-600 bg-gradient-to-t from-purple-50/50 to-transparent'
                    : 'text-gray-500 border-transparent hover:text-purple-600 hover:bg-purple-50/30'
                } cursor-pointer`}
                aria-label={tab.label}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
              >
                {/* Tooltip */}
                {tab.tooltip && isHovered && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 pointer-events-none"
                  >
                    {tab.tooltip}
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                  </motion.div>
                )}
                
                <Icon className={`w-4 h-4 transition-all duration-200 ${
                  isActive ? 'text-purple-600' : ''
                }`} />
                
                <span className="hidden sm:inline font-medium">{tab.label}</span>
                
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
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            <span className="text-gray-600">Loading visit details...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-hidden bg-gray-50">
        <div className="h-full max-w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              {/* General Tab Header with Follow-up Button */}
              {activeTab === 'general' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
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
                      console.log('🎯 DEBUG: Schedule Follow-up button clicked!');
                      console.log('🎯 DEBUG: Current isScheduleModalOpen:', isScheduleModalOpen);
                      console.log('🎯 DEBUG: Setting isScheduleModalOpen to true...');
                      setIsScheduleModalOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 bg-blue-100 text-blue-600 hover:bg-blue-200"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    Schedule Follow-up
                  </button>
                </div>
              )}

              {/* Other Tab Headers - Left Aligned */}
              {activeTab === 'vitals' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Activity className="w-5 h-5 text-red-600" />
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
                    <Pill className="w-5 h-5 text-orange-600" />
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
                    <Microscope className="w-5 h-5 text-green-600" />
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
                    <Film className="w-5 h-5 text-blue-600" />
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
                    <ImageIcon className="w-5 h-5 text-purple-600" />
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
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Billing
                    </h3>
                    <p className="text-sm text-gray-600">Manage services, procedures, and billing information for this visit</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <EditVisitTabs
                  visitId={visitId}
                  patientId={patientId}
                  activeTab={activeTab}
                  onSuccess={handleSuccess}
                  onCancel={onClose}
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

      {/* Schedule Follow-up Appointment Modal */}
      {console.log('🏗️ DEBUG: Rendering FormModal with props:', {
        isScheduleModalOpen,
        patientId,
        visitDoctorId: visit?.doctor_id,
        userId: user?.id
      })}
      <FormModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          console.log('🔴 DEBUG: Schedule modal onClose called');
          setIsScheduleModalOpen(false);
        }}
        title="Schedule Follow-up Appointment"
      >
        <AddAppointmentForm
          onSuccess={() => {
            console.log('✅ DEBUG: AddAppointmentForm onSuccess called');
            setIsScheduleModalOpen(false);
            setFollowUpRequired(true);
            // Optionally refresh visit data or show success message
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