import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, Filter, Search, ChevronDown, 
  CheckCircle, XCircle, AlertCircle, MoreVertical,
  Edit3, Trash2, UserCheck, X
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import AppointmentApprovalModal from '../modals/AppointmentApprovalModal';
import RescheduleAppointmentModal from '../modals/RescheduleAppointmentModal';
import { motion } from 'framer-motion';

interface AppointmentGridViewProps {
  status: 'pending' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  practiceId: string;
  onClose: () => void;
}

export default function AppointmentGridView({ status, practiceId, onClose }: AppointmentGridViewProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, [status, practiceId]);

  useEffect(() => {
    filterAppointments();
  }, [appointments, searchTerm, dateFilter]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(id, first_name, last_name, cell_number, email),
          doctor:users!doctor_id(id, full_name)
        `)
        .eq('practice_id', practiceId)
        .eq('status', status)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(apt => 
        apt.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.patient?.cell_number?.includes(searchTerm) ||
        apt.doctor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate.toDateString() === today.toDateString();
        });
        break;
      case 'week':
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && aptDate <= weekEnd;
        });
        break;
      case 'month':
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && aptDate <= monthEnd;
        });
        break;
    }

    setFilteredAppointments(filtered);
  };

  const handleApprove = async (appointmentId: string, doctorId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'scheduled',
          doctor_id: doctorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      fetchAppointments();
      setShowApprovalModal(false);
    } catch (error) {
      console.error('Error approving appointment:', error);
      throw error;
    }
  };

  const handleReject = async (appointmentId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          notes: reason ? `Rejected: ${reason}` : 'Rejected by practice',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      fetchAppointments();
      setShowApprovalModal(false);
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      throw error;
    }
  };

  const handleDelete = async (appointmentId: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId);

        if (error) throw error;
        fetchAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
        alert('Failed to delete appointment');
      }
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      alert('Failed to update appointment status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'no-show': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'completed': return <UserCheck className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'no-show': return <User className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold capitalize">{status} Appointments</h2>
              <p className="text-primary-100 mt-1">
                {filteredAppointments.length} {filteredAppointments.length === 1 ? 'appointment' : 'appointments'} found
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by patient name, phone, or doctor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No {status} appointments found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                      {getStatusIcon(appointment.status)}
                      {appointment.status}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowActionMenu(showActionMenu === appointment.id ? null : appointment.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showActionMenu === appointment.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowApprovalModal(true);
                                  setShowActionMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowRescheduleModal(true);
                                  setShowActionMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit3 className="w-4 h-4 text-blue-600" />
                                Reschedule
                              </button>
                            </>
                          )}
                          {status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowRescheduleModal(true);
                                  setShowActionMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit3 className="w-4 h-4 text-blue-600" />
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              handleDelete(appointment.id);
                              setShowActionMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 border-t"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                      <User className="w-4 h-4 text-gray-400" />
                      {appointment.patient?.first_name} {appointment.patient?.last_name}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {format(new Date(appointment.date), 'MMM d, yyyy')}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {appointment.time} ({appointment.duration} min)
                    </div>

                    {appointment.doctor && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UserCheck className="w-4 h-4 text-gray-400" />
                        Dr. {appointment.doctor.full_name}
                      </div>
                    )}

                    {appointment.patient?.cell_number && (
                      <div className="text-sm text-gray-500">
                        {appointment.patient.cell_number}
                      </div>
                    )}
                  </div>

                  {appointment.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      {appointment.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      {showApprovalModal && selectedAppointment && (
        <AppointmentApprovalModal
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onApprove={handleApprove}
          onReject={handleReject}
          onReschedule={(id) => {
            setShowApprovalModal(false);
            setShowRescheduleModal(true);
          }}
        />
      )}

      {showRescheduleModal && selectedAppointment && (
        <RescheduleAppointmentModal
          isOpen={showRescheduleModal}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onReschedule={() => {
            // Handle reschedule
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
}