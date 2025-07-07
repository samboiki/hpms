import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure the DOM is ready before starting animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 800); // Match this with the transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender || !visit) return null;

  const patientName = `${visit.patient?.first_name || ''} ${visit.patient?.last_name || ''}`.trim();

  // Define actions based on visit status
  const getAvailableActions = () => {
    const actions = [];

    // Communication actions - SMS only
    if (visitStatus !== 'completed' && visitStatus !== 'cancelled') {
      actions.push({
        label: 'Send SMS',
        icon: <Icon icon="solar:chat-square-code-bold-duotone" className="w-5 h-5" />,
        onClick: onSendSMS,
        color: 'text-blue-600 hover:bg-blue-50',
        iconColor: 'text-blue-600',
        primary: true
      });
    }

    // Status-specific actions
    if (visitStatus === 'scheduled') {
      if (!isCheckedIn) {
        actions.push({
          label: 'Check In',
          icon: <Icon icon="solar:user-check-rounded-bold-duotone" className="w-5 h-5" />,
          onClick: onCheckIn,
          color: 'text-cyan-600 hover:bg-cyan-50',
          iconColor: 'text-cyan-600',
          divider: true
        });
      } else {
        actions.push({
          label: 'Start Visit',
          icon: <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />,
          onClick: onStartVisit,
          color: 'text-emerald-600 hover:bg-emerald-50',
          iconColor: 'text-emerald-600',
          divider: true
        });
      }
    }

    if (visitStatus === 'ready') {
      actions.push({
        label: 'Start Visit',
        icon: <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />,
        onClick: onStartVisit,
        color: 'text-emerald-600 hover:bg-emerald-50',
        iconColor: 'text-emerald-600',
        divider: true
      });
    }

    if (visitStatus === 'in-progress') {
      actions.push({
        label: 'Complete Visit',
        icon: <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />,
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
        icon: <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />,
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
        icon: <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5" />,
        onClick: onReschedule,
        color: 'text-amber-600 hover:bg-amber-50',
        iconColor: 'text-amber-600'
      });

      actions.push({
        label: 'Cancel Visit',
        icon: <Icon icon="solar:close-square-bold-duotone" className="w-5 h-5" />,
        onClick: onCancel,
        color: 'text-red-600 hover:bg-red-50',
        iconColor: 'text-red-600'
      });

      // Add Mark No Show for scheduled visits
      if (visitStatus === 'scheduled') {
        actions.push({
          label: 'Mark No Show',
          icon: <Icon icon="solar:user-cross-rounded-bold-duotone" className="w-5 h-5" />,
          onClick: onNoShow,
          color: 'text-orange-600 hover:bg-orange-50',
          iconColor: 'text-orange-600'
        });
      }
    }

    // View details action
    actions.push({
      label: 'View Details',
      icon: <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />,
      onClick: onViewDetails,
      color: 'text-gray-600 hover:bg-gray-50',
      iconColor: 'text-gray-600',
      divider: true
    });

    return actions;
  };

  const actions = getAvailableActions();

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-all duration-700 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Modal */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-2xl transition-all duration-700 ease-in-out pointer-events-auto overflow-hidden ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-90 translate-y-8'
        }`}>
          {/* Header */}
          <div className="relative overflow-hidden border-b border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Visit Actions</h3>
                  <p className="text-gray-600 text-base">{patientName}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl transition-all duration-200"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions List with Premium Styling */}
          <div className="p-8 max-h-[60vh] overflow-y-auto bg-gray-50/50">
            <div className="space-y-4">
              {actions.filter(action => action.label !== 'Handoff to Nurse').map((action, index) => {
                // Determine if this is a priority action
                const isPriority = (
                  (visitStatus === 'scheduled' && isCheckedIn && action.label === 'Start Visit') ||
                  (visitStatus === 'scheduled' && !isCheckedIn && action.label === 'Check In') ||
                  (visitStatus === 'ready' && action.label === 'Start Visit') ||
                  (visitStatus === 'in-progress' && action.label === 'Complete Visit')
                );

                const isGridAction = !isPriority && action.label !== 'Send SMS' && action.label !== 'View Details';
                const isBottomAction = action.label === 'Send SMS' || action.label === 'View Details';

                if (isPriority) {
                  // Full-width priority action
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (action.onClick) {
                          action.onClick();
                          onClose();
                        }
                      }}
                      className="w-full group relative overflow-hidden rounded-xl transition-all duration-200 transform hover:scale-[1.02] border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50"
                      disabled={!action.onClick}
                    >
                      <div className="relative z-10 flex items-center gap-4 p-6">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                          action.label === 'Check In' ? 'bg-purple-100' :
                          action.label === 'Start Visit' ? 'bg-emerald-100' :
                          action.label === 'Complete Visit' ? 'bg-green-100' :
                          'bg-gray-100'
                        }`}>
                          <div className={
                            action.label === 'Check In' ? 'text-purple-600' :
                            action.label === 'Start Visit' ? 'text-emerald-600' :
                            action.label === 'Complete Visit' ? 'text-green-600' :
                            'text-gray-600'
                          }>
                            {React.cloneElement(action.icon, { className: 'w-5 h-5' })}
                          </div>
                        </div>
                        <div className="flex-1 text-left">
                          <span className="block font-semibold text-gray-800 text-lg">{action.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">
                            {action.label === 'Start Visit' && 'Begin the consultation with the patient'}
                            {action.label === 'Check In' && 'Mark patient as arrived at the practice'}
                            {action.label === 'Complete Visit' && 'Finish and close the visit record'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }

                return null;
              })}

              {/* Secondary Actions - Responsive Grid */}
              {(() => {
                const secondaryActions = actions.filter(action => 
                  action.label !== 'Handoff to Nurse' && 
                  action.label !== 'Send SMS' && 
                  action.label !== 'View Details' &&
                  action.label !== 'Mark No Show' && // Exclude Mark No Show from grid
                  !(
                    (visitStatus === 'scheduled' && isCheckedIn && action.label === 'Start Visit') ||
                    (visitStatus === 'scheduled' && !isCheckedIn && action.label === 'Check In') ||
                    (visitStatus === 'ready' && action.label === 'Start Visit') ||
                    (visitStatus === 'in-progress' && action.label === 'Complete Visit')
                  )
                );

                const markNoShowAction = actions.find(action => action.label === 'Mark No Show');
                const gridCols = secondaryActions.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

                return (
                  <>
                  <div className={`grid ${gridCols} gap-4`}>
                    {secondaryActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (action.onClick) {
                            action.onClick();
                            onClose();
                          }
                        }}
                        className="group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        disabled={!action.onClick}
                      >
                        <div className="relative z-10 flex items-center gap-4 px-5 py-5 bg-white group-hover:bg-gray-50 border border-gray-200 group-hover:border-gray-300 rounded-xl transition-all duration-200">
                          <div className="flex-shrink-0">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                              action.label === 'Cancel Visit'
                              ? 'bg-red-100'
                              : action.label === 'Reschedule'
                              ? 'bg-indigo-100'
                              : 'bg-gray-100'
                            }`}>
                              <div className={
                                action.label === 'Cancel Visit'
                                ? 'text-red-600'
                                : action.label === 'Reschedule'
                                ? 'text-indigo-600'
                                : 'text-gray-600'
                              }>
                                {React.cloneElement(action.icon, { className: 'w-5 h-5' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 text-left">
                            <span className="block font-semibold text-gray-700 text-base">{action.label}</span>
                            <span className="block text-xs text-gray-500 mt-1">
                              {action.label === 'Cancel Visit' && 'Cancel appointment'}
                              {action.label === 'Mark No Show' && 'Patient didn\'t arrive'}
                              {action.label === 'Reschedule' && 'Change date/time'}
                              {action.label === 'Start Visit' && 'Begin consultation'}
                              {action.label === 'Check In' && 'Mark as arrived'}
                              {action.label === 'Complete Visit' && 'Finish visit'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Mark No Show - Full Width */}
                  {markNoShowAction && (
                    <button
                      onClick={() => {
                        if (markNoShowAction.onClick) {
                          markNoShowAction.onClick();
                          onClose();
                        }
                      }}
                      className="w-full group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg mt-4"
                      disabled={!markNoShowAction.onClick}
                    >
                      <div className="relative z-10 flex items-center gap-4 px-6 py-5 bg-white group-hover:bg-gray-50 border border-gray-200 group-hover:border-gray-300 rounded-xl transition-all duration-200">
                        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl">
                          <div className="text-orange-600">
                            {React.cloneElement(markNoShowAction.icon, { className: 'w-5 h-5' })}
                          </div>
                        </div>
                        <div className="flex-1 text-left">
                          <span className="block font-semibold text-gray-700 text-lg">Mark No Show</span>
                          <span className="block text-xs text-gray-500 mt-1">Patient didn't arrive for their scheduled appointment</span>
                        </div>
                      </div>
                    </button>
                  )}
                  </>
                );
              })()}

              {/* Bottom Actions */}
              <div className="space-y-3 border-t border-gray-200 pt-6">
                {actions.filter(action => action.label === 'Send SMS' || action.label === 'View Details').map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (action.onClick) {
                        action.onClick();
                        onClose();
                      }
                    }}
                    className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md"
                    disabled={!action.onClick}
                  >
                    <div className={`relative z-10 flex items-center gap-4 px-5 py-4 ${
                      action.label === 'Send SMS'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                      : action.label === 'View Details'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                    }`}>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                        action.label === 'Send SMS' || action.label === 'View Details'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {action.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`block font-medium text-sm ${
                          action.label === 'Send SMS' || action.label === 'View Details'
                          ? 'text-white'
                          : 'text-gray-700'
                        }`}>{action.label}</span>
                        <span className={`block text-xs mt-0.5 ${
                          action.label === 'Send SMS' || action.label === 'View Details'
                          ? 'text-white/80'
                          : 'text-gray-500'
                        }`}>
                          {action.label === 'Send SMS' && 'Send a text message to the patient'}
                          {action.label === 'View Details' && 'See complete visit information'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default VisitActionModal;