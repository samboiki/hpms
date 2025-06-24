import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, ChevronDown, ChevronUp, 
  CheckCircle, XCircle, AlertCircle, Play, UserCheck,
  Activity, FileText, Pill, Heart, UserX
} from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Visit, getVisitDisplayStatus, getVisitActions } from '../../types/enhanced-visit.types';
import { motion, AnimatePresence } from 'framer-motion';

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
          patient:patients(id, first_name, last_name, cell_number, email),
          doctor:users!doctor_id(id, full_name, role),
          vitals(*),
          lab_results(count),
          media_requests(count)
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
        return <AlertCircle className="w-5 h-5" />;
      case 'calendar':
        return <Calendar className="w-5 h-5" />;
      case 'user-check':
        return <UserCheck className="w-5 h-5" />;
      case 'activity':
        return <Activity className="w-5 h-5" />;
      case 'play':
        return <Play className="w-5 h-5" />;
      case 'check-circle':
        return <CheckCircle className="w-5 h-5" />;
      case 'x-circle':
        return <XCircle className="w-5 h-5" />;
      case 'user-x':
        return <UserX className="w-5 h-5" />;
      default:
        return <Calendar className="w-5 h-5" />;
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
                      className="relative"
                    >
                      {/* Timeline Dot */}
                      <div className={`absolute left-7 top-6 w-4 h-4 rounded-full border-2 border-white z-10 ${
                        visit.status === 'completed' ? 'bg-gray-400' :
                        visit.is_cancelled ? 'bg-red-400' :
                        visit.is_ready ? 'bg-green-400 animate-pulse' :
                        visit.is_checked_in ? 'bg-green-400' :
                        visit.is_confirmed ? 'bg-blue-400' :
                        'bg-orange-400'
                      }`}></div>

                      {/* Visit Card */}
                      <div className="ml-16 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleExpanded(visit.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${displayStatus.bgColor} ${displayStatus.color}`}>
                                  {getIcon(displayStatus.icon)}
                                  <span className="ml-1">{displayStatus.label}</span>
                                </span>
                                <span className="text-sm text-gray-500">
                                  {getVisitTime(visit) || 'No time set'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm">
                                {patientId ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">
                                      Dr. {visit.doctor?.full_name || 'Not assigned'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">
                                      {visit.patient?.first_name} {visit.patient?.last_name}
                                    </span>
                                  </div>
                                )}
                                
                                <span className="text-gray-500 capitalize">
                                  {visit.visit_type}
                                </span>
                              </div>

                              {visit.chief_complaint && (
                                <p className="mt-2 text-sm text-gray-600">
                                  {visit.chief_complaint}
                                </p>
                              )}
                            </div>
                            
                            <div className="ml-4">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
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
                              <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                                {/* Visit Details */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  {visit.diagnosis && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Diagnosis</p>
                                      <p className="text-sm">{visit.diagnosis}</p>
                                    </div>
                                  )}
                                  {visit.treatment_plan && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Treatment Plan</p>
                                      <p className="text-sm">{visit.treatment_plan}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Metrics */}
                                <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                                  {visit.vitals && visit.vitals.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Heart className="w-4 h-4" />
                                      <span>Vitals recorded</span>
                                    </div>
                                  )}
                                  {visit.lab_results && visit.lab_results[0]?.count > 0 && (
                                    <div className="flex items-center gap-1">
                                      <FileText className="w-4 h-4" />
                                      <span>{visit.lab_results[0].count} lab results</span>
                                    </div>
                                  )}
                                  {visit.prescription && (
                                    <div className="flex items-center gap-1">
                                      <Pill className="w-4 h-4" />
                                      <span>Prescription given</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                {showActions && actions.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {actions.includes('confirm') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'confirm');
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                                      >
                                        Confirm Booking
                                      </button>
                                    )}
                                    {actions.includes('check-in') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'check-in');
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                                      >
                                        Check In
                                      </button>
                                    )}
                                    {actions.includes('mark-ready') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'mark-ready');
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                                      >
                                        Mark Ready
                                      </button>
                                    )}
                                    {actions.includes('start-visit') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(visit.id, 'start-visit');
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                                      >
                                        Start Visit
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visits.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No visits found</p>
          </div>
        )}
      </div>
    </div>
  );
}