import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { Pill, Activity, ImageIcon, Wallet, Microscope, Film } from 'lucide-react';
import FullScreenModal from '../ui/FullScreenModal';
import EditVisitTabs from './EditVisitTabs';
import PatientHistoryPanel from './PatientHistoryPanel';
import FormModal from '../modals/FormModal';
import FloatingVisitTracker from '../dashboard/FloatingVisitTracker';
import PremiumAddAppointmentForm from '../forms/PremiumAddAppointmentForm';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ServiceSelection } from '../../types/billing';
import { nadParts } from '../../utils/billing/money';
import { sumServiceTotals } from './visitBillingLines';
import { useLocation } from 'react-router-dom';
import { differenceInMonths, differenceInYears, format, isValid, parseISO } from 'date-fns';

export type EditVisitTabId =
  | 'general'
  | 'history'
  | 'vitals'
  | 'medications'
  | 'leave'
  | 'billing'
  | 'media'
  | 'laboratory'
  | 'imaging';

interface FullScreenEditVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitId: string;
  patientId: string;
  /** Called after a save; `completed` is true when the visit was also marked completed. */
  onSuccess: (result?: { completed: boolean }) => void;
  /** Tab shown each time the modal opens. Defaults to 'general'. */
  initialTab?: EditVisitTabId;
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
    date_of_birth?: string | null;
    gender?: string | null;
  } | null;
}

// "34 yrs, Male" style summary for the header; infants show months.
const formatPatientDemographics = (dateOfBirth?: string | null, gender?: string | null): string => {
  const parts: string[] = [];
  const dob = dateOfBirth ? parseISO(dateOfBirth) : null;
  if (dob && isValid(dob)) {
    const years = differenceInYears(new Date(), dob);
    if (years >= 1) parts.push(`${years} yrs`);
    else if (years === 0) parts.push(`${differenceInMonths(new Date(), dob)} mo`);
  }
  const trimmedGender = gender?.trim();
  if (trimmedGender) parts.push(trimmedGender.charAt(0).toUpperCase() + trimmedGender.slice(1));
  return parts.join(', ');
};

const formatVisitDateLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, 'd MMM yyyy') : null;
};

