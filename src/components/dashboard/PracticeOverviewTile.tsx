import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Calendar, TrendingUp, Activity, Clock } from 'lucide-react';

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
  // Generate comprehensive practice overview text
  const generateOverviewText = () => {
    const stats = practiceStats || {
      totalPatients: 0,
      todayAppointments: 0,
      completedToday: 0,
      pendingAppointments: 0
    };

    const currentHour = new Date().getHours();
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
    
    // Dynamic status based on data
    const busyLevel = stats.todayAppointments > 10 ? 'busy' : stats.todayAppointments > 5 ? 'moderate' : 'quiet';
    const efficiency = stats.todayAppointments > 0 ? Math.round((stats.completedToday / stats.todayAppointments) * 100) : 0;
    
    return `Your practice is having a ${busyLevel} ${timeOfDay} with ${stats.todayAppointments} appointments scheduled and ${stats.completedToday} already completed for a ${efficiency}% completion rate. You currently have ${stats.totalPatients} total patients in your system with ${stats.pendingAppointments} appointments awaiting approval. Operations are running ${efficiency > 80 ? 'smoothly' : efficiency > 60 ? 'efficiently' : 'steadily'} across all departments.`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4"
    >
      {/* Header with gradient */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-[#01b9d5] blur-xl opacity-20 animate-pulse" />
            <Building2 className="relative w-5 h-5 text-[#01b9d5]" />
          </div>
          Practice Overview
        </h3>
      </div>
      
      {/* Overview Content */}
      <div className="p-4">
        {/* Comprehensive practice status text */}
        <div className="mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {generateOverviewText()}
          </p>
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Patients</p>
                <p className="text-lg font-bold text-blue-800">{practiceStats?.totalPatients || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs text-emerald-600 font-medium">Today's Visits</p>
                <p className="text-lg font-bold text-emerald-800">{practiceStats?.todayAppointments || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-xs text-amber-600 font-medium">Completed</p>
                <p className="text-lg font-bold text-amber-800">{practiceStats?.completedToday || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600 font-medium">Pending</p>
                <p className="text-lg font-bold text-purple-800">{practiceStats?.pendingAppointments || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance indicator */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Today's Performance</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs font-bold text-green-700">
                {practiceStats?.todayAppointments ? 
                  Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}% Complete
              </span>
            </div>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: `${practiceStats?.todayAppointments ? 
                  Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}%` 
              }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;