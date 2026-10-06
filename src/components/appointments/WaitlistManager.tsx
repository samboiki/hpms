import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Plus,
  Filter,
  Search,
  Phone,
  MessageSquare,
  ChevronRight,
  Star,
  Trash2,
  Edit2,
  Send
} from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { AppointmentService } from '../../services/appointmentService';
import { useAuthStore } from '../../stores/authStore';
import Button from '../ui/Button';
import FormModal from '../modals/FormModal';
import { toast } from 'react-hot-toast';
import { formatDoctorName } from '../../utils/formatDoctorName';

interface WaitlistEntry {
  id: string;
  patient_id: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
  };
  doctor_id?: string;
  doctor?: {
    id: string;
    full_name: string;
  };
  appointment_type: string;
  duration: number;
  preferred_dates: Array<{ start: string; end: string }>;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'waiting' | 'notified' | 'scheduled' | 'expired' | 'cancelled';
  notes?: string;
  created_at: string;
  notified_at?: string;
  expires_at: string;
}

interface AddToWaitlistFormData {
  patient_id: string;
  doctor_id?: string;
  appointment_type: string;
  duration: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  preferred_dates: Array<{ start: string; end: string }>;
  notes?: string;
}

const priorityConfig = {
  urgent: { color: 'from-red-500 to-red-600', icon: '🚨', label: 'Urgent' },
  high: { color: 'from-orange-500 to-orange-600', icon: '⚡', label: 'High' },
  normal: { color: 'from-blue-500 to-blue-600', icon: '📅', label: 'Normal' },
  low: { color: 'from-gray-400 to-gray-500', icon: '🕐', label: 'Low' }
};