const UNSAVED_CHANGES_PROMPT =
  'You have changes on this visit that are not saved. Leave it anyway? Unsaved changes will be lost.';

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
    id: 'history',
    label: 'History',
    icon: 'solar:history-bold-duotone',
    tooltip: 'Previous visits, vitals, medications and labs'
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
  onSuccess,
  initialTab = 'general'
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);
  // Added up in whole cents, so the header total equals the sum of the billing lines
  const servicesTotal = sumServiceTotals(selectedServices);
  const { user } = useAuthStore();
  const location = useLocation();

  // A previous visit opened from the History tab is shown in place of the visit this modal was
  // opened for (the "current" visit). Keyed by that visit, so a new visitId prop always starts on it.
  const [otherVisit, setOtherVisit] = useState<{ fromVisitId: string; visitId: string; returnTab: string } | null>(null);
  const displayedVisitId = otherVisit && otherVisit.fromVisitId === visitId ? otherVisit.visitId : visitId;
  const isViewingOtherVisit = displayedVisitId !== visitId;
  // While another visit loads, `visit` still holds the previous one; never label the new view with it
  const shownVisit = visit && visit.id === displayedVisitId ? visit : null;
  const shownVisitDate = formatVisitDateLabel(shownVisit?.visit_date);
  const [notice, setNotice] = useState<string | null>(null);
  // Set once the clinician types in the visit form: switching visits reloads the form and would drop the edits
  const formTouchedRef = useRef(false);
  // A previous visit was saved while this modal stayed open; the caller is told when the modal closes
  const otherVisitSavedRef = useRef(false);
  // Ignores a slow header response for a visit that is no longer shown
  const latestVisitRequestRef = useRef<string | null>(null);

  // Ref to trigger service modal from EditVisitTabs
  const triggerServiceModal = () => {
    window.dispatchEvent(new CustomEvent('triggerServiceModal'));
  };


  // Open on the requested tab each time the modal is shown
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Each opening starts on the visit the modal was opened for
  useEffect(() => {
    if (!isOpen) {
      setOtherVisit(null);
      setNotice(null);
      formTouchedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Fetch visit details for header
  useEffect(() => {
    if (displayedVisitId && isOpen) {
      fetchVisitDetails(displayedVisitId);
    }
  }, [displayedVisitId, isOpen]);

  const fetchVisitDetails = async (targetVisitId: string) => {
    latestVisitRequestRef.current = targetVisitId;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          patients!visits_patient_id_fkey(first_name, last_name, date_of_birth, gender)
        `)
        .eq('id', targetVisitId)
        .single();

      if (error) throw error;
      if (latestVisitRequestRef.current === targetVisitId) setVisit(data);
    } catch (error) {
      console.error('Error fetching visit details:', error);
    } finally {
      if (latestVisitRequestRef.current === targetVisitId) setLoading(false);
    }
  };

  const confirmLeavingEdits = () => !formTouchedRef.current || window.confirm(UNSAVED_CHANGES_PROMPT);

  // Show another of this patient's visits inside this modal (from the History tab)
  const handleOpenOtherVisit = (targetVisitId: string) => {
    if (targetVisitId === displayedVisitId) return;
    if (targetVisitId === visitId) {
      returnToCurrentVisit();
      return;
    }
    if (!confirmLeavingEdits()) return;
    formTouchedRef.current = false;
    setSelectedServices([]);
    setNotice(null);
    setOtherVisit({
      fromVisitId: visitId,
      visitId: targetVisitId,
      // Keep the tab the clinician left the current visit on, even when hopping between old visits
      returnTab: otherVisit && otherVisit.fromVisitId === visitId ? otherVisit.returnTab : activeTab
    });
    setActiveTab('general');
  };

  const returnToCurrentVisit = (options?: { skipConfirm?: boolean; notice?: string }) => {
    if (!isViewingOtherVisit || !otherVisit) return;
    if (!options?.skipConfirm && !confirmLeavingEdits()) return;
    formTouchedRef.current = false;
    setSelectedServices([]);
    setActiveTab(otherVisit.returnTab);
    setOtherVisit(null);
    setNotice(options?.notice ?? null);
  };

  const handleClose = () => {
    if (otherVisitSavedRef.current) {
      otherVisitSavedRef.current = false;
      // Another visit changed: let the caller refresh. The visit this modal was opened for was not completed.
      onSuccess({ completed: false });
    }
    onClose();
  };

  const handleSuccess = (result?: { completed: boolean }) => {
    if (isViewingOtherVisit) {
      // The save was for a previous visit: stay in this consultation and go back to the current visit
      otherVisitSavedRef.current = true;
      returnToCurrentVisit({
        skipConfirm: true,
        notice: `Saved the previous visit${shownVisitDate ? ` of ${shownVisitDate}` : ''}. You are back on the current visit.`
      });
      return;
    }
    otherVisitSavedRef.current = false;
    onSuccess(result);
    onClose();
  };

  const patientDemographics = formatPatientDemographics(visit?.patients?.date_of_birth, visit?.patients?.gender);

  const renderHeader = () => (
    <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-600/20 backdrop-blur-sm"></div>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Icon icon="solar:stethoscope-bold-duotone" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{isViewingOtherVisit ? 'Previous Visit' : 'Edit Visit'}</h2>
            {shownVisit && (
              <p className="text-blue-100 text-sm">
                {shownVisit.patients?.first_name} {shownVisit.patients?.last_name}{patientDemographics ? ` (${patientDemographics})` : ''} • {shownVisit.visit_date ? new Date(shownVisit.visit_date).toLocaleDateString() : 'No date'} • {shownVisit.visit_type || 'Consultation'}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          aria-label="Close visit"
        >
          <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Visible whenever a previous visit is shown, so the clinician can always get back
  const renderVisitSwitchBar = () => (
    <>
      {isViewingOtherVisit && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-amber-50 border-b border-amber-200">
          <p className="flex items-center gap-2 text-sm text-amber-900">
            <Icon icon="solar:history-bold-duotone" className="w-5 h-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              You are viewing a previous visit{shownVisitDate ? ` of ${shownVisitDate}` : ''}. Anything you save here is
              saved to that visit.
            </span>
          </p>
          <button
            type="button"
            onClick={() => returnToCurrentVisit()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
          >
            <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Back to current visit
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-emerald-50 border-b border-emerald-200" role="status">
          <p className="flex items-center gap-2 text-sm text-emerald-800">
            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {notice}
          </p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 rounded text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );

  const renderTabs = () => (
    <div className="bg-white border-b border-gray-200/50 relative">
      {/* Mobile: Horizontal scroll tabs | Desktop: Full width tabs */}
      <div className="px-4 sm:px-6">
        <div className="flex overflow-x-auto scrollbar-none md:overflow-x-visible" role="tablist">
          {tabs.map((tab, index) => {
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
                
                <Icon icon={tab.icon} className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200 flex-shrink-0 ${
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
              {activeTab === 'history' && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon="solar:history-bold-duotone" className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Patient History
                    </h3>
                    <p className="text-sm text-gray-600">Previous visits, vitals, medications and lab requests (read-only)</p>
                  </div>
                </div>
              )}

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
                          key={servicesTotal}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="text-lg font-bold" 
                          style={{ fontFamily: 'Rubik, sans-serif' }}
                        >
                          <span style={{ color: '#30b4be' }}>
                            N${nadParts(servicesTotal).whole}
                          </span>
                          <span style={{ color: '#30b4be60' }}>
                            .{nadParts(servicesTotal).cents}
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

                {activeTab === 'history' && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icon icon="solar:history-bold-duotone" className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Patient History
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">Previous visits, vitals, medications and lab requests (read-only)</p>
                    </div>
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
              
              {/* Main content. Typing anywhere in the form marks it as edited (see formTouchedRef). */}
              <div
                className="p-4 sm:p-6"
                onInput={() => {
                  formTouchedRef.current = true;
                }}
                onChange={() => {
                  formTouchedRef.current = true;
                }}
              >
                {/* History is read-only; EditVisitTabs stays mounted below so form state and the save actions persist */}
                {activeTab === 'history' && (
                  <PatientHistoryPanel
                    patientId={patientId}
                    currentVisitId={displayedVisitId}
                    onOpenVisit={handleOpenOtherVisit}
                  />
                )}
                <EditVisitTabs
                  // A different visit gets a fresh form: no services, medications or notes carried over
                  key={displayedVisitId}
                  visitId={displayedVisitId}
                  patientId={patientId}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onSuccess={handleSuccess}
                  onCancel={isViewingOtherVisit ? () => returnToCurrentVisit({ skipConfirm: true }) : handleClose}
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
      <FullScreenModal isOpen={isOpen} onClose={handleClose}>
        <div className="flex flex-col h-full bg-gray-50">
          {renderHeader()}
          {renderVisitSwitchBar()}
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