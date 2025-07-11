import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/ui/Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePracticeSettings } from '../hooks/usePracticeSettings';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  MoreVertical
} from 'lucide-react';

// Import existing components
import SmartAutomations from '../components/messages/SmartAutomations';
import { CommunicationsDashboard } from '../components/communications/CommunicationsDashboard';
import { EnhancedMessagingV2 } from '../components/messages/InternalMessaging/EnhancedMessagingV2';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';
import { NotificationBadge } from '../components/ui/NotificationBadge';
import { DeliveryStatsDashboard } from '../components/communications/DeliveryStatsDashboard';
import { TelemedicineRoom } from '../components/telemedicine/TelemedicineRoom';
import { toast } from 'react-hot-toast';
import { communicationService } from '../services/communicationService';
import { unreadMessagesService } from '../services/unreadMessagesService';
import FormModal from '../components/modals/FormModal';
import PremiumAddAppointmentForm from '../components/forms/PremiumAddAppointmentForm';

type TabType = 'dashboard' | 'messaging' | 'automations' | 'telemedicine';




const Communications: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { settings: practiceSettings, loading: settingsLoading } = usePracticeSettings();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDeliveryStats, setShowDeliveryStats] = useState(false);
  
  const [currentPracticeData, setCurrentPracticeData] = useState<{
    id: string;
    name: string;
    contact_phone?: string;
    website_url?: string;
    domain?: string;
  } | null>(null);
  const [, setIsLoading] = useState(true);
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  
  // Telemedicine state
  const [showTelemedicineRoom, setShowTelemedicineRoom] = useState(false);
  const [currentTelemedicineSession, setCurrentTelemedicineSession] = useState<{
    roomUrl: string;
    patientName: string;
    doctorName: string;
    appointmentId: string;
  } | null>(null);
  interface TelemedicineVisit {
    id: string;
    practice_id: string;
    patient_id: string;
    visit_date: string;
    visit_time?: string;
    scheduled_time?: string;
    visit_type?: string;
    status?: string;
    is_checked_in?: boolean;
    patient?: {
      id: string;
      first_name: string;
      last_name: string;
      mobile_phone?: string;
      email?: string;
    };
    doctor?: {
      id: string;
      first_name: string;
      last_name: string;
      email?: string;
    };
  }
  
  const [upcomingTelemedicineVisits, setUpcomingTelemedicineVisits] = useState<TelemedicineVisit[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Get practice ID from logged-in user
  const practiceId = user?.practice_id;

  // Subscribe to unread messages
  useEffect(() => {
    if (user?.id && practiceId) {
      const unsubscribe = unreadMessagesService.subscribe(setUnreadCount);
      return () => unsubscribe();
    }
  }, [user?.id, practiceId]);

  // Load current practice data
  useEffect(() => {
    const loadPracticeData = async () => {
      if (!practiceId) return;
      
      try {
        const { data: practice, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId)
          .single();
          
        if (error) throw error;
        setCurrentPracticeData(practice);
      } catch (error) {
        console.error('Error loading practice data:', error);
      }
    };
    
    if (practiceId) {
      loadPracticeData();
    }
  }, [practiceId]);


  // Load communication stats only after practice settings are available
  useEffect(() => {
    if (practiceId && practiceSettings && !settingsLoading) {
      loadCommunicationStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, practiceSettings, settingsLoading]);


  // Fetch telemedicine visits
  useEffect(() => {
    const fetchTelemedicineVisits = async () => {
      if (!practiceId || activeTab !== 'telemedicine') return;
      
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('visits')
          .select(`
            *,
            patient:patients(
              id,
              first_name,
              last_name,
              mobile_phone,
              email
            ),
            doctor:users(
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq('practice_id', practiceId)
          .eq('visit_date', today)
          .eq('status', 'checked_in')
          .or('status.eq.scheduled,status.eq.confirmed')
          .order('scheduled_time', { ascending: true });
        
        if (error) throw error;
        
        setUpcomingTelemedicineVisits(data || []);
      } catch (error) {
        console.error('Error fetching telemedicine visits:', error);
      }
    };
    
    fetchTelemedicineVisits();
  }, [practiceId, activeTab]);

  const loadCommunicationStats = async () => {
    try {
      setIsLoading(true);
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      console.log('📊 Loading communication stats for practice:', practiceId);
      console.log('🔧 Practice settings available:', !!practiceSettings);
      console.log('📱 SMS Limits - Available:', practiceSettings?.smsRemaining, 'Used:', practiceSettings?.smsUsed, 'Total:', practiceSettings?.smsLimit);
      console.log('📧 Email Limits - Available:', practiceSettings?.emailRemaining, 'Used:', practiceSettings?.emailUsed, 'Total:', practiceSettings?.emailLimit);

      // Load SMS usage
      const { data: smsUsage, error: smsError } = await supabase
        .from('sms_usage_logs')
        .select('*')
        .eq('practice_id', practiceId)
        .gte('sent_at', startOfToday)
        .lte('sent_at', endOfToday);

      if (smsError) {
        console.error('SMS usage error:', smsError);
      }

      // Load email stats
      const { data: emailStats, error: emailError } = await supabase
        .from('communications_log_view')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('communication_type', 'email')
        .gte('created_at', startOfToday)
        .lte('created_at', endOfToday);

      if (emailError) {
        console.error('Email stats error:', emailError);
      }


      // Use real practice settings for stats - ensure we have valid numbers
      const smsStats = {
        available: Math.max(0, practiceSettings?.smsRemaining || 0),
        assigned: Math.max(0, practiceSettings?.smsLimit || 0),
        used: Math.max(0, practiceSettings?.smsUsed || 0),
        cost: smsUsage?.reduce((sum: number, msg: { cost?: number }) => sum + (msg.cost || 0), 0) || 0
      };

      const emailStatsCalculated = {
        available: Math.max(0, practiceSettings?.emailRemaining || 0),
        assigned: Math.max(0, practiceSettings?.emailLimit || 0),
        used: Math.max(0, practiceSettings?.emailUsed || 0),
        delivered: emailStats?.filter((e: { status: string }) => e.status === 'sent' || e.status === 'delivered').length || 0,
        opened: emailStats?.filter((e: { read_at: string | null }) => e.read_at).length || 0,
        failed: emailStats?.filter((e: { status: string }) => e.status === 'failed').length || 0
      };

      // Calculate available communication services (total number of services)
      const totalAvailableServices = 8; // 8 services total

      console.log('📊 Final stats calculated:', {
        sms: smsStats,
        email: emailStatsCalculated,
        totalServices: totalAvailableServices
      });

      // Stats tracking removed - data is now available in smsStats and emailStatsCalculated variables
    } catch (error) {
      console.error('Error loading communication stats:', error);
    } finally {
      setIsLoading(false);
    }
  };






  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'solar:chart-bold-duotone', description: 'Overview & Stats' },
    { id: 'messaging', label: 'Messaging', icon: 'solar:chat-round-dots-bold-duotone', description: 'All Messages', badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'automations', label: 'Automations', icon: 'solar:widget-add-bold-duotone', description: 'Smart Workflows' },
    { id: 'telemedicine', label: 'Telemedicine', icon: 'solar:videocamera-bold-duotone', description: 'Virtual Care' }
  ];

  const tabIcons: { [key in TabType]: string } = {
    dashboard: 'solar:chart-bold-duotone',
    messaging: 'solar:chat-round-dots-bold-duotone',
    automations: 'solar:widget-add-bold-duotone',
    telemedicine: 'solar:videocamera-bold-duotone'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        
        {/* Header Section */}
        <div className="rounded-xl">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              {/* Page Title and Icon */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                  <Icon icon="solar:letter-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">Communications Center</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Manage all your practice communications</p>
                </div>
              </div>

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="relative group focus:outline-none"
                  >
                    {/* Pulsating outer ring - ORANGE */}
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full opacity-50"></div>
                    
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
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img 
                                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
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
                            logout();
                          }}
                          className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:logout-3-bold-duotone" className="w-5 h-5" />
                          <span>Sign Out</span>
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

        {/* Premium Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-0 w-full">
            {(tabs).map((tab) => {
              const iconName = tabIcons[tab.id as TabType];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize min-h-[60px] ${
                    isActive
                      ? `bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={iconName} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="truncate text-center sm:text-left">{tab.label}</span>
                  {tab.badge && tab.badge > 0 && (
                    <NotificationBadge 
                      count={tab.badge} 
                      size="sm" 
                      animate={false}
                      className="absolute top-2 right-2"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-transparent rounded-2xl shadow-none border-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="min-h-[600px]"
            >
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Toggle Button for Delivery Stats */}
                  <div className="flex justify-end px-6">
                    <button
                      onClick={() => setShowDeliveryStats(!showDeliveryStats)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        showDeliveryStats 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Icon icon="solar:delivery-bold-duotone" className="w-5 h-5" />
                      {showDeliveryStats ? 'Hide' : 'Show'} Delivery Tracking
                    </button>
                  </div>
                  
                  {/* Main Dashboard or Delivery Stats */}
                  {showDeliveryStats ? (
                    <DeliveryStatsDashboard 
                      practiceId={practiceId || ''} 
                      className="px-6 pb-6"
                    />
                  ) : (
                    <CommunicationsDashboard />
                  )}
                </div>
              )}

              {/* Messaging Tab - Enhanced Internal Messaging System V2 */}
              {activeTab === 'messaging' && (
                <EnhancedMessagingV2 
                  practiceId={practiceId || ''} 
                />
              )}


              {/* Automations Tab */}
              {activeTab === 'automations' && (
                <div className="h-full">
                  <SmartAutomations />
                </div>
              )}


              {/* Telemedicine Tab */}
              {activeTab === 'telemedicine' && (
                <div className="space-y-6">
                  {/* Header - matching other tabs */}
                  <div className="px-6 pt-6">
                    <div className="mb-8">
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">Telemedicine</h2>
                      <p className="text-gray-600">Provide virtual healthcare consultations and remote patient care</p>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        toast('Select a patient from the upcoming appointments to start a consultation', {
                          icon: 'ℹ️',
                        });
                      }}
                      className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <Icon icon="solar:video-frame-play-horizontal-bold-duotone" className="w-12 h-12 mb-3" />
                      <h3 className="text-lg font-semibold mb-1">Start Virtual Consultation</h3>
                      <p className="text-sm opacity-90">Begin telemedicine session now</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsScheduleModalOpen(true);
                      }}
                      className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <Icon icon="solar:calendar-add-bold-duotone" className="w-12 h-12 mb-3" />
                      <h3 className="text-lg font-semibold mb-1">Schedule Appointment</h3>
                      <p className="text-sm opacity-90">Book a telemedicine visit</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all"
                    >
                      <Icon icon="solar:users-group-rounded-bold-duotone" className="w-12 h-12 mb-3" />
                      <h3 className="text-lg font-semibold mb-1">Virtual Waiting Room</h3>
                      <p className="text-sm opacity-90">
                        {upcomingTelemedicineVisits.filter(v => v.status === 'checked_in').length} patients waiting
                      </p>
                    </motion.button>
                  </div>

                    {/* Upcoming Consultations */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-amber-500" />
                        Today's Telemedicine Appointments
                      </h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {format(new Date(), 'EEEE, MMM d')}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {upcomingTelemedicineVisits.length === 0 ? (
                        <div className="text-center py-8">
                          <Icon icon="solar:video-frame-cut-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No telemedicine appointments scheduled for today</p>
                        </div>
                      ) : (
                        upcomingTelemedicineVisits.map((visit) => {
                          const initials = visit.patient ? 
                            `${visit.patient.first_name?.[0] || ''}${visit.patient.last_name?.[0] || ''}` : 
                            'P';
                          const bgColors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500'];
                          const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
                          
                          const isCheckedIn = visit.status === 'checked_in';
                          return (
                            <div 
                              key={visit.id} 
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                isCheckedIn ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center text-white font-semibold`}>
                                  {initials}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {visit.patient?.first_name} {visit.patient?.last_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {visit.visit_type || 'Telemedicine Consultation'} • {visit.scheduled_time || visit.visit_time}
                                  </p>
                                  {isCheckedIn && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                      <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                                      Patient checked in - Ready to start
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isCheckedIn ? (
                                  <button 
                                    onClick={async () => {
                                      const roomName = `hpms-${user?.practice_id}-${visit.id}`;
                                      const roomUrl = `https://meet.jit.si/${roomName}`;
                                      
                                      // Set up the session
                                      setCurrentTelemedicineSession({
                                        roomUrl,
                                        patientName: `${visit.patient?.first_name} ${visit.patient?.last_name}`,
                                        doctorName: user?.first_name + ' ' + user?.last_name || 'Doctor',
                                        appointmentId: visit.id
                                      });
                                      
                                      // Send SMS to patient with room link
                                      if (visit.patient?.mobile_phone) {
                                        try {
                                          await communicationService.sendSMS({
                                            practiceId: user?.practice_id || '',
                                            recipientPhone: visit.patient.mobile_phone,
                                            messageContent: `Your telemedicine appointment is starting now. Join here: ${roomUrl}`,
                                            messageType: 'telemedicine_invite',
                                            patientId: visit.patient_id,
                                            appointmentId: visit.id
                                          });
                                          toast.success('Patient has been notified');
                                        } catch (error) {
                                          console.error('Failed to send SMS:', error);
                                        }
                                      }
                                      
                                      setShowTelemedicineRoom(true);
                                    }}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                  >
                                    <Icon icon="solar:video-camera-bold" className="w-4 h-4" />
                                    Start Call
                                  </button>
                                ) : (
                                  <span className="text-sm text-gray-500">
                                    Waiting for check-in
                                  </span>
                                )}
                                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-4 text-center">
                      <button 
                        onClick={() => window.location.href = '/appointments?type=telemedicine'}
                        className="text-amber-600 hover:text-amber-700 font-medium text-sm"
                      >
                        View All Telemedicine Appointments →
                      </button>
                    </div>
                  </div>

                  {/* Meeting Settings */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Icon icon="solar:settings-bold-duotone" className="w-6 h-6 text-gray-600" />
                      Telemedicine Settings
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Auto-record sessions</p>
                          <p className="text-sm text-gray-500">Save telemedicine recordings for medical records</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Send reminders</p>
                          <p className="text-sm text-gray-500">Notify patients 15 minutes before appointment</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Waiting room</p>
                          <p className="text-sm text-gray-500">Patients wait for approval before joining</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Visit Tracker */}
      {practiceId && (
        <FloatingVisitTracker practiceId={practiceId} />
      )}

      {/* Telemedicine Room Modal */}
      {showTelemedicineRoom && currentTelemedicineSession && (
        <TelemedicineRoom
          roomUrl={currentTelemedicineSession.roomUrl}
          patientName={currentTelemedicineSession.patientName}
          doctorName={currentTelemedicineSession.doctorName}
          appointmentId={currentTelemedicineSession.appointmentId}
          onEnd={() => {
            setShowTelemedicineRoom(false);
            setCurrentTelemedicineSession(null);
            
            // Refresh the visits list
            if (practiceId && activeTab === 'telemedicine') {
              const fetchTelemedicineVisits = async () => {
                try {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  const { data, error } = await supabase
                    .from('visits')
                    .select(`
                      *,
                      patient:patients(
                        id,
                        first_name,
                        last_name,
                        mobile_phone,
                        email
                      ),
                      doctor:users(
                        id,
                        first_name,
                        last_name,
                        email
                      )
                    `)
                    .eq('practice_id', practiceId)
                    .eq('visit_date', today)
                    .eq('status', 'checked_in')
          .or('status.eq.scheduled,status.eq.confirmed')
                    .order('scheduled_time', { ascending: true });
                  
                  if (error) throw error;
                  
                  setUpcomingTelemedicineVisits(data || []);
                } catch (error) {
                  console.error('Error fetching telemedicine visits:', error);
                }
              };
              
              fetchTelemedicineVisits();
            }
            
            toast.success('Telemedicine session ended');
          }}
        />
      )}
      {/* Schedule Appointment Modal */}
      <FormModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Telemedicine Appointment"
      >
        <PremiumAddAppointmentForm
          onSuccess={() => {
            setIsScheduleModalOpen(false);
            // Refresh telemedicine visits
            if (practiceId && activeTab === 'telemedicine') {
              const today = format(new Date(), 'yyyy-MM-dd');
              supabase
                .from('visits')
                .select(`
                  *,
                  patient:patients(
                    id,
                    first_name,
                    last_name,
                    mobile_phone,
                    email
                  ),
                  doctor:users(
                    id,
                    first_name,
                    last_name,
                    email
                  )
                `)
                .eq('practice_id', practiceId)
                .eq('visit_date', today)
                .eq('status', 'checked_in')
                .or('status.eq.scheduled,status.eq.confirmed')
                .order('scheduled_time', { ascending: true })
                .then(({ data, error }) => {
                  if (!error) {
                    setUpcomingTelemedicineVisits(data || []);
                  }
                });
            }
            toast.success('Appointment scheduled successfully');
          }}
          onCancel={() => setIsScheduleModalOpen(false)}
        />
      </FormModal>
    </div>
  );
};

export default Communications;