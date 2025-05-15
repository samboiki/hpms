import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, User, ChevronRight, Microscope, ImageIcon } from 'lucide-react';
import Badge from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import FormModal from '../modals/FormModal';
import EditVisitForm from '../forms/EditVisitForm';
import VisitModal from './VisitModal';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface VisitsTimelineProps {
  patientId: string;
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ patientId }) => {
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentVisit, setCurrentVisit] = useState<any>(null);

  useEffect(() => {
    fetchVisits();
  }, [patientId]);

  const fetchVisits = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('visit_details_view')
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

  const handleStatusChange = async (visitId: string, status: 'completed' | 'in-progress') => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ status })
        .eq('id', visitId);

      if (error) throw error;
      await fetchVisits();
    } catch (err) {
      console.error('Error updating visit status:', err);
    }
  };

  const handleViewVisit = (visit: any) => {
    setCurrentVisit(visit);
    setIsViewModalOpen(true);
  };

  const handleEditVisit = (visitId: string) => {
    setSelectedVisit(visitId);
    setIsEditModalOpen(true);
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
      <div className="text-center p-8">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {visits.map((visit) => (
            <div
              key={visit.id}
              className="relative pl-8 pb-8 last:pb-0 border-l-2 border-brand-light ml-4 cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
              onClick={() => handleViewVisit(visit)}
            >
              {/* Timeline Node */}
              <div className="absolute -left-4 p-2 bg-white rounded-full border-2 border-brand-primary">
                <Calendar size={16} className="text-brand-primary" />
              </div>

              {/* Visit Card */}
              <div className="bg-white rounded-lg shadow-soft hover:shadow-md transition-shadow p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)}
                    </h4>
                    <div className="flex items-center mt-1 space-x-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        {format(new Date(visit.visit_date), 'MMM d, yyyy')} at {visit.visit_time}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <User size={14} className="mr-1" />
                        {visit.doctor_name}
                      </div>
                    </div>
                  </div>
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

                <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                  {visit.chief_complaint}
                </p>

                {/* Lab Results and Media Indicators */}
                <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500">
                  {visit.lab_results?.length > 0 && (
                    <div className="flex items-center">
                      <Microscope size={14} className="mr-1" />
                      {visit.lab_results.length} lab result{visit.lab_results.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {visit.media?.length > 0 && (
                    <div className="flex items-center">
                      <ImageIcon size={14} className="mr-1" />
                      {visit.media.length} image{visit.media.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Pending Requests */}
                {((visit.pending_requests?.lab_requests?.length > 0) || 
                  (visit.pending_requests?.media_requests?.length > 0)) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Pending Requests</h5>
                    <div className="flex flex-wrap gap-2">
                      {visit.pending_requests.lab_requests?.map((request: any) => (
                        <Badge key={request.id} variant="warning" size="sm">
                          {request.test_name}
                        </Badge>
                      ))}
                      {visit.pending_requests.media_requests?.map((request: any) => (
                        <Badge key={request.id} variant="azure" size="sm">
                          {request.type} - {request.body_part}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditVisit(visit.id);
                    }}
                  >
                    Edit Visit
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {visits.length === 0 && (
            <div className="text-center py-8">
              <Calendar size={40} className="mx-auto text-gray-300" />
              <p className="mt-2 text-gray-500">No visit history available</p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Visit Modal */}
      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Visit"
      >
        {selectedVisit && (
          <EditVisitForm
            visitId={selectedVisit}
            initialData={visits.find(v => v.id === selectedVisit)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              setSelectedVisit(null);
              fetchVisits();
            }}
          />
        )}
      </FormModal>

      {/* View Visit Modal */}
      <FormModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Visit Details"
      >
        {currentVisit && (
          <VisitModal
            visit={currentVisit}
            onClose={() => setIsViewModalOpen(false)}
            onStatusChange={(status) => {
              handleStatusChange(currentVisit.id, status);
              setIsViewModalOpen(false);
            }}
            onEdit={() => {
              setIsViewModalOpen(false);
              handleEditVisit(currentVisit.id);
            }}
          />
        )}
      </FormModal>
    </Card>
  );
};

export default VisitsTimeline;