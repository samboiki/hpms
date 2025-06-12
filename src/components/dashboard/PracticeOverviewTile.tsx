import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Calendar, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useTheme } from '../../stores/themeStore';

interface PracticeOverviewProps {
  practiceStats?: {
    totalPatients: number;
    todayAppointments: number;
    completedToday: number;
    pendingAppointments: number;
    revenue?: number;
  };
}

const PracticeOverviewTile: React.FC<PracticeOverviewProps> = ({ practiceStats }) => {
  const { currentTheme } = useTheme();
  
  const stats = practiceStats || {
    totalPatients: 0,
    todayAppointments: 0,
    completedToday: 0,
    pendingAppointments: 0
  };

  const currentHour = new Date().getHours();
  const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
  const efficiency = stats.todayAppointments > 0 ? Math.round((stats.completedToday / stats.todayAppointments) * 100) : 0;

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
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl opacity-50 animate-pulse" />
              <Building2 className="relative w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Practice Overview</h3>
          </div>
        </div>

        {/* Content area */}
        <div className="relative p-4 space-y-4">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <Users className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-xs text-white/60">Total Patients</p>
                <p className="text-lg font-bold text-white">{stats.totalPatients}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <Calendar className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-xs text-white/60">Today's Visits</p>
                <p className="text-lg font-bold text-white">{stats.todayAppointments}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-xs text-white/60">Completed</p>
                <p className="text-lg font-bold text-white">{stats.completedToday}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs text-white/60">Pending</p>
                <p className="text-lg font-bold text-white">{stats.pendingAppointments}</p>
              </div>
            </div>
          </div>

          {/* Summary Status */}
          <div className="relative p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white/80" />
              <span className="text-sm font-medium text-white">Current Status</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Good {timeOfDay}! You have {stats.todayAppointments} appointments today with {efficiency}% completion rate. 
              {stats.pendingAppointments > 0 && ` ${stats.pendingAppointments} appointments need approval.`}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;