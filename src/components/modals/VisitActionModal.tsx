import React from 'react';
import { X, Play, CheckCircle, UserX, Calendar, Activity, Phone, MessageCircle, Mail, FileText } from 'lucide-react';
import { Icon } from '@iconify/react';

interface VisitActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  visitStatus: 'scheduled' | 'ready' | 'in-progress' | 'handed-off' | 'completed';
  isCheckedIn?: boolean;
  onStartVisit?: () => void;
  onCompleteVisit?: () => void;
  onHandoffVisit?: () => void;
  onMarkReady?: () => void;
  onCheckIn?: () => void;
  onNoShow?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  onSendSMS?: () => void;
  onSendEmail?: () => void;
  onCall?: () => void;
  onViewDetails?: () => void;
}

const VisitActionModal: React.FC<VisitActionModalProps> = ({
  isOpen,
  onClose,
  visit,
  visitStatus,
  isCheckedIn = false,
  onStartVisit,
  onCompleteVisit,
  onHandoffVisit,
  onMarkReady,
  onCheckIn,
  onNoShow,
  onReschedule,
  onCancel,
  onSendSMS,
  onSendEmail,
  onCall,
  onViewDetails
}) => {
  if (!isOpen || !visit) return null;

  const patientName = `${visit.patient?.first_name || ''} ${visit.patient?.last_name || ''}`.trim();

  // Define actions based on visit status
  const getAvailableActions = () => {
    const actions = [];

    // Common communication actions
    actions.push({
      label: 'Send SMS',
      icon: <MessageCircle className="w-5 h-5" />,
      onClick: onSendSMS,
      color: 'text-blue-600 hover:bg-blue-50',
      iconColor: 'text-blue-600'
    });

    actions.push({
      label: 'Send Email',
      icon: <Mail className="w-5 h-5" />,
      onClick: onSendEmail,
      color: 'text-indigo-600 hover:bg-indigo-50',
      iconColor: 'text-indigo-600'
    });

    actions.push({
      label: 'Call Patient',
      icon: <Phone className="w-5 h-5" />,
      onClick: onCall,
      color: 'text-green-600 hover:bg-green-50',
      iconColor: 'text-green-600'
    });

    // Status-specific actions
    if (visitStatus === 'scheduled') {
      if (!isCheckedIn) {
        actions.push({
          label: 'Check In',
          icon: <Icon icon="solar:user-check-bold-duotone" className="w-5 h-5" />,
          onClick: onCheckIn,
          color: 'text-cyan-600 hover:bg-cyan-50',
          iconColor: 'text-cyan-600',
          divider: true
        });
      } else {
        actions.push({
          label: 'Start Visit',
          icon: <Play className="w-5 h-5" />,
          onClick: onStartVisit,
          color: 'text-emerald-600 hover:bg-emerald-50',
          iconColor: 'text-emerald-600',
          divider: true
        });
      }

      actions.push({
        label: 'Mark as Ready',
        icon: <Activity className="w-5 h-5" />,
        onClick: onMarkReady,
        color: 'text-purple-600 hover:bg-purple-50',
        iconColor: 'text-purple-600'
      });

      actions.push({
        label: 'Mark No Show',
        icon: <UserX className="w-5 h-5" />,
        onClick: onNoShow,
        color: 'text-orange-600 hover:bg-orange-50',
        iconColor: 'text-orange-600'
      });
    }

    if (visitStatus === 'ready') {
      actions.push({
        label: 'Start Visit',
        icon: <Play className="w-5 h-5" />,
        onClick: onStartVisit,
        color: 'text-emerald-600 hover:bg-emerald-50',
        iconColor: 'text-emerald-600',
        divider: true
      });
    }

    if (visitStatus === 'in-progress') {
      actions.push({
        label: 'Complete Visit',
        icon: <CheckCircle className="w-5 h-5" />,
        onClick: onCompleteVisit,
        color: 'text-green-600 hover:bg-green-50',
        iconColor: 'text-green-600',
        divider: true
      });

      actions.push({
        label: 'Handoff to Nurse',
        icon: <Icon icon="solar:hand-shake-bold-duotone" className="w-5 h-5" />,
        onClick: onHandoffVisit,
        color: 'text-purple-600 hover:bg-purple-50',
        iconColor: 'text-purple-600'
      });
    }

    if (visitStatus === 'handed-off') {
      actions.push({
        label: 'Complete Visit',
        icon: <CheckCircle className="w-5 h-5" />,
        onClick: onCompleteVisit,
        color: 'text-green-600 hover:bg-green-50',
        iconColor: 'text-green-600',
        divider: true
      });
    }

    // Common actions for non-completed visits
    if (visitStatus !== 'completed') {
      actions.push({
        label: 'Reschedule',
        icon: <Calendar className="w-5 h-5" />,
        onClick: onReschedule,
        color: 'text-amber-600 hover:bg-amber-50',
        iconColor: 'text-amber-600'
      });

      actions.push({
        label: 'Cancel Visit',
        icon: <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />,
        onClick: onCancel,
        color: 'text-red-600 hover:bg-red-50',
        iconColor: 'text-red-600'
      });
    }

    // View details action
    actions.push({
      label: 'View Details',
      icon: <FileText className="w-5 h-5" />,
      onClick: onViewDetails,
      color: 'text-gray-600 hover:bg-gray-50',
      iconColor: 'text-gray-600',
      divider: true
    });

    return actions;
  };

  const actions = getAvailableActions();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transition-all duration-200 transform">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Visit Actions</h3>
                <p className="text-sm text-gray-500 mt-1">{patientName}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Actions List */}
          <div className="p-2 max-h-[60vh] overflow-y-auto">
            {actions.map((action, index) => (
              <React.Fragment key={index}>
                {action.divider && index > 0 && (
                  <div className="my-2 border-t border-gray-100" />
                )}
                <button
                  onClick={() => {
                    if (action.onClick) {
                      action.onClick();
                      onClose();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${action.color}`}
                  disabled={!action.onClick}
                >
                  <div className={action.iconColor}>
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default VisitActionModal;