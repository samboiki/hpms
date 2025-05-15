import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Clock, Activity, FileText, Image, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import Badge from '../ui/Badge';
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
  doctor_name: string;
  status: string;
  lab_results_count: number;
  media_count: number;
  pending_lab_requests_count: number;
  pending_media_requests_count: number;
}

interface VisitsTimelineProps {
  patientId: string;
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ patientId }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [visitDetails, setVisitDetails] = useState<any | null>(null);

  useEffect(() => {
    fetchVisits();
  }, [patientId]);

  const fetchVisits = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('visit_timeline_view')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error('Error fetching visits:', err);
      setError('Failed to load visit history');
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
    } catch (err) {
      console.error('Error fetching visit details:', err);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 size={32} className="animate-spin text-brand-primary mx-auto mb-2" />
          <p className="text-gray-500">Loading visit history...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle size={32} className="text-error-500 mx-auto mb-2" />
          <p className="text-error-600">{error}</p>
        </CardContent>
      </Card>
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
              {/* Timeline connector */}
              {index < visits.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
              )}
              
              {/* Timeline dot */}
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[#01b9d4] flex items-center justify-center">
                <Clock size={14} className="text-white" />
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
                        'error'
                      }
                      size="sm"
                    >
                      {visit.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  {visit.chief_complaint && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Chief Complaint</h4>
                      <p className="text-gray-600">{visit.chief_complaint}</p>
                    </div>
                  )}

                  {visit.diagnosis && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Diagnosis</h4>
                      <p className="text-gray-600">{visit.diagnosis}</p>
                    </div>
                  )}

                  {visit.treatment_plan && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Treatment Plan</h4>
                      <p className="text-gray-600">{visit.treatment_plan}</p>
                    </div>
                  )}

                  {visit.prescription && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Prescription</h4>
                      <p className="text-gray-600 whitespace-pre-line">{visit.prescription}</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-primary">
                        {visit.lab_results_count}
                      </div>
                      <div className="text-xs text-gray-500">Lab Results</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-primary">
                        {visit.media_count}
                      </div>
                      <div className="text-xs text-gray-500">Media Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-warning-500">
                        {visit.pending_lab_requests_count}
                      </div>
                      <div className="text-xs text-gray-500">Pending Labs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-warning-500">
                        {visit.pending_media_requests_count}
                      </div>
                      <div className="text-xs text-gray-500">Pending Media</div>
                    </div>
                  </div>

                  {/* Load and show visit details when expanded */}
                  {selectedVisit === visit.id && visitDetails && (
                    <VisitCard visit={visitDetails} />
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {visits.length === 0 && (
            <div className="text-center py-8">
              <Activity size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No visit history available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VisitsTimeline;