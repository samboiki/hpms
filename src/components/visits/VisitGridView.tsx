import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, Filter, Search, ChevronDown, 
  CheckCircle, XCircle, AlertCircle, Settings, MessageCircle,
  UserCheck, X, Activity, Play, UserX
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
// Removed framer-motion to prevent flickering
import { Visit, getVisitDisplayStatus, getVisitActions, isUnconfirmedBooking } from '../../types/enhanced-visit.types';
import VisitConfirmationModal from '../modals/VisitConfirmationModal';
import RescheduleVisitModal from '../modals/RescheduleVisitModal';
import VisitActionModal from '../modals/VisitActionModal';
import EnhancedSmsModal from '../messages/EnhancedSmsModal';

interface VisitGridViewProps {
  filterStatus?: 'all' | 'unconfirmed' | 'scheduled' | 'in-practice' | 'completed' | 'cancelled' | 'handed-off' | 'no-show' | 'booking-requests';
  practiceId: string;
  onClose: () => void;
}

export default function VisitGridView({ filterStatus = 'all', practiceId, onClose }: VisitGridViewProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [selectedVisitForAction, setSelectedVisitForAction] = useState<Visit | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedVisitForSMS, setSelectedVisitForSMS] = useState<Visit | null>(null);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);

  useEffect(() => {
    fetchVisits();
    const subscription = setupRealtimeSubscription();
    return () => {
      subscription.unsubscribe();
    };
  }, [practiceId]);

  useEffect(() => {
    filterVisits();
  }, [visits, searchTerm, dateFilter, filterStatus]);

  const setupRealtimeSubscription = () => {
    return supabase
      .channel('visits-grid-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits', filter: `practice_id=eq.${practiceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Only fetch for new visits to add them to the list
            fetchVisits();
            // Alert for new unconfirmed bookings
            if (payload.new && payload.new.is_scheduled && !payload.new.is_confirmed) {
              showNotification('New booking requires confirmation!');
            }
          } else if (payload.eventType === 'UPDATE') {
            // For updates, modify the existing item instead of refetching everything
            setVisits(prev => prev.map(v => 
              v.id === payload.new.id ? { ...v, ...payload.new } : v
            ));
          } else if (payload.eventType === 'DELETE') {
            setVisits(prev => prev.filter(v => v.id !== payload.old.id));
          }
        }
      )
      .subscribe();
  };

  const fetchVisits = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('visits')
        .select(`
          *,
          patient:patients(id, first_name, last_name, cell_number, email, date_of_birth),
          doctor:users!doctor_id(id, full_name, role)
        `)
        .eq('practice_id', practiceId)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .order('visit_date', { ascending: true })
        .order('visit_time', { ascending: true });

      // Apply status filters based on filterStatus prop
      if (filterStatus === 'unconfirmed') {
        query = query.eq('is_scheduled', true).eq('is_confirmed', false).eq('is_cancelled', false);
      } else if (filterStatus === 'booking-requests') {
        // Show only online booking requests that need confirmation
        query = query.eq('is_scheduled', true).eq('is_confirmed', false).eq('is_cancelled', false);
      } else if (filterStatus === 'scheduled') {
        query = query.eq('is_confirmed', true).eq('is_checked_in', false).eq('is_cancelled', false);
      } else if (filterStatus === 'in-practice') {
        query = query.eq('is_checked_in', true).eq('status', 'scheduled');
      } else if (filterStatus === 'completed') {
        query = query.eq('status', 'completed');
      } else if (filterStatus === 'cancelled') {
        query = query.or('is_cancelled.eq.true,status.eq.cancelled');
      } else if (filterStatus === 'handed-off') {
        query = query.eq('is_handoff', true).neq('status', 'completed');
      } else if (filterStatus === 'no-show') {
        query = query.or('is_no_show.eq.true,status.eq.no-show');
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const visitsData = data || [];
      setVisits(visitsData);
      
      // Count unconfirmed bookings
      const unconfirmed = visitsData.filter(v => isUnconfirmedBooking(v)).length;
      setUnconfirmedCount(unconfirmed);
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVisits = () => {
    let filtered = [...visits];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(visit => 
        visit.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.patient?.cell_number?.includes(searchTerm) ||
        visit.doctor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visit.chief_complaint?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(visit => {
          const visitDate = new Date(visit.scheduled_date || visit.visit_date);
          return visitDate.toDateString() === today.toDateString();
        });
        break;
      case 'week':
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filtered = filtered.filter(visit => {
          const visitDate = new Date(visit.scheduled_date || visit.visit_date);
          return visitDate >= today && visitDate <= weekEnd;
        });
        break;
      case 'month':
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        filtered = filtered.filter(visit => {
          const visitDate = new Date(visit.scheduled_date || visit.visit_date);
          return visitDate >= today && visitDate <= monthEnd;
        });
        break;
    }

    setFilteredVisits(filtered);
  };

  const showNotification = (message: string) => {
    // Implement your notification system here
    console.log('Notification:', message);
  };

  const handleConfirmVisit = async (visitId: string, doctorId?: string) => {
    try {
      const updateData: any = { 
        is_confirmed: true,
        updated_at: new Date().toISOString()
      };
      
      if (doctorId) {
        updateData.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Visit confirmed successfully');
      setShowConfirmationModal(false);
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error confirming visit:', error);
    }
  };

  const handleRejectVisit = async (visitId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_cancelled: true,
          status: 'cancelled',
          notes: reason ? `Rejected: ${reason}` : 'Rejected by practice',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Visit rejected');
      setShowConfirmationModal(false);
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error rejecting visit:', error);
    }
  };

  const handleCheckIn = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_checked_in: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Patient checked in');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error checking in patient:', error);
    }
  };

  const handleMarkReady = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_ready: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Patient marked as ready');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error marking patient ready:', error);
    }
  };

  const handleStartVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'in-progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Visit started');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error starting visit:', error);
    }
  };

  const handleNoShow = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'no-show',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Marked as no-show');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error marking no-show:', error);
    }
  };

  const handleHandoffVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          is_handoff: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Visit handed off');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error handing off visit:', error);
    }
  };

  const handleCompleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      showNotification('Visit completed');
      // Don't refetch - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error completing visit:', error);
    }
  };

  const renderActionButton = (visit: Visit, action: string) => {
    switch (action) {
      case 'confirm':
        return (
          <button
            onClick={() => {
              setSelectedVisit(visit);
              setShowConfirmationModal(true);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-green-600 hover:bg-green-50 w-full text-left"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm
          </button>
        );
      case 'check-in':
        return (
          <button
            onClick={() => {
              handleCheckIn(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 w-full text-left"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Check In
          </button>
        );
      case 'mark-ready':
        return (
          <button
            onClick={() => {
              handleMarkReady(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-green-600 hover:bg-green-50 w-full text-left"
          >
            <Activity className="w-4 h-4 mr-2" />
            Mark Ready
          </button>
        );
      case 'start-visit':
        return (
          <button
            onClick={() => {
              handleStartVisit(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 w-full text-left"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Visit
          </button>
        );
      case 'reschedule':
        return (
          <button
            onClick={() => {
              setSelectedVisit(visit);
              setShowRescheduleModal(true);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 w-full text-left"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Reschedule
          </button>
        );
      case 'no-show':
        return (
          <button
            onClick={() => {
              handleNoShow(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 w-full text-left"
          >
            <UserX className="w-4 h-4 mr-2" />
            No Show
          </button>
        );
      case 'cancel':
        return (
          <button
            onClick={() => {
              handleRejectVisit(visit.id, 'Cancelled by practice');
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </button>
        );
      case 'handoff':
        return (
          <button
            onClick={() => {
              handleHandoffVisit(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 w-full text-left"
          >
            <Activity className="w-4 h-4 mr-2" />
            Handoff
          </button>
        );
      case 'complete':
        return (
          <button
            onClick={() => {
              handleCompleteVisit(visit.id);
              setShowActionMenu(null);
            }}
            className="flex items-center px-3 py-2 text-sm text-green-600 hover:bg-green-50 w-full text-left"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete
          </button>
        );
      default:
        return null;
    }
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'alert-circle':
        return <AlertCircle className="w-4 h-4" />;
      case 'calendar':
        return <Calendar className="w-4 h-4" />;
      case 'user-check':
        return <UserCheck className="w-4 h-4" />;
      case 'activity':
        return <Activity className="w-4 h-4" />;
      case 'play':
        return <Play className="w-4 h-4" />;
      case 'check-circle':
        return <CheckCircle className="w-4 h-4" />;
      case 'x-circle':
        return <XCircle className="w-4 h-4" />;
      case 'user-x':
        return <UserX className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {filterStatus === 'booking-requests' ? 'Online Booking Requests' : 'Visit Management'}
            </h2>
            {filterStatus === 'booking-requests' ? (
              <span className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-full">
                Website Bookings
              </span>
            ) : (
              unconfirmedCount > 0 && (
                <span className="px-3 py-1 text-sm font-medium text-orange-700 bg-orange-100 rounded-full animate-pulse">
                  {unconfirmedCount} Unconfirmed
                </span>
              )
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by patient, doctor, or complaint..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setDateFilter(dateFilter === 'all' ? 'today' : 'all')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">
                  {dateFilter === 'all' ? 'All Dates' :
                   dateFilter === 'today' ? 'Today' :
                   dateFilter === 'week' ? 'This Week' : 'This Month'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Calendar className="w-12 h-12 mb-3 text-gray-300" />
            <p>No visits found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVisits.map((visit) => {
                const displayStatus = getVisitDisplayStatus(visit);
                const actions = getVisitActions(visit);
                
                return (
                  <tr
                    key={visit.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-cyan-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {visit.patient?.first_name} {visit.patient?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {visit.patient?.cell_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-900">
                            {format(new Date(visit.scheduled_date || visit.visit_date), 'MMM d, yyyy')}
                          </span>
                          <Clock className="w-4 h-4 text-gray-400 ml-3 mr-2" />
                          <span className="text-gray-600">
                            {visit.scheduled_time || visit.visit_time || 'Not set'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {visit.doctor?.full_name || 'Not assigned'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">
                          {visit.visit_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${displayStatus.bgColor} ${displayStatus.color}`}>
                          {getIcon(displayStatus.icon)}
                          <span className="ml-1">{displayStatus.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVisitForAction(visit);
                              setIsActionModalOpen(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Actions"
                          >
                            <Settings className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVisitForSMS(visit);
                              setIsSMSModalOpen(true);
                            }}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Send SMS"
                          >
                            <MessageCircle className="w-4 h-4 text-blue-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {selectedVisit && showConfirmationModal && (
        <VisitConfirmationModal
          visit={selectedVisit}
          onConfirm={handleConfirmVisit}
          onReject={handleRejectVisit}
          onClose={() => {
            setShowConfirmationModal(false);
            setSelectedVisit(null);
          }}
        />
      )}

      {selectedVisit && showRescheduleModal && (
        <RescheduleVisitModal
          visit={selectedVisit}
          onSuccess={() => {
            setShowRescheduleModal(false);
            setSelectedVisit(null);
            // Don't refetch - let real-time subscription handle updates to prevent flickering
          }}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedVisit(null);
          }}
        />
      )}

      {/* Visit Action Modal */}
      {selectedVisitForAction && (
        <VisitActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedVisitForAction(null);
          }}
          visit={selectedVisitForAction}
          visitStatus={
            selectedVisitForAction.status === 'in-progress' ? 'in-progress' :
            selectedVisitForAction.is_handoff ? 'handed-off' :
            selectedVisitForAction.is_ready ? 'ready' :
            selectedVisitForAction.is_checked_in ? 'scheduled' :
            selectedVisitForAction.is_confirmed ? 'scheduled' :
            selectedVisitForAction.status === 'completed' ? 'completed' :
            'scheduled'
          }
          isCheckedIn={selectedVisitForAction.is_checked_in}
          onStartVisit={() => handleStartVisit(selectedVisitForAction.id)}
          onCompleteVisit={() => handleCompleteVisit(selectedVisitForAction.id)}
          onHandoffVisit={() => handleHandoffVisit(selectedVisitForAction.id)}
          onCheckIn={() => handleCheckIn(selectedVisitForAction.id)}
          onMarkReady={() => handleMarkReady(selectedVisitForAction.id)}
          onNoShow={() => handleNoShow(selectedVisitForAction.id)}
          onReschedule={() => {
            setSelectedVisit(selectedVisitForAction);
            setShowRescheduleModal(true);
          }}
          onCancel={() => handleRejectVisit(selectedVisitForAction.id, 'Cancelled by practice')}
          onViewDetails={() => {
            // Open edit visit modal instead of navigating
            handleEditVisit(selectedVisitForAction);
            setIsActionModalOpen(false);
            setSelectedVisitForAction(null);
          }}
          onSendSMS={() => {
            setSelectedVisitForSMS(selectedVisitForAction);
            setIsSMSModalOpen(true);
          }}
        />
      )}

      {/* SMS Modal */}
      {selectedVisitForSMS && (
        <EnhancedSmsModal
          isOpen={isSMSModalOpen}
          onClose={() => {
            setIsSMSModalOpen(false);
            setSelectedVisitForSMS(null);
          }}
          patientId={selectedVisitForSMS.patient_id}
          patientName={`${selectedVisitForSMS.patient?.first_name || ''} ${selectedVisitForSMS.patient?.last_name || ''}`}
          patientPhone={selectedVisitForSMS.patient?.cell_number || ''}
        />
      )}
    </div>
  );
}