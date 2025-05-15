import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormModal } from '../modals/FormModal';
import EditVisitForm from '../forms/EditVisitForm';

interface VisitsTimelineProps {
  patientId: string;
}

const VisitsTimeline: React.FC<VisitsTimelineProps> = ({ patientId }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [visits, setVisits] = useState<any[]>([]);

  const fetchVisits = async () => {
    // Implement fetch logic here
  };

  return (
    <div className="space-y-4">
      {visits.map((visit) => (
        <Card key={visit.id} className="p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Visit on {visit.visit_date}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedVisit(visit.id);
                setIsEditModalOpen(true);
              }}
            >
              <Edit3 size={14} className="mr-2" />
              Edit
            </Button>
          </div>

          {/* Visit details here */}
        </Card>
      ))}

      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Visit"
      >
        {selectedVisit && (
          <EditVisitForm
            visitId={selectedVisit}
            initialData={{
              visit_type: visits.find(v => v.id === selectedVisit)?.visit_type,
              chief_complaint: visits.find(v => v.id === selectedVisit)?.chief_complaint,
              diagnosis: visits.find(v => v.id === selectedVisit)?.diagnosis,
              treatment_plan: visits.find(v => v.id === selectedVisit)?.treatment_plan,
              prescription: visits.find(v => v.id === selectedVisit)?.prescription,
              follow_up_required: visits.find(v => v.id === selectedVisit)?.follow_up_required,
              follow_up_date: visits.find(v => v.id === selectedVisit)?.follow_up_date,
              notes: visits.find(v => v.id === selectedVisit)?.notes,
              status: visits.find(v => v.id === selectedVisit)?.status
            }}
            onSuccess={() => {
              setIsEditModalOpen(false);
              setSelectedVisit(null);
              fetchVisits();
            }}
          />
        )}
      </FormModal>
    </div>
  );
};

export default VisitsTimeline;