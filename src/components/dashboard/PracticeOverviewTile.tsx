import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Calendar,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../../stores/themeStore';

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

  const getStatusInfo = () => {
    switch (practiceStatus) {
      case 'busy':
        return {
          text: 'High activity today',
          color: 'text-orange-400',
          icon: Activity
        };
      case 'quiet':
        return {
          text: 'Quiet day ahead',
          color: 'text-green-400',
          icon: CheckCircle2
        };
      default:
        return {
          text: 'Normal operations',
          color: 'text-blue-400',
          icon: Clock
        };
    }
  };

  const status = getStatusInfo();

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
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold text-white">
              Practice Overview
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-white/80" />
                <span className="text-xs font-medium text-white/80">Patients</span>
              </div>
              <div className="text-xl font-bold text-white">{totalPatients}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-white/80" />
                <span className="text-xs font-medium text-white/80">Today</span>
              </div>
              <div className="text-xl font-bold text-white">{todayAppointments}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-white/80" />
                <span className="text-xs font-medium text-white/80">Pending</span>
              </div>
              <div className="text-xl font-bold text-white">{pendingAppointments}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-white/80" />
                <span className="text-xs font-medium text-white/80">Done</span>
              </div>
              <div className="text-xl font-bold text-white">{completedToday}</div>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <status.icon className={`w-4 h-4 ${status.color}`} />
                <span className="text-sm font-medium text-white">{status.text}</span>
              </div>
              <div className="text-xs text-white/60">
                Practice Status
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;