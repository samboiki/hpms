import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Visit, getVisitDisplayStatus, getVisitActions } from '../../types/enhanced-visit.types';
import { motion, AnimatePresence } from 'framer-motion';
import DuotoneIcon from '../icons/DuotoneIcon';

interface EnhancedVisitTimelineProps {
  patientId?: string;
  doctorId?: string;
  practiceId?: string;
  limit?: number;
  showActions?: boolean;
}

export default function EnhancedVisitTimeline({ 
  patientId, 
  doctorId, 
  practiceId,
  limit,
  showActions = true
}: EnhancedVisitTimelineProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'unconfirmed'>('all');

  useEffect(() => {
    fetchVisits();
    const subscription = setupRealtimeSubscription();
    return () => {
      subscription.unsubscribe();
    };
  }, [patientId, doctorId, practiceId, filter]);

  const setupRealtimeSubscription = () => {
    let channel = supabase.channel('visits-timeline-changes');
    
    if (patientId) {
      channel = channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits', filter: `patient_id=eq.${patientId}` },
        handleRealtimeUpdate
      );
    } else if (doctorId) {
      channel = channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits', filter: `doctor_id=eq.${doctorId}` },
        handleRealtimeUpdate
      );
    } else if (practiceId) {
      channel = channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits', filter: `practice_id=eq.${practiceId}` },
        handleRealtimeUpdate
      );
    }
    
    return channel.subscribe();
  };

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      fetchVisits();
    } else if (payload.eventType === 'DELETE') {
      setVisits(prev => prev.filter(v => v.id !== payload.old.id));
    }
  };

  const fetchVisits = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('visits')
        .select(`
          *,
          patient:patients!fk_visits_patient_id(id, first_name, last_name, cell_number, email),
          doctor:users!doctor_id(id, full_name, role),
          vitals!fk_vitals_visit_id(*),
          lab_requests(count)
        `)
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false })
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }
      if (practiceId) {
        query = query.eq('practice_id', practiceId);
      }

      // Apply filters
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filter === 'unconfirmed') {
        query = query.eq('is_scheduled', true).eq('is_confirmed', false).eq('is_cancelled', false);
      } else if (filter === 'upcoming') {
        query = query.gte('scheduled_date', format(today, 'yyyy-MM-dd'));
      } else if (filter === 'past') {
        query = query.lt('scheduled_date', format(today, 'yyyy-MM-dd'));
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (visitId: string) => {
    setExpandedVisits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(visitId)) {
        newSet.delete(visitId);
      } else {
        newSet.add(visitId);
      }
      return newSet;
    });
  };

  const handleAction = async (visitId: string, action: string) => {
    try {
      switch (action) {
        case 'confirm':
          await supabase.from('visits').update({ 
            is_confirmed: true,
            updated_at: new Date().toISOString()
          }).eq('id', visitId);
          break;
        case 'check-in':
          await supabase.from('visits').update({ 
            is_checked_in: true,
            updated_at: new Date().toISOString()
          }).eq('id', visitId);
          break;
        case 'mark-ready':
          await supabase.from('visits').update({ 
            is_ready: true,
            updated_at: new Date().toISOString()
          }).eq('id', visitId);
          break;
        case 'start-visit':
          await supabase.from('visits').update({ 
            status: 'in-progress',
            updated_at: new Date().toISOString()
          }).eq('id', visitId);
          break;
        case 'complete':
          await supabase.from('visits').update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          }).eq('id', visitId);
          break;
      }
      fetchVisits();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    }
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'alert-circle':
        return <Icon icon="solar:danger-circle-bold-duotone" className="w-5 h-5" />;
      case 'calendar':
        return <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5" />;
      case 'user-check':
        return <Icon icon="solar:user-check-rounded-bold-duotone" className="w-5 h-5" />;
      case 'activity':
        return <Icon icon="solar:pulse-bold-duotone" className="w-5 h-5" />;
      case 'play':
        return <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />;
      case 'check-circle':
        return <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />;
      case 'x-circle':
        return <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />;
      case 'user-x':
        return <Icon icon="solar:user-cross-rounded-bold-duotone" className="w-5 h-5" />;
      default:
        return <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5" />;
    }
  };

  const getStatusColor = (visit: Visit) => {
    if (visit.status === 'completed') return '#10b981'; // emerald-500
    if (visit.is_cancelled) return '#ef4444'; // red-500
    if (visit.is_ready) return '#10b981'; // emerald-500
    if (visit.is_checked_in) return '#3b82f6'; // blue-500
    if (visit.is_confirmed) return '#3b82f6'; // blue-500
    return '#f59e0b'; // amber-500
  };

  const getStatusIcon = (visit: Visit) => {
    if (visit.status === 'completed') return 'check-circle';
    if (visit.is_cancelled) return 'x-circle';
    if (visit.is_ready) return 'activity';
    if (visit.is_checked_in) return 'user-check';
    if (visit.is_confirmed) return 'calendar';
    return 'alert-circle';
  };

  const getVisitTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'stethoscope';
      case 'follow-up':
        return 'calendar';
      case 'procedure':
        return 'activity';
      case 'emergency':
        return 'alert-circle';
      default:
        return 'file-text';
    }
  };

  const getVisitTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return '#01b9d4'; // brand-primary
      case 'follow-up':
        return '#a855f7'; // purple-500
      case 'procedure':
        return '#3b82f6'; // blue-500
      case 'emergency':
        return '#ef4444'; // red-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getVisitDate = (visit: Visit) => {
    return new Date(visit.scheduled_date || visit.visit_date);
  };

  const getVisitTime = (visit: Visit) => {
    return visit.scheduled_time || visit.visit_time || '';
  };

  const groupVisitsByDate = () => {
    const grouped: { [key: string]: Visit[] } = {};
    
    visits.forEach(visit => {
      const date = format(getVisitDate(visit), 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(visit);
    });

    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const groupedVisits = groupVisitsByDate();
  const unconfirmedCount = visits.filter(v => v.is_scheduled && !v.is_confirmed && !v.is_cancelled).length;

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-cyan-100 text-cyan-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All Visits
        </button>
        {unconfirmedCount > 0 && (
          <button
            onClick={() => setFilter('unconfirmed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              filter === 'unconfirmed'
                ? 'bg-orange-100 text-orange-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unconfirmed
            <span className="px-2 py-0.5 text-xs bg-orange-200 rounded-full">
              {unconfirmedCount}
            </span>
          </button>
        )}
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'upcoming'
              ? 'bg-cyan-100 text-cyan-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'past'
              ? 'bg-cyan-100 text-cyan-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Past
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {groupedVisits.map(([date, dateVisits]) => {
          const displayDate = new Date(date);
          const isDateToday = isToday(displayDate);
          const isDateFuture = isFuture(displayDate);
          
          return (
            <div key={date} className="mb-8">
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`relative z-10 px-3 py-1 rounded-full text-sm font-medium ${
                  isDateToday 
                    ? 'bg-cyan-100 text-cyan-700' 
                    : isDateFuture
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {isDateToday ? 'Today' : format(displayDate, 'EEEE, MMMM d')}
                </div>
              </div>

              {/* Visits for this date */}
              <div className="space-y-4">
                {dateVisits.map((visit) => {
                  const displayStatus = getVisitDisplayStatus(visit);
                  const actions = getVisitActions(visit);
                  const isExpanded = expandedVisits.has(visit.id);
                  
                  return (
                    <motion.div
                      key={visit.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative group"
                    >
                      {/* Timeline Dot */}
                      <div 
                        className="absolute left-7 top-4 w-4 h-4 rounded-full border-2 border-white z-10 shadow-lg"
                        style={{ 
                          backgroundColor: getStatusColor(visit),
                          boxShadow: `0 0 10px ${getStatusColor(visit)}30`
                        }}
                      >
                        <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      </div>

                      {/* Compact Visit Card with Trapezoidal Cutout */}
                      <div className="ml-12 relative overflow-hidden">
                        {/* Trapezoidal cutout on the left side */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-6 z-10"
                          style={{
                            background: getStatusColor(visit),
                            clipPath: 'polygon(0% 0%, 70% 15%, 70% 85%, 0% 100%)',
                            boxShadow: `0 0 20px ${getStatusColor(visit)}20`
                          }}
                        />
                        
                        {/* Status indicator icon in the cutout */}
                        <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-20">
                          <DuotoneIcon 
                            icon={getStatusIcon(visit)}
                            className="w-4 h-4 text-white"
                          />
                        </div>

                        {/* Main card content */}
                        <div className="relative bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:bg-white/90 ml-4">
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => toggleExpanded(visit.id)}
                          >
                            {/* Header Section */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3 flex-1">
                                <div 
                                  className="p-2 rounded-lg backdrop-blur-sm border border-white/50"
                                  style={{ 
                                    backgroundColor: `${getVisitTypeColor(visit.visit_type)}15`,
                                    borderColor: `${getVisitTypeColor(visit.visit_type)}30`
                                  }}
                                >
                                  <DuotoneIcon 
                                    icon={getVisitTypeIcon(visit.visit_type)}
                                    className="w-4 h-4"
                                    primaryColor={getVisitTypeColor(visit.visit_type)}
                                    secondaryColor={`${getVisitTypeColor(visit.visit_type)}60`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-semibold text-gray-900 truncate capitalize">
                                    {visit.visit_type} Visit
                                  </h3>
                                  <p className="text-xs text-gray-500 flex items-center">
                                    <DuotoneIcon icon="clock" className="w-3 h-3 mr-1" />
                                    {getVisitTime(visit) || 'No time set'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${displayStatus.bgColor} ${displayStatus.color}`}>
                                  {getIcon(displayStatus.icon)}
                                  <span className="ml-1">{displayStatus.label}</span>
                                </span>
                                <div className="ml-2">
                                  {isExpanded ? (
                                    <DuotoneIcon icon="chevron-up" className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <DuotoneIcon icon="chevron-down" className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Patient/Doctor Info */}
                            <div className="flex items-center text-xs text-gray-600 mb-3">
                              <DuotoneIcon icon="user-round" className="w-3 h-3 mr-1" />
                              {patientId ? (
                                <span>Dr. {visit.doctor?.full_name || 'Not assigned'}</span>
                              ) : (
                                <span>{visit.patient?.first_name} {visit.patient?.last_name}</span>
                              )}
                            </div>

                            {/* Chief Complaint */}
                            {visit.chief_complaint && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  <span className="font-medium">Chief Complaint:</span> {visit.chief_complaint}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-16 bg-white/90 backdrop-blur-sm border border-white/50 rounded-b-xl shadow-sm">
                              <div className="px-4 pb-4 pt-4">
                                {/* Visit Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                  {visit.diagnosis && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1 font-medium">Diagnosis</p>
                                      <p className="text-sm text-gray-700">{visit.diagnosis}</p>
                                    </div>
                                  )}
                                  {visit.treatment_plan && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1 font-medium">Treatment Plan</p>
                                      <p className="text-sm text-gray-700">{visit.treatment_plan}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Compact Stats Grid */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                  {visit.vitals && visit.vitals.length > 0 && (
                                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white/30">
                                      <div className="flex items-center text-xs text-gray-600">
                                        <DuotoneIcon icon="activity" className="w-3 h-3 mr-1" primaryColor="#6b7280" />
                                        Vitals
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900">Recorded</p>
                                    </div>
                                  )}
                                  {visit.lab_results && visit.lab_results[0]?.count > 0 && (
                                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white/30">
                                      <div className="flex items-center text-xs text-gray-600">
                                        <DuotoneIcon icon="file-text" className="w-3 h-3 mr-1" primaryColor="#6b7280" />
                                        Labs
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900">{visit.lab_results[0].count}</p>
                                    </div>
                                  )}
                                  {visit.prescription && (
                                    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white/30">
                                      <div className="flex items-center text-xs text-gray-600">
                                        <DuotoneIcon icon="pill" className="w-3 h-3 mr-1" primaryColor="#6b7280" />
                                        Prescription
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900">Given</p>
                                    </div>
                                  )}
                                </div>

                                {/* Compact Action Buttons */}
                                {showActions && actions.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-3 border-t border-gray-200/50">
                                    {actions.includes('confirm') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'confirm');
                                        }}
                                        className="flex items-center px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                      >
                                        <DuotoneIcon icon="check-circle" className="w-3 h-3 mr-1" />
                                        Confirm
                                      </button>
                                    )}
                                    {actions.includes('check-in') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'check-in');
                                        }}
                                        className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                      >
                                        <DuotoneIcon icon="user-check" className="w-3 h-3 mr-1" />
                                        Check In
                                      </button>
                                    )}
                                    {actions.includes('mark-ready') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'mark-ready');
                                        }}
                                        className="flex items-center px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                      >
                                        <DuotoneIcon icon="activity" className="w-3 h-3 mr-1" />
                                        Mark Ready
                                      </button>
                                    )}
                                    {actions.includes('start-visit') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'start-visit');
                                        }}
                                        className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                      >
                                        <DuotoneIcon icon="activity" className="w-3 h-3 mr-1" />
                                        Start Visit
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visits.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <DuotoneIcon icon="calendar" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No visits found</p>
          </div>
        )}
      </div>
    </div>
  );
}