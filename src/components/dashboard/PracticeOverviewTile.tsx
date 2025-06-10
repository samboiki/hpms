import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Sparkles, TrendingUp, Star, Zap } from 'lucide-react';

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

  const getStatusColor = () => {
    const stats = practiceStats || { todayAppointments: 0, completedToday: 0 };
    const efficiency = stats.todayAppointments > 0 ? Math.round((stats.completedToday / stats.todayAppointments) * 100) : 0;
    
    if (efficiency > 80) return 'from-emerald-500 via-teal-500 to-cyan-500';
    if (efficiency > 60) return 'from-[#01b9d5] via-cyan-500 to-teal-500';
    return 'from-amber-500 via-orange-500 to-[#01b9d5]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 24 }}
      className="relative overflow-hidden mb-4 group"
    >
      {/* Simple grey container */}
      <div className="relative bg-gray-600 rounded-2xl shadow-lg border border-gray-500 overflow-hidden">
        {/* Header */}
        <div className="relative p-5 border-b border-gray-500 bg-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gray-500 rounded-xl">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              Practice Overview
            </h3>
          </div>
        </div>
        
        {/* Content area */}
        <div className="relative p-5">
          {/* Practice status text */}
          <div className="relative mb-6">
            <div className="relative p-4 bg-gray-500/20 rounded-xl border border-gray-400">
              <p className="text-sm text-gray-100 leading-relaxed font-medium">
                {generateOverviewText()}
              </p>
            </div>
          </div>

          {/* Performance indicator */}
          <div className="relative">
            <div className="relative p-4 bg-gray-500/20 rounded-xl border border-gray-400">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-200" />
                  <span className="text-sm font-bold text-gray-100">
                    Today's Performance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-bold text-green-300">
                    {practiceStats?.todayAppointments ? 
                      Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}% Complete
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="relative">
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-500">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${practiceStats?.todayAppointments ? 
                        Math.round(((practiceStats.completedToday || 0) / practiceStats.todayAppointments) * 100) : 0}%`
                    }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${getStatusColor()} relative overflow-hidden rounded-full`}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-pulse"></div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;