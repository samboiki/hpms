import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { 
  Clock, 
  Activity, 
  FileText, 
  Image, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  Microscope,
  Stethoscope,
  Pill,
  Calendar,
  User,
  Edit3
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import FormModal from '../modals/FormModal';
import VisitCard from './VisitCard';
import VisitModal from './VisitModal';
import EditVisitForm from '../forms/EditVisitForm';

interface Visit {
  id: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  prescription: string;
  status: string;
  doctor_name: string;
  doctor_id: string;
  lab_results_count: number;
  media_count: number;
  pending_lab_requests_count: number;
  pending_media_requests_count: number;
  created_at: string;
  updated_at: string;
}

interface VisitsTimelineProps {
  patientId: string;
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ patientId }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitDetails, setVisitDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeVisits = async () => {
      if (!patientId) {
        setError('Patient ID is required');
        setIsLoading(false);
        return;
      }

      await fetchVisits();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('visit_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visits',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchVisits();
          }
        )
        .subscribe();

      subscription = channel;
    };

    initializeVisits();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [patientId]);

  const fetchVisits = async () => {
    if (!patientId) {
      setError('Patient ID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('visit_timeline_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error('Error fetching visits:', err);
      setError('Failed to load visits');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVisitDetails = async (visitId: string) => {
    try {
      const { data, error } = await supabase
        .from('visit_details_view')
        .select('*')
        .eq('id', visitId)
        .single();

      if (error) throw error;
      setVisitDetails(data);
      setIsDetailsModalOpen(true);
    } catch (err) {
      console.error('Error fetching visit details:', err);
    }
  };

  const updateVisitStatus = async (visitId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (error) throw error;
      fetchVisits();
      
      // Also update the details view if open
      if (visitDetails?.id === visitId) {
        setVisitDetails({ ...visitDetails, status });
      }
    } catch (err) {
      console.error('Error updating visit status:', err);
    }
  };

  const handleEdit = (visit: Visit) => {
    setSelectedVisit(visit);
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'in-progress':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-emerald-500" />;
      case 'in-progress':
        return <Clock size={16} className="text-amber-500" />;
      default:
        return <AlertCircle size={16} className="text-gray-500" />;
    }
  };

  const getVisitTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return <Stethoscope size={16} className="text-brand-primary" />;
      case 'follow-up':
        return <Calendar size={16} className="text-purple-500" />;
      case 'procedure':
        return <Activity size={16} className="text-blue-500" />;
      case 'emergency':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle size={40} className="mx-auto text-error-500 mb-2" />
        <p className="text-error-600">{error}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity size={20} className="mr-2" />
          Visit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {visits.map((visit, index) => (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-8 pb-8 last:pb-0"
              onClick={() => fetchVisitDetails(visit.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Timeline connector */}
              {index < visits.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-brand-primary/50 to-transparent" />
              )}
              
              {/* Timeline node */}
              <div className={`
                absolute left-0 top-1.5 w-6 h-6 rounded-full 
                ${getStatusColor(visit.status)} 
                shadow-lg shadow-brand-primary/20
                flex items-center justify-center
                border-2 border-white
              `}>
                {getStatusIcon(visit.status)}
              </div>

              {/* Visit Card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-brand-light">
                        {getVisitTypeIcon(visit.visit_type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
                          <ChevronRight size={16} className="ml-2 text-gray-400" />
                        </h3>
                        <p className="text-sm text-gray-500">
                          {format(new Date(visit.visit_date), 'MMMM d, yyyy')} at {visit.visit_time}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {visit.doctor_name && (
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <User size={14} className="mr-1" />
                          {visit.doctor_name}
                        </div>
                      )}
                      <Badge
                        variant={
                          visit.status === 'completed' ? 'success' :
                          visit.status === 'in-progress' ? 'warning' :
                          'error'
                        }
                        size="sm"
                      >
                        {visit.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Chief Complaint</h4>
                      <p className="text-gray-600">{visit.chief_complaint}</p>
                    </div>

                    {visit.diagnosis && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Diagnosis</h4>
                        <p className="text-gray-600">{visit.diagnosis}</p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center text-sm text-gray-600">
                        <FileText size={14} className="mr-2" />
                        Lab Results
                      </div>
                      <p className="text-lg font-semibold mt-1">{visit.lab_results_count}</p>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center text-sm text-gray-600">
                        <Image size={14} className="mr-2" />
                        Media
                      </div>
                      <p className="text-lg font-semibold mt-1">{visit.media_count}</p>
                    </div>

                    {(visit.pending_lab_requests_count > 0 || visit.pending_media_requests_count > 0) && (
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center text-sm text-amber-600">
                          <Clock size={14} className="mr-2" />
                          Pending
                        </div>
                        <p className="text-lg font-semibold mt-1">
                          {visit.pending_lab_requests_count + visit.pending_media_requests_count}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateVisitStatus(visit.id, 'completed');
                        }}
                        disabled={visit.status === 'completed'}
                      >
                        <CheckCircle size={14} className="mr-2" />
                        Complete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateVisitStatus(visit.id, 'in-progress');
                        }}
                        disabled={visit.status === 'in-progress'}
                      >
                        <Clock size={14} className="mr-2" />
                        In Progress
                      </Button>
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(visit);
                        }}
                      >
                        <Edit3 size={14} className="mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchVisitDetails(visit.id);
                        }}
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {visits.length === 0 && (
            <div className="text-center py-8">
              <Activity size={40} className="mx-auto text-gray-300" />
              <p className="mt-2 text-gray-500">No visit history available</p>
            </div>
          )}
        </div>
      </CardContent>

      <FormModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Visit Details"
      >
        {visitDetails && (
          <VisitModal
            visit={visitDetails}
            onClose={() => setIsDetailsModalOpen(false)}
            onStatusChange={(status) => updateVisitStatus(visitDetails.id, status)}
            onEdit={() => {
              setIsDetailsModalOpen(false);
              setSelectedVisit(visitDetails);
            }}
          />
        )}
      </FormModal>

      {selectedVisit && (
        <FormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Visit"
        >
          <EditVisitForm
            visitId={selectedVisit.id}
            initialData={selectedVisit}
            onSuccess={() => {
              setIsEditModalOpen(false);
              fetchVisits();
            }}
          />
        </FormModal>
      )}
    </Card>
  );
};

export default VisitsTimeline;

export default VisitsTimeline