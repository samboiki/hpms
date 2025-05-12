import React from 'react';
import { Calendar, Clock, FileText, User, ChevronRight } from 'lucide-react';
import Badge from '../ui/Badge';
import { MedicalRecord } from '../../stores/patientsStore';

interface VisitTimelineProps {
  visits: MedicalRecord[];
  onViewDetails?: (visit: MedicalRecord) => void;
}

const VisitTimeline: React.FC<VisitTimelineProps> = ({ visits, onViewDetails }) => {
  // Sort visits by date in descending order
  const sortedVisits = [...visits].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedVisits.map((visit, index) => (
        <div 
          key={visit.id}
          className={`
            relative pl-8 pb-8 last:pb-0
            ${index !== sortedVisits.length - 1 ? 'border-l-2 border-brand-light ml-4' : ''}
          `}
        >
          {/* Timeline Node */}
          <div className="absolute -left-4 p-2 bg-white rounded-full border-2 border-brand-primary">
            <Calendar size={16} className="text-brand-primary" />
          </div>

          {/* Visit Card */}
          <div className="bg-white rounded-lg shadow-soft hover:shadow-md transition-shadow p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-medium text-gray-900">{visit.title}</h4>
                <div className="flex items-center mt-1 space-x-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock size={14} className="mr-1" />
                    {visit.date}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <User size={14} className="mr-1" />
                    {visit.doctor}
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  visit.type === 'visit' ? 'azure' :
                  visit.type === 'diagnosis' ? 'coral' :
                  visit.type === 'prescription' ? 'lavender' : 'glass'
                }
                size="sm"
              >
                {visit.type}
              </Badge>
            </div>

            <p className="mt-3 text-sm text-gray-600 line-clamp-2">
              {visit.description}
            </p>

            {visit.attachments && visit.attachments.length > 0 && (
              <div className="mt-3 flex items-center space-x-2">
                <FileText size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">
                  {visit.attachments.length} attachment{visit.attachments.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {onViewDetails && (
              <button
                onClick={() => onViewDetails(visit)}
                className="mt-3 flex items-center text-sm text-brand-primary hover:text-brand-dark transition-colors"
              >
                View Details
                <ChevronRight size={14} className="ml-1" />
              </button>
            )}
          </div>
        </div>
      ))}

      {sortedVisits.length === 0 && (
        <div className="text-center py-8">
          <Calendar size={40} className="mx-auto text-gray-300" />
          <p className="mt-2 text-gray-500">No visit history available</p>
        </div>
      )}
    </div>
  );
};

export default VisitTimeline;