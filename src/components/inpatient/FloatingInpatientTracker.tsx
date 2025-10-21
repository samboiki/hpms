import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Icon } from '@iconify/react';
import { useInpatientStore } from '../../stores/inpatientStore';
import { NotificationsList } from '../messages/InternalMessaging/NotificationsList';
import { useMessagingStore } from '../../stores/messagingStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { unreadMessagesService } from '../../services/unreadMessagesService';
import { useNavigate } from 'react-router-dom';

interface FloatingInpatientTrackerProps {
  practiceId: string;
  onPatientSelect?: (patient: any) => void;
  stats?: any;
  zIndex?: number;
}

const FloatingInpatientTracker: React.FC<FloatingInpatientTrackerProps> = ({
  practiceId,
  onPatientSelect,
  stats,
  zIndex = 50
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'admissions' | 'alerts' | 'discharges' | 'messages'>('admissions');
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { unreadNotificationCount } = useMessagingStore();
  const { activeAdmissions, fetchAdmissions } = useInpatientStore();

  // Subscribe to unread messages
  useEffect(() => {
    if (user?.id && practiceId) {
      const unsubscribe = unreadMessagesService.subscribe(setUnreadCount);
      return () => unsubscribe();
    }
  }, [user?.id, practiceId]);

  // Fetch admissions on mount
  useEffect(() => {
    if (practiceId) {
      fetchAdmissions(practiceId, 'active');
    }
  }, [practiceId, fetchAdmissions]);

  // Handle scroll shadows
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowTopShadow(scrollTop > 10);
      setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 10);
    }
  };

  // Filter admissions based on tab
  const getFilteredAdmissions = () => {
    switch (activeTab) {
      case 'alerts':
        return activeAdmissions.filter((a: any) =>
          a.patient_condition === 'critical' || a.patient_condition === 'serious'
        );
      case 'discharges':
        const today = new Date().toDateString();
        return activeAdmissions.filter((a: any) => {
          if (!a.expected_discharge_date) return false;
          return new Date(a.expected_discharge_date).toDateString() === today;
        });
      default:
        return activeAdmissions;
    }
  };

  const filteredAdmissions = getFilteredAdmissions();
  const criticalCount = activeAdmissions.filter((a: any) => a.patient_condition === 'critical').length;
  const totalAdmissions = activeAdmissions.length;

  return (
    <>
      {/* Floating Button - Bottom Right Corner */}
      <div className="fixed bottom-6 right-6 float-animation" style={{ zIndex }}>
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-20 h-20 bg-white rounded-full shadow-2xl backdrop-blur-xl group hover:shadow-3xl"
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            overflow: 'visible'
          }}
        >
          {/* Donut Chart - Red Theme */}
          <svg className="absolute inset-1 w-[72px] h-[72px]" viewBox="0 0 72 72">
            {/* Background circle */}
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="#FEE2E2"
              strokeWidth="6"
              style={{
                transformOrigin: '50% 50%',
                transform: 'rotate(-90deg)'
              }}
            />

            {/* Critical patients segment */}
            {criticalCount > 0 && totalAdmissions > 0 && (
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke="#EF4444"
                strokeWidth="6"
                strokeLinecap="round"
                style={{
                  strokeDasharray: `${(criticalCount / totalAdmissions) * 188.5} 188.5`,
                  strokeDashoffset: 0,
                  transition: 'none',
                  transformOrigin: '50% 50%',
                  transform: 'rotate(-90deg)'
                }}
              />
            )}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{totalAdmissions}</p>
              <p className="text-xs text-gray-500 -mt-1">Patients</p>
            </div>
          </div>
        </button>

        {/* Notification Badge - Critical Patients */}
        {criticalCount > 0 && (
          <div className="absolute -top-1 -right-1">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1.5 shadow-lg">
                {criticalCount > 99 ? '99+' : criticalCount}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200"
            style={{ zIndex: zIndex + 10 }}
          />

          {/* Modal Content */}
          <div
            className="fixed inset-x-4 bottom-20 md:right-6 md:left-auto md:w-[580px] bg-white rounded-2xl shadow-2xl max-h-[85vh] h-[85vh] overflow-hidden flex flex-col"
            style={{ zIndex: zIndex + 20 }}
          >
            {/* Fixed Header */}
            <div className="flex-shrink-0 border-b border-gray-100 bg-white">
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {activeTab === 'admissions' ? 'Active Admissions' :
                       activeTab === 'alerts' ? 'Critical Alerts' :
                       activeTab === 'discharges' ? "Today's Discharges" :
                       'Messages & Notifications'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {activeTab === 'messages'
                        ? `${unreadNotificationCount} unread notifications`
                        : `${filteredAdmissions.length} ${activeTab === 'admissions' ? 'active patients' : activeTab === 'alerts' ? 'critical patients' : 'scheduled discharges'}`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Quick Stats Bar */}
                {stats && activeTab !== 'messages' && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 font-medium">Total Beds</p>
                      <p className="text-lg font-bold text-blue-900">{stats.beds.total}</p>
                    </div>
                    <div className="text-center p-2 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 font-medium">Occupied</p>
                      <p className="text-lg font-bold text-red-900">{stats.beds.occupied}</p>
                    </div>
                    <div className="text-center p-2 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 font-medium">Available</p>
                      <p className="text-lg font-bold text-green-900">{stats.beds.available}</p>
                    </div>
                    <div className="text-center p-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 font-medium">Critical</p>
                      <p className="text-lg font-bold text-orange-900">{stats.clinical.criticalPatients}</p>
                    </div>
                  </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg -mx-2">
                  <button
                    onClick={() => setActiveTab('admissions')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      activeTab === 'admissions'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-4 h-4" />
                    Patients
                    {activeAdmissions.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                        {activeAdmissions.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      activeTab === 'alerts'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" />
                    Alerts
                    {criticalCount > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                        {criticalCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('discharges')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      activeTab === 'discharges'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4" />
                    Discharge
                  </button>
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      activeTab === 'messages'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Icon icon="solar:chat-round-dots-bold-duotone" className="w-4 h-4" />
                    Messages
                    {unreadNotificationCount > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Single Scrollable Content Area */}
            <div className="relative flex-1 overflow-hidden">
              {activeTab === 'messages' ? (
                <NotificationsList
                  practiceId={practiceId}
                  userId={user?.id || ''}
                  className="h-full"
                />
              ) : (
                <>
                  {/* Scroll Shadow Indicators */}
                  <div className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${showTopShadow ? 'opacity-100' : 'opacity-0'}`}></div>
                  <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${showBottomShadow ? 'opacity-100' : 'opacity-0'}`}></div>

                  {/* High-performance Scrollable Container */}
                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="overflow-y-auto h-full scroll-smooth overscroll-contain"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarGutter: 'stable',
                      WebkitOverflowScrolling: 'touch',
                      scrollBehavior: 'smooth',
                      willChange: 'scroll-position'
                    }}
                  >
                    <div className="p-6 space-y-3">
                      {filteredAdmissions.length === 0 ? (
                        <div className="text-center py-8">
                          <Icon
                            icon={
                              activeTab === 'alerts'
                                ? "solar:shield-check-bold-duotone"
                                : activeTab === 'discharges'
                                ? "solar:calendar-remove-bold-duotone"
                                : "solar:hospital-bed-bold-duotone"
                            }
                            className="w-12 h-12 text-gray-300 mx-auto mb-3"
                          />
                          <p className="text-sm text-gray-500">
                            {activeTab === 'alerts'
                              ? 'No critical alerts'
                              : activeTab === 'discharges'
                              ? 'No discharges scheduled today'
                              : 'No active admissions'}
                          </p>
                        </div>
                      ) : (
                        filteredAdmissions.map((admission: any, index: number) => {
                          const lengthOfStay = Math.ceil((new Date().getTime() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24));

                          return (
                            <div
                              key={admission.id}
                              className="relative bg-white/80 backdrop-blur-xl rounded-xl border-2 border-dashed border-gray-300 shadow-lg group overflow-hidden hover:shadow-xl hover:bg-white/90 hover:scale-[1.02] hover:border-red-400 cursor-pointer transition-all duration-200"
                              onClick={() => {
                                setIsOpen(false);
                                navigate(`/inpatient/admissions/${admission.id}`);
                              }}
                            >
                              {/* Main card content */}
                              <div className="flex">
                                {/* Card Number Badge */}
                                <div className="flex-shrink-0 p-3">
                                  <div className={`w-9 h-9 rounded-lg backdrop-blur-md flex items-center justify-center text-sm font-bold shadow-lg ${
                                    admission.patient_condition === 'critical'
                                      ? 'bg-gradient-to-br from-red-500/90 to-red-600/90 text-white animate-pulse'
                                      : admission.patient_condition === 'serious'
                                      ? 'bg-gradient-to-br from-orange-500/90 to-orange-600/90 text-white'
                                      : 'bg-gradient-to-br from-green-500/90 to-green-600/90 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                </div>

                                {/* Main content area */}
                                <div className="flex-1 py-3 pr-3">
                                  {/* Patient Name */}
                                  <div className="font-semibold text-gray-900 group-hover:text-red-600 mb-0.5">
                                    {admission.patient?.first_name} {admission.patient?.last_name}
                                  </div>

                                  {/* Admission Number */}
                                  <div className="text-xs text-gray-500 mb-2">
                                    {admission.admission_number}
                                  </div>

                                  {/* Bed & Ward Info */}
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Icon icon="solar:hospital-bed-bold-duotone" className="w-3 h-3 text-red-500" />
                                      <span className="font-medium">{admission.current_bed?.ward_name || 'Unassigned'}</span>
                                      <span className="text-gray-400">•</span>
                                      <span>Bed {admission.current_bed?.bed_number || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Icon icon="solar:calendar-bold-duotone" className="w-3 h-3" />
                                      <span>Day {lengthOfStay}</span>
                                    </div>
                                  </div>

                                  {/* Diagnosis */}
                                  {admission.primary_diagnosis && (
                                    <p className="text-xs text-gray-500 mb-2 truncate">
                                      {admission.primary_diagnosis}
                                    </p>
                                  )}

                                  {/* Status Badge */}
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      'inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium',
                                      admission.patient_condition === 'critical'
                                        ? 'bg-red-100 text-red-700'
                                        : admission.patient_condition === 'serious'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-green-100 text-green-700'
                                    )}>
                                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                        admission.patient_condition === 'critical' ? 'bg-red-500 animate-pulse' :
                                        admission.patient_condition === 'serious' ? 'bg-orange-500' :
                                        'bg-green-500'
                                      }`} />
                                      {admission.patient_condition || 'Stable'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Actions for Alerts Tab */}
                              {activeTab === 'alerts' && (
                                <div className="border-t border-red-100/30 bg-gradient-to-r from-red-50/50 to-red-100/30 backdrop-blur-sm px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/inpatient/admissions/${admission.id}`);
                                      }}
                                      className="flex-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all"
                                    >
                                      <Icon icon="solar:stethoscope-bold-duotone" className="w-3 h-3 inline mr-1" />
                                      Review
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Add vitals check action
                                      }}
                                      className="flex-1 px-2 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-all"
                                    >
                                      <Icon icon="solar:heart-pulse-bold-duotone" className="w-3 h-3 inline mr-1" />
                                      Check Vitals
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Quick Actions for Discharge Tab */}
                              {activeTab === 'discharges' && (
                                <div className="border-t border-blue-100/30 bg-gradient-to-r from-blue-50/50 to-blue-100/30 backdrop-blur-sm px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Add discharge summary action
                                      }}
                                      className="flex-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-all"
                                    >
                                      <Icon icon="solar:document-text-bold-duotone" className="w-3 h-3 inline mr-1" />
                                      Summary
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Add discharge action
                                      }}
                                      className="flex-1 px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all"
                                    >
                                      <Icon icon="solar:clipboard-remove-bold-duotone" className="w-3 h-3 inline mr-1" />
                                      Discharge
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/inpatient/admissions/new');
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                New Admission
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default FloatingInpatientTracker;
