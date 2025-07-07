import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import DuotoneIcon from '../icons/DuotoneIcon';
import Badge from '../ui/Badge';

interface Visit {
  id: string;
  visit_date: string;
  visit_time: string;
  visit_type: string;
  chief_complaint: string;
  diagnosis?: string;
  treatment_plan?: string;
  status: string;
  doctor_name?: string;
  doctor_id?: string;
  lab_results_count: number;
  media_count: number;
  pending_lab_requests_count: number;
  pending_media_requests_count: number;
  created_at: string;
  updated_at: string;
}

interface CompactVisitCardProps {
  visit: Visit;
  index: number;
  onClick: (visit: Visit) => void;
  onStatusChange: (visitId: string, status: string) => void;
  onEdit: (visit: Visit) => void;
}

const CompactVisitCard: React.FC<CompactVisitCardProps> = ({
  visit,
  index,
  onClick,
  onStatusChange,
  onEdit
}) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'check-circle-2';
      case 'in-progress':
        return 'clock';
      default:
        return 'alert-circle';
    }
  };

  const getVisitTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'stethoscope';
      case 'follow-up':
        return 'calendar';
      case 'procedure':
        return 'activity';
      case 'emergency':
        return 'alert-circle';
      default:
        return 'file-text';
    }
  };

  const getVisitTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return '#01b9d4'; // brand-primary
      case 'follow-up':
        return '#a855f7'; // purple-500
      case 'procedure':
        return '#3b82f6'; // blue-500
      case 'emergency':
        return '#ef4444'; // red-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => onClick(visit)}
      className="group relative overflow-hidden cursor-pointer"
    >
      {/* Trapezoidal cutout on the left side */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-6 z-10"
        style={{
          background: getStatusColor(visit.status),
          clipPath: 'polygon(0% 0%, 70% 15%, 70% 85%, 0% 100%)',
          boxShadow: `0 0 20px ${getStatusColor(visit.status)}20`
        }}
      />
      
      {/* Status indicator icon in the cutout */}
      <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-20">
        <DuotoneIcon 
          icon={getStatusIcon(visit.status)}
          className="w-4 h-4 text-white"
        />
      </div>

      {/* Main card content */}
      <div className="relative bg-white/80 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 group-hover:bg-white/90 ml-4">
        <div className="p-4">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1">
              <div 
                className="p-2 rounded-lg backdrop-blur-sm border border-white/50"
                style={{ 
                  backgroundColor: `${getVisitTypeColor(visit.visit_type)}15`,
                  borderColor: `${getVisitTypeColor(visit.visit_type)}30`
                }}
              >
                <DuotoneIcon 
                  icon={getVisitTypeIcon(visit.visit_type)}
                  className="w-4 h-4"
                  primaryColor={getVisitTypeColor(visit.visit_type)}
                  secondaryColor={`${getVisitTypeColor(visit.visit_type)}60`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1)} Visit
                </h3>
                <p className="text-xs text-gray-500 flex items-center">
                  <DuotoneIcon icon="calendar" className="w-3 h-3 mr-1" />
                  {format(new Date(visit.visit_date), 'MMM d, yyyy')} • {visit.visit_time}
                </p>
              </div>
            </div>
            <Badge
              variant={
                visit.status === 'completed' ? 'success' :
                visit.status === 'in-progress' ? 'warning' :
                'error'
              }
              size="sm"
              className="ml-2 shrink-0"
            >
              {visit.status}
            </Badge>
          </div>

          {/* Doctor Info */}
          {visit.doctor_name && (
            <div className="flex items-center text-xs text-gray-600 mb-3">
              <DuotoneIcon icon="user-round" className="w-3 h-3 mr-1" />
              {visit.doctor_name}
            </div>
          )}

          {/* Chief Complaint */}
          <div className="mb-3">
            <p className="text-xs text-gray-600 line-clamp-2">
              <span className="font-medium">Chief Complaint:</span> {visit.chief_complaint}
            </p>
            {visit.diagnosis && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                <span className="font-medium">Diagnosis:</span> {visit.diagnosis}
              </p>
            )}
          </div>

          {/* Compact Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white/30">
              <div className="flex items-center text-xs text-gray-600">
                <DuotoneIcon icon="file-text" className="w-3 h-3 mr-1" primaryColor="#6b7280" />
                Labs
              </div>
              <p className="text-sm font-semibold text-gray-900">{visit.lab_results_count}</p>
            </div>

            <div className="bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-white/30">
              <div className="flex items-center text-xs text-gray-600">
                <DuotoneIcon icon="activity" className="w-3 h-3 mr-1" primaryColor="#6b7280" />
                Media
              </div>
              <p className="text-sm font-semibold text-gray-900">{visit.media_count}</p>
            </div>

            {(visit.pending_lab_requests_count > 0 || visit.pending_media_requests_count > 0) && (
              <div className="bg-amber-50/80 backdrop-blur-sm rounded-lg p-2 border border-amber-200/50">
                <div className="flex items-center text-xs text-amber-600">
                  <DuotoneIcon icon="clock" className="w-3 h-3 mr-1" primaryColor="#d97706" />
                  Pending
                </div>
                <p className="text-sm font-semibold text-amber-700">
                  {visit.pending_lab_requests_count + visit.pending_media_requests_count}
                </p>
              </div>
            )}
          </div>

          {/* Compact Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200/50">
            <div className="flex space-x-1">
              {visit.status !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(visit.id, 'completed');
                  }}
                  className="flex items-center px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                >
                  <DuotoneIcon icon="check-circle-2" className="w-3 h-3 mr-1" />
                  Complete
                </button>
              )}
              {visit.status !== 'in-progress' && visit.status !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(visit.id, 'in-progress');
                  }}
                  className="flex items-center px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                >
                  <DuotoneIcon icon="clock" className="w-3 h-3 mr-1" />
                  Start
                </button>
              )}
            </div>
            <div className="flex space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(visit);
                }}
                className="flex items-center px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
              >
                <DuotoneIcon icon="cog" className="w-3 h-3 mr-1" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(visit);
                }}
                className="flex items-center px-2 py-1 text-xs text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
              >
                <DuotoneIcon icon="chevron-right" className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CompactVisitCard;