import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Clock, Activity, FileText, Image, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import FormModal from '../modals/FormModal';
import VisitCard from './VisitCard';

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

interface VisitDetails {
  vitals: {
    blood_pressure: string;
    temperature: number;
    pulse_rate: number;
    respiratory_rate: number;
    weight: number;
    height: number;
    bmi: number;
  };
  lab_results: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    status: string;
    date: string;
  }>;
  media: Array<{
    id: string;
    type: string;
    url: string;
    description: string;
    date: string;
  }>;
  pending_requests: {
    lab_requests: Array<{
      id: string;
      test_name: string;
      priority: string;
      status: string;
      expected_completion_date: string;
    }>;
    media_requests: Array<{
      id: string;
      type: string;
      body_part: string;
      priority: string;
      status: string;
      expected_completion_date: string;
    }>;
  };
}

interface VisitsTimelineProps {
  patientId: string;
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ patientId }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchVisits();
    subscribeToVisits();

    return () => {
      supabase.removeAllSubscriptions();
    };
  }, [patientId]);

  const fetchVisits = async () => {
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

  const subscribeToVisits = () => {
    const subscription = supabase
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

    return () => {
      subscription.unsubscribe();
    };
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
    } catch (err) {
      console.error('Error updating visit status:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-success-500" />;
      case 'cancelled':
        return <XCircle size={16} className="text-error-500" />;
      case 'in-progress':
        return <Clock size={16} className="text-warning-500" />;
      default:
        return <AlertCircle size={16} className="text-gray-500" />;
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
            >
              {index < visits.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
              )}
              
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[#01b9d4] flex items-center justify-center">
                {getStatusIcon(visit.status)}
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
                    </h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(visit.visit_date), 'MMMM d, yyyy')} at {visit.visit_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{visit.doctor_name}</p>
                    <Badge
                      variant={
                        visit.status === 'completed' ? 'success' :
                        visit.status === 'in-progress' ? 'warning' :
                        visit.status === 'cancelled' ? 'error' : 'glass'
                      }
                      size="sm"
                    >
                      {visit.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Chief Complaint</h4>
                    <p className="text-gray-600">{visit.chief_complaint}</p>
                  </div>

                  {visit.diagnosis && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Diagnosis</h4>
                      <p className="text-gray-600">{visit.diagnosis}</p>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-500">
                      <FileText size={16} className="mr-1" />
                      {visit.lab_results_count} Lab Results
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Image size={16} className="mr-1" />
                      {visit.media_count} Media
                    </div>
                    {(visit.pending_lab_requests_count > 0 || visit.pending_media_requests_count > 0) && (
                      <div className="flex items-center text-sm text-warning-600">
                        <Clock size={16} className="mr-1" />
                        {visit.pending_lab_requests_count + visit.pending_media_requests_count} Pending Requests
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateVisitStatus(visit.id, 'completed')}
                        disabled={visit.status === 'completed'}
                      >
                        <CheckCircle size={14} className="mr-2" />
                        Complete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateVisitStatus(visit.id, 'cancelled')}
                        disabled={visit.status === 'cancelled'}
                      >
                        <XCircle size={14} className="mr-2" />
                        Cancel
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchVisitDetails(visit.id)}
                    >
                      View Details
                    </Button>
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
          <div className="space-y-6">
            {/* Vitals */}
            {visitDetails.vitals && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Vitals</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Blood Pressure</p>
                    <p className="text-lg font-medium">{visitDetails.vitals.blood_pressure}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Temperature</p>
                    <p className="text-lg font-medium">{visitDetails.vitals.temperature}°C</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Pulse Rate</p>
                    <p className="text-lg font-medium">{visitDetails.vitals.pulse_rate} bpm</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">BMI</p>
                    <p className="text-lg font-medium">{visitDetails.vitals.bmi}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lab Results */}
            {visitDetails.lab_results && visitDetails.lab_results.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Lab Results</h3>
                <div className="space-y-4">
                  {visitDetails.lab_results.map(result => (
                    <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{result.name}</h4>
                          <p className="text-sm text-gray-500">{format(new Date(result.date), 'MMM d, yyyy')}</p>
                        </div>
                        <Badge
                          variant={
                            result.status === 'normal' ? 'success' :
                            result.status === 'high' ? 'warning' :
                            result.status === 'low' ? 'azure' :
                            'error'
                          }
                          size="sm"
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm">
                          <span className="font-medium">{result.value}</span> {result.unit}
                        </p>
                        <p className="text-xs text-gray-500">
                          Reference Range: {result.reference_range}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media */}
            {visitDetails.media && visitDetails.media.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Media</h3>
                <div className="grid grid-cols-2 gap-4">
                  {visitDetails.media.map(item => (
                    <div key={item.id} className="relative">
                      <img
                        src={item.url}
                        alt={item.description}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
                        <p className="text-sm font-medium">{item.description}</p>
                        <p className="text-xs">{format(new Date(item.date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests */}
            {visitDetails.pending_requests && (
              <VisitCard visit={visitDetails} />
            )}
          </div>
        )}
      </FormModal>
    </Card>
  );
};

export default VisitsTimeline;