const statusConfig = {
  waiting: { color: 'bg-yellow-100 text-yellow-800', label: 'Waiting' },
  notified: { color: 'bg-blue-100 text-blue-800', label: 'Notified' },
  scheduled: { color: 'bg-green-100 text-green-800', label: 'Scheduled' },
  expired: { color: 'bg-gray-100 text-gray-800', label: 'Expired' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
};

const WaitlistManager: React.FC = () => {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  
  const { user } = useAuthStore();

  useEffect(() => {
    fetchWaitlist();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('waitlist_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointment_waitlist',
        filter: `practice_id=eq.${user?.practice_id}`
      }, () => {
        fetchWaitlist();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.practice_id]);

  const fetchWaitlist = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('appointment_waitlist')
        .select(`
          *,
          patient:patients(id, first_name, last_name, cell_number),
          doctor:users!doctor_id(id, full_name)
        `)
        .eq('practice_id', user?.practice_id)
        .order('priority')
        .order('created_at');

      if (error) throw error;
      
      setWaitlistEntries(data || []);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      toast.error('Failed to load waitlist');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = waitlistEntries.filter(entry => {
    if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
    if (filterPriority !== 'all' && entry.priority !== filterPriority) return false;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const patientName = `${entry.patient?.first_name} ${entry.patient?.last_name}`.toLowerCase();
      return patientName.includes(search) || 
             entry.appointment_type.toLowerCase().includes(search);
    }
    
    return true;
  });

  const handleAddToWaitlist = async (data: AddToWaitlistFormData) => {
    try {
      const result = await AppointmentService.addToWaitlist(data, user?.practice_id || '');
      
      if (result.success) {
        toast.success('Patient added to waitlist');
        setIsAddModalOpen(false);
        fetchWaitlist();
      } else {
        throw new Error('Failed to add to waitlist');
      }
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      toast.error('Failed to add to waitlist');
    }
  };

  const handleNotifyPatient = async (entry: WaitlistEntry) => {
    try {
      // This would trigger the notification system
      await supabase
        .from('appointment_waitlist')
        .update({
          status: 'notified',
          notified_at: new Date().toISOString()
        })
        .eq('id', entry.id);

      toast.success('Patient has been notified');
      fetchWaitlist();
    } catch (error) {
      console.error('Error notifying patient:', error);
      toast.error('Failed to notify patient');
    }
  };

  const handleRemoveFromWaitlist = async (entryId: string) => {
    if (!confirm('Remove this patient from the waitlist?')) return;

    try {
      await supabase
        .from('appointment_waitlist')
        .update({ status: 'cancelled' })
        .eq('id', entryId);

      toast.success('Removed from waitlist');
      fetchWaitlist();
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      toast.error('Failed to remove from waitlist');
    }
  };

  const getWaitingTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const stats = {
    total: waitlistEntries.length,
    waiting: waitlistEntries.filter(e => e.status === 'waiting').length,
    urgent: waitlistEntries.filter(e => e.priority === 'urgent' && e.status === 'waiting').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Appointment Waitlist</h2>
            <p className="text-gray-600 mt-1">Manage patients waiting for appointments</p>
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Waitlist
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                <p className="text-sm text-blue-700">Total Entries</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-yellow-900">{stats.waiting}</p>
                <p className="text-sm text-yellow-700">Waiting</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-900">{stats.urgent}</p>
                <p className="text-sm text-red-700">Urgent</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-900">{stats.notified}</p>
                <p className="text-sm text-green-700">Notified</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-500" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full rounded-lg border border-gray-300 px-3 py-2 
                  focus:outline-none focus:ring-2 focus:ring-[#01b9d5]"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5]"
          >
            <option value="all">All Status</option>
            <option value="waiting">Waiting</option>
            <option value="notified">Notified</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5]"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Waitlist Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01b9d5]"></div>
              <span className="ml-3 text-gray-600">Loading waitlist...</span>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No waitlist entries found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Add patients to the waitlist when appointments are unavailable'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            <AnimatePresence>
              {filteredEntries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      {/* Priority Indicator */}
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${priorityConfig[entry.priority].color} 
                        flex items-center justify-center text-white shadow-md`}>
                        <span className="text-xl">{priorityConfig[entry.priority].icon}</span>
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {entry.patient?.first_name} {entry.patient?.last_name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[entry.status].color}`}>
                            {statusConfig[entry.status].label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{entry.appointment_type} • {entry.duration} min</span>
                            </div>
                            {entry.doctor && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                <span>{formatDoctorName(entry.doctor.full_name)}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Waiting {getWaitingTime(entry.created_at)}</span>
                            </div>
                            {entry.patient?.cell_number && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                <span>{entry.patient.cell_number}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preferred Dates */}
                        {entry.preferred_dates.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Preferred dates:</p>
                            <div className="flex flex-wrap gap-2">
                              {entry.preferred_dates.map((range, idx) => (
                                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {format(parseISO(range.start), 'MMM d')} - {format(parseISO(range.end), 'MMM d')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.notes && (
                          <p className="text-sm text-gray-500 mt-2 italic">"{entry.notes}"</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {entry.status === 'waiting' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleNotifyPatient(entry)}
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Notify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveFromWaitlist(entry.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {entry.status === 'notified' && (
                        <span className="text-sm text-gray-500">
                          Notified {entry.notified_at && format(parseISO(entry.notified_at), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add to Waitlist Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Patient to Waitlist"
      >
        <WaitlistForm
          onSubmit={handleAddToWaitlist}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </FormModal>
    </div>
  );
};

// Waitlist Form Component
const WaitlistForm: React.FC<{
  onSubmit: (data: AddToWaitlistFormData) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<AddToWaitlistFormData>({
    patient_id: '',
    appointment_type: 'consultation',
    duration: 30,
    priority: 'normal',
    preferred_dates: [],
    notes: ''
  });

  // Form implementation would go here
  // Similar to the appointment form with patient search, etc.

  return (
    <form className="space-y-4">
      {/* Form fields */}
      <p className="text-center text-gray-500">Waitlist form implementation needed</p>
      
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => onSubmit(formData)}
          className="bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white"
        >
          Add to Waitlist
        </Button>
      </div>
    </form>
  );
};

export default WaitlistManager;