import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import FormModal from '../modals/FormModal';
import VisitCard from './VisitCard';
import VisitModal from './VisitModal';
import PremiumEditVisitForm from '../forms/PremiumEditVisitForm';
import FullScreenEditVisitModal from './FullScreenEditVisitModal';
import CompactVisitCard from './CompactVisitCard';
import DuotoneIcon from '../icons/DuotoneIcon';

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
        return '#10b981'; // emerald-500
      case 'in-progress':
        return '#f59e0b'; // amber-500
      default:
        return '#6b7280'; // gray-500
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
          <DuotoneIcon icon="activity" className="w-5 h-5 mr-2" />
          Visit History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {visits.map((visit, index) => (
            <div key={visit.id} className="relative pl-8">
              {/* Timeline connector */}
              {index < visits.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 border-l-2 border-dotted border-gray-300/60" />
              )}
              
              {/* Timeline node */}
              <div 
                className="absolute left-0 top-3 w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                style={{ 
                  backgroundColor: getStatusColor(visit.status),
                  boxShadow: `0 0 10px ${getStatusColor(visit.status)}30`
                }}
              >
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>

              {/* Compact Visit Card */}
              <div className="pl-4">
                <CompactVisitCard
                  visit={visit}
                  index={index}
                  onClick={fetchVisitDetails}
                  onStatusChange={updateVisitStatus}
                  onEdit={handleEdit}
                />
              </div>
            </div>
          ))}

          {visits.length === 0 && (
            <div className="text-center py-8">
              <DuotoneIcon icon="activity" className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No visit history available</p>
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
        <FullScreenEditVisitModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          visitId={selectedVisit.id}
          patientId={patientId}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchVisits();
          }}
        />
      )}
    </Card>
  );
};

export default VisitsTimeline;