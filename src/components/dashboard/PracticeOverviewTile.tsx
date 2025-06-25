import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../stores/themeStore';
import { toast } from 'react-hot-toast';

interface PracticeOverviewProps {
  totalPatients: number;
  todayAppointments: number;
  pendingAppointments: number;
  completedToday: number;
  practiceStatus: 'operational' | 'busy' | 'quiet';
}

const PracticeOverviewTile: React.FC<PracticeOverviewProps> = ({ 
  totalPatients,
  todayAppointments,
  pendingAppointments,
  completedToday,
  practiceStatus
}) => {
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'add-patient',
      label: 'Add Patient',
      icon: 'solar:user-plus-bold-duotone',
      onClick: () => navigate('/patients?action=add')
    },
    {
      id: 'send-sms',
      label: 'Send SMS',
      icon: 'lets-icons:message-duotone',
      onClick: () => toast.success('SMS feature coming soon!')
    },
    {
      id: 'submit-batch',
      label: 'Submit Batch',
      icon: 'material-icon-theme:folder-batch-open',
      onClick: () => navigate('/billing?action=batch')
    },
    {
      id: 'to-dos',
      label: 'To Dos',
      icon: 'fluent:calendar-reply-20-filled',
      onClick: () => navigate('/todos')
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 24 }}
      className="relative overflow-hidden group"
    >
      {/* Sidebar-themed container */}
      <div className={`relative bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-hidden`}>
        
        {/* Header */}
        <div className="relative p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Icon icon="solar:widget-4-bold-duotone" className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Quick Actions
            </h3>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className="relative bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-all duration-200 group/btn"
              >
                <div className="flex flex-col items-center gap-2">
                  {/* Icon with light grey background */}
                  <div className="p-3 rounded-lg bg-white/20 group-hover/btn:bg-white/30 group-hover/btn:scale-110 transition-all">
                    <Icon icon={action.icon} className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Label */}
                  <span className="text-sm font-medium text-white/90 text-center">
                    {action.label}
                  </span>
                </div>
                
                {/* Hover effect */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-white/0 to-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